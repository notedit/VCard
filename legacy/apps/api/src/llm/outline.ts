import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, stepCountIs, tool, type LanguageModel, type ModelMessage } from 'ai';
import { z } from 'zod';
import {
  resolveTemplate,
  type CardLayout,
  type DeckSettings,
  type Language,
  type TemplateSpec,
} from '@vcard/shared-types';
import {
  ANTI_SLOP,
  SLOP_WORDS,
  STRUCTURAL_RULES,
  TEMPLATE_BRIEFING,
  TEMPLATE_MAGAZINE,
  TEMPLATE_MINIMAL,
  TEMPLATE_NARRATIVE,
  VOICE_TONE,
} from './skills/_compiled.js';

export const OUTLINE_MODEL_ID = 'claude-sonnet-4-6';
// AIHubMix 的 Anthropic-native endpoint 完整路径是 /v1/messages，@ai-sdk/anthropic
// 不会自动拼 /v1，必须显式带上。少了 /v1 时网关会把请求当对象上传，返回
// "POST object expects Content-Type multipart/form-data"。
const ANTHROPIC_BASE_URL = 'https://aihubmix.com/v1';

const OUTPUT_FORMAT = `# 输出格式

所有搜索完成后，最后一条消息只输出一个 JSON 对象（不要 Markdown 代码块、不要任何额外解释）：

\`\`\`
{
  "cards": [
    { "title": "...", "bullets": ["...", "..."], "layout": "cover" }
  ]
}
\`\`\`

layout 取值严格限定为：cover | list | quote | stat | closer。`;

const TEMPLATE_SKILLS: Record<string, string> = {
  minimal: TEMPLATE_MINIMAL,
  magazine: TEMPLATE_MAGAZINE,
  briefing: TEMPLATE_BRIEFING,
  narrative: TEMPLATE_NARRATIVE,
};

function assembleSystemPrompt(spec: TemplateSpec): string {
  const templateMd = TEMPLATE_SKILLS[spec.id] ?? TEMPLATE_MINIMAL;
  return [VOICE_TONE, ANTI_SLOP, STRUCTURAL_RULES, templateMd, OUTPUT_FORMAT].join('\n\n---\n\n');
}

const cardLayoutSchema = z.enum(['cover', 'list', 'quote', 'stat', 'closer']);

const outlineCardSchema = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
  layout: cardLayoutSchema,
});

const outlineSchema = z.object({
  cards: z.array(outlineCardSchema).min(1),
});

export type OutlineCard = z.infer<typeof outlineCardSchema>;

export type GenerateOutlineEnv = {
  AIHUBMIX_API_KEY?: string;
  TAVILY_API_KEY?: string;
};

export type GenerateOutlineArgs = {
  prompt: string;
  count: number;
  language: Language;
  settings: DeckSettings;
  env: GenerateOutlineEnv;
  model?: LanguageModel;
};

export async function generateOutline(args: GenerateOutlineArgs): Promise<OutlineCard[]> {
  const model = args.model ?? buildOutlineModel(args.env);
  const spec = resolveTemplate(args.settings.template);

  let cards = await runOutlineModel(model, args, spec, []);
  let { hits } = lintCards(cards);

  if (hits.length > 0) {
    cards = await runOutlineModel(model, args, spec, hits);
    ({ hits } = lintCards(cards));
  }

  if (hits.length > 0) {
    console.warn(
      '[outline] anti-slop hits remained after retry, stripping:',
      hits.map((h) => h.match).join(', '),
    );
    cards = stripSlop(cards);
  }

  return ensureCount(cards, args.count);
}

async function runOutlineModel(
  model: LanguageModel,
  args: GenerateOutlineArgs,
  spec: TemplateSpec,
  priorHits: SlopHit[],
): Promise<OutlineCard[]> {
  const messages: ModelMessage[] = [{ role: 'user', content: buildUserPrompt(args, spec) }];
  if (priorHits.length > 0) {
    messages.push({
      role: 'user',
      content: buildCriticPrompt(priorHits),
    });
  }

  const result = await generateText({
    model,
    system: assembleSystemPrompt(spec),
    messages,
    tools: { web_search: makeWebSearchTool(args.env.TAVILY_API_KEY) },
    stopWhen: stepCountIs(8),
  });

  const json = extractJsonObject(result.text);
  const parsed = outlineSchema.parse(JSON.parse(json));
  return parsed.cards;
}

function buildCriticPrompt(hits: SlopHit[]): string {
  const lines = hits
    .slice(0, 12)
    .map((h) => `- 卡片 #${String(h.cardIndex + 1).padStart(2, '0')} ${h.field}：「${h.match}」`);
  return [
    '上一轮生成在以下位置触发了 anti-slop 黑名单。请按 voice-tone 与 anti-slop 规则**重写**这几张卡（保留原意，但用克制、编辑部口径的表达）：',
    '',
    ...lines,
    '',
    '其他没有命中的卡片可以保留。仍然只输出一个 JSON 对象，不要解释。',
  ].join('\n');
}

export function buildOutlineModel(env: GenerateOutlineEnv): LanguageModel {
  if (!env.AIHUBMIX_API_KEY) {
    throw new Error('AIHUBMIX_API_KEY missing');
  }
  const anthropic = createAnthropic({
    apiKey: env.AIHUBMIX_API_KEY,
    baseURL: ANTHROPIC_BASE_URL,
  });
  return anthropic(OUTLINE_MODEL_ID);
}

