import OpenAI from 'openai';
import type { AspectRatio, DeckSettings } from '@vcard/shared-types';

// 方案 A 的图像生成层。三条路径（按优先级）：
// 1. AIHUBMIX_API_KEY 存在 → 走 AIHubMix 网关（baseURL https://aihubmix.com/v1），
//    与 outline / chat 复用同一份 key 与计费账户。
// 2. OPENAI_API_KEY 存在 → 直连 OpenAI 官方 API（用于绕过网关或单独计费）。
// 3. 都没有 → 返回 SVG data URL 占位（CI / 离线开发 / 端到端测试）。
//
// 当前不做 R2 上传，返回的 b64 直接拼成 data URL 写回 deck_cards.image_url。
// 上线前迁到 Queue+DO 时，会把这一层改成把 b64 上传 R2，imageUrl 写持久 URL。

export const IMAGE_MODEL_ID = 'gpt-image-1';
const AIHUBMIX_OPENAI_BASE_URL = 'https://aihubmix.com/v1';

export type GenerateImageEnv = {
  AIHUBMIX_API_KEY?: string;
  OPENAI_API_KEY?: string;
};

export function buildImageClient(env: GenerateImageEnv): { client: OpenAI; source: 'aihubmix' | 'openai' } | null {
  if (env.AIHUBMIX_API_KEY) {
    return {
      client: new OpenAI({ apiKey: env.AIHUBMIX_API_KEY, baseURL: AIHUBMIX_OPENAI_BASE_URL }),
      source: 'aihubmix',
    };
  }
  if (env.OPENAI_API_KEY) {
    return { client: new OpenAI({ apiKey: env.OPENAI_API_KEY }), source: 'openai' };
  }
  return null;
}

export type GenerateImageArgs = {
  prompt: string;
  cardTitle: string;
  cardIndex: number;
  aspectRatio: AspectRatio;
  settings: DeckSettings;
  env: GenerateImageEnv;
};

export type GenerateImageResult = {
  imageUrl: string;
  imagePrompt: string;
  source: 'placeholder' | 'aihubmix' | 'openai';
};

export async function generateCardImage(args: GenerateImageArgs): Promise<GenerateImageResult> {
  const imagePrompt = composePrompt(args);
  const built = buildImageClient(args.env);
  if (!built) {
    return {
      imageUrl: buildPlaceholderDataUrl(args),
      imagePrompt,
      source: 'placeholder',
    };
  }
  const result = await built.client.images.generate({
    model: IMAGE_MODEL_ID,
    prompt: imagePrompt,
    size: aspectRatioToSize(args.aspectRatio),
    n: 1,
  });
  const first = result.data?.[0];
  if (!first?.b64_json) {
    throw new Error('image_provider_no_b64');
  }
  return {
    imageUrl: `data:image/png;base64,${first.b64_json}`,
    imagePrompt,
    source: built.source,
  };
}

export function composePrompt(args: Pick<GenerateImageArgs, 'cardTitle' | 'settings' | 'prompt'>): string {
  return [
    `Editorial social card, ${args.settings.imageStyle} style.`,
    `Topic: ${args.prompt}.`,
    `Card title: ${args.cardTitle}.`,
    'Restrained palette, no embedded text, no logos, no watermarks.',
    'Single clear subject; cinematic lighting; high editorial quality.',
  ].join(' ');
}

function aspectRatioToSize(ratio: AspectRatio): '1024x1024' | '1024x1536' | '1536x1024' {
  switch (ratio) {
    case '1:1':
      return '1024x1024';
    case '4:5':
      return '1024x1536'; // 接近 4:5 的纵向，OpenAI 不支持精确 4:5
    case '9:16':
      return '1024x1536';
    default:
      return '1024x1024';
  }
}

// 占位 SVG，用 deterministic seed 生成渐变 + 卡片信息文本。
// 解码后是合法 SVG，浏览器可直接渲染。
export function buildPlaceholderDataUrl(args: Pick<GenerateImageArgs, 'cardTitle' | 'cardIndex' | 'aspectRatio' | 'settings'>): string {
  const palettes = ['#1a1a2e,#0c1538', '#3a2418,#5b3a2e', '#0f1a2e,#1a2138', '#2a1a3a,#3a1f4a', '#1f3a5f,#251f3a'];
  const colors = (palettes[args.cardIndex % palettes.length] ?? palettes[0]).split(',');
  const [w, h] = aspectRatioToBox(args.aspectRatio);
  const safeTitle = escapeXml(truncate(args.cardTitle, 40));
  const meta = escapeXml(`#${String(args.cardIndex + 1).padStart(2, '0')} · ${args.settings.imageStyle}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors[0]}"/>
      <stop offset="100%" stop-color="${colors[1]}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g fill="#f5f5f7" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <text x="64" y="${h - 96}" font-size="28" opacity="0.7">${meta}</text>
    <text x="64" y="${h - 56}" font-size="44" font-weight="700">${safeTitle}</text>
  </g>
</svg>`;
  return `data:image/svg+xml;base64,${b64encode(svg)}`;
}

function aspectRatioToBox(ratio: AspectRatio): [number, number] {
  switch (ratio) {
    case '1:1':
      return [1024, 1024];
    case '4:5':
      return [1024, 1280];
    case '9:16':
      return [1080, 1920];
    default:
      return [1024, 1024];
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (ch) => {
    switch (ch) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return ch;
    }
  });
}

function b64encode(text: string): string {
  // Node.js 与 Cloudflare Workers 都有 Buffer 或 btoa；优先 Buffer，回退 btoa
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf-8').toString('base64');
  // workers: btoa 不支持非 latin1，但 SVG 在 latin1 安全（无中文时）。中文标题需先 utf-8。
  return btoa(unescape(encodeURIComponent(text)));
}
