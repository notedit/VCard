import OpenAI from 'openai';
import type { CardRow, GenJobRow } from '../db/schema.js';

// Minimum surface of `openai` we depend on. Lets tests inject a stub that
// returns a fake PNG b64 instead of paying ~$0.16 per real gpt-image-2 call.
export type ImageClient = {
  images: {
    generate(args: {
      model: string;
      prompt: string;
      size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
      n?: number;
    }): Promise<{
      data?: Array<{ b64_json?: string; url?: string }> | null;
    }>;
  };
};

export const IMAGE_MODEL = 'gpt-image-2';
export const REDBOOK_IMAGE_SIZE = '1024x1536';

export type GenImageContext = {
  card: CardRow;
  job: GenJobRow;
  topic: string;
};

export type GenImageResult = {
  b64: string;
  fullPrompt: string;
  model: string;
};

export function buildOpenAIClient(env: { AIHUBMIX_API_KEY: string }): ImageClient {
  return new OpenAI({
    apiKey: env.AIHUBMIX_API_KEY,
    baseURL: 'https://aihubmix.com/v1',
  }) as unknown as ImageClient;
}

export function buildImagePrompt(ctx: GenImageContext): string {
  const subject = ctx.job.mainSubject.description;
  const locks =
    ctx.job.mainSubject.locks.length > 0 ? `锁定项: ${ctx.job.mainSubject.locks.join(', ')}` : null;
  const card = ctx.card;
  return [
    `小红书 4:5 卡片，主题：${ctx.topic}`,
    `主体锚点：${subject}`,
    locks,
    `画面风格：${ctx.job.artStyle || '真实摄影'}`,
    `文字布局：${ctx.job.textLayout}`,
    `第 ${card.index + 1} 张，角色：${card.role}`,
    `烧入标题：${card.title}`,
    `正文：${card.body}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateCardImage(
  client: ImageClient,
  ctx: GenImageContext,
): Promise<GenImageResult> {
  const fullPrompt = buildImagePrompt(ctx);
  const res = await client.images.generate({
    model: IMAGE_MODEL,
    prompt: fullPrompt,
    size: REDBOOK_IMAGE_SIZE,
    n: 1,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`gpt-image-2 returned no b64_json (data: ${JSON.stringify(res.data)})`);
  }
  return { b64, fullPrompt, model: IMAGE_MODEL };
}