function buildUserPrompt(args: GenerateOutlineArgs, spec: TemplateSpec): string {
  const middleCount = Math.max(0, args.count - 2); // 减去 cover + closer
  const distribution = formatLayoutDistribution(spec.layoutDistribution, middleCount);
  const lines = [
    `主题：${args.prompt}`,
    `卡片数量：${args.count}`,
    `语言：${args.language}`,
    `模板：${spec.name}（id=${spec.id}） — ${spec.voiceBias}`,
    `每条要点字数上限：${spec.bulletMaxLength}`,
    `中间版式分布建议（${middleCount} 张中间卡）：${distribution}`,
    `closer 倾向：${spec.closerStyle === 'quote' ? 'quote 引语收束' : 'list 行动建议'}`,
    `文字密度：${args.settings.density}`,
  ];
  if (args.settings.layout && args.settings.layout !== '自动匹配') {
    lines.push(`用户额外的版式偏好：${args.settings.layout}`);
  }
  return lines.join('\n');
}

function formatLayoutDistribution(
  distribution: TemplateSpec['layoutDistribution'],
  middleCount: number,
): string {
  const entries = Object.entries(distribution) as Array<[CardLayout, number]>;
  if (entries.length === 0 || middleCount === 0) return 'list 为主';
  return entries
    .map(([layout, ratio]) => `${layout} ≈ ${Math.round(ratio * middleCount)} 张`)
    .join(' / ');
}

type SearchResult = { title: string; url: string; snippet: string };

function makeWebSearchTool(apiKey: string | undefined) {
  return tool({
    description: '搜索互联网最新内容。当主题涉及时效性、最新发布、近期数据时调用。返回前 5 条相关结果。',
    inputSchema: z.object({
      query: z.string().min(1).describe('搜索关键词，使用与主题相同的语言'),
    }),
    execute: async ({ query }): Promise<{ results: SearchResult[]; error?: string }> => {
      if (!apiKey) {
        return { results: [], error: 'web_search_unavailable: TAVILY_API_KEY not configured' };
      }
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: 'basic',
            max_results: 5,
            include_answer: false,
            include_raw_content: false,
          }),
        });
        if (!res.ok) {
          return { results: [], error: `tavily_http_${res.status}` };
        }
        const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
        const results: SearchResult[] = (data.results ?? []).map((r) => ({
          title: r.title ?? '',
          url: r.url ?? '',
          snippet: r.content ?? '',
        }));
        return { results };
      } catch (err) {
        return { results: [], error: `tavily_network_error: ${err instanceof Error ? err.message : 'unknown'}` };
      }
    },
  });
}

export function extractJsonObject(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) return fenceMatch[1];

  const start = text.indexOf('{');
  if (start < 0) throw new Error('no_json_in_llm_output');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced_json_in_llm_output');
}

function ensureCount(cards: OutlineCard[], expected: number): OutlineCard[] {
  if (cards.length === expected) return cards;
  if (cards.length > expected) return cards.slice(0, expected);
  const filler: OutlineCard[] = Array.from({ length: expected - cards.length }, (_, i) => ({
    title: `补充要点 ${cards.length + i + 1}`,
    bullets: ['这一段由本地兜底补齐，请稍后在工作台编辑'],
    layout: 'list' as CardLayout,
  }));
  return [...cards, ...filler];
}

export type SlopHit = { cardIndex: number; field: string; match: string };

const SLOP_PATTERNS: ReadonlyArray<RegExp> = [
  /[！!]{2,}/,
  /^(?:[^？]{0,20})你知道[吗么]？?/,
  /你以为.+其实/,
  /\d+%[^，。]{0,12}(?:暴|大|疯|不是梦|新高)/,
];

export function lintCards(cards: OutlineCard[]): { hits: SlopHit[] } {
  const hits: SlopHit[] = [];
  for (const [i, card] of cards.entries()) {
    const fields: Array<{ name: string; text: string }> = [
      { name: 'title', text: card.title },
      ...card.bullets.map((b, j) => ({ name: `bullet[${j}]`, text: b })),
    ];
    for (const { name, text } of fields) {
      for (const word of SLOP_WORDS) {
        if (text.includes(word)) hits.push({ cardIndex: i, field: name, match: word });
      }
      for (const re of SLOP_PATTERNS) {
        const m = text.match(re);
        if (m) hits.push({ cardIndex: i, field: name, match: m[0] });
      }
    }
  }
  return { hits };
}

export function stripSlop(cards: OutlineCard[]): OutlineCard[] {
  if (SLOP_WORDS.length === 0) return cards;
  const wordRe = new RegExp(SLOP_WORDS.map(escapeRegex).join('|'), 'g');
  return cards.map((card) => ({
    ...card,
    title: cleanString(card.title.replace(wordRe, '')),
    bullets: card.bullets.map((b) => cleanString(b.replace(wordRe, ''))),
  }));
}

function cleanString(s: string): string {
  return s
    .replace(/[！!]{2,}/g, '。')
    .replace(/，\s*，/g, '，')
    .replace(/。\s*。/g, '。')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
