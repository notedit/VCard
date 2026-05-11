import { generateText, type LanguageModel, type ModelMessage } from 'ai';
import { z } from 'zod';
import { resolveTemplate, type DeckSettings } from '@vcard/shared-types';
import { ANTI_SLOP, STRUCTURAL_RULES, VOICE_TONE } from './skills/_compiled.js';
import { buildOutlineModel, extractJsonObject, type GenerateOutlineEnv } from './outline.js';

const CHAT_OUTPUT_FORMAT = `# 输出格式

只输出一个 JSON 对象（不要 Markdown 代码块、不要任何额外解释）：

\`\`\`
{
  "body": "对用户的回应，1-3 句，遵循 voice-tone 的克制语气",
  "actions": [
    {
      "label": "可点击按钮的简短文字（≤ 12 字）",
      "kind": "title",
      "patch": { "title": "重写后的标题" }
    }
  ]
}
\`\`\`

actions 取值：
- kind 严格限定为：title | bullet | tone（每种 kind 最多 1 个）
- actions 至少 1 项，最多 3 项
- 每个 action 必须含 "patch" 字段，描述点击此按钮后卡片要变成什么样：
  - kind=title 的 action：patch.title 为重写后的完整新标题
  - kind=bullet 的 action：patch.bullets 为完整的新要点数组（不是 diff，是覆盖后的全部）
  - kind=tone 的 action：通常给 patch.title（语气重写后的标题），必要时也可同时给 patch.bullets
- patch 必须是 LLM 真实想做的修改；不要写"占位"、"待用户填写"或保留原值
- 只在能给卡片带来明显改进时给出该 action；不要为了凑数加进来

如果用户消息只是闲聊或与卡片无关，body 可以提示并仍至少给一个 tone action（patch 给一个语气更克制的标题改写）。`;

const chatPatchSchema = z
  .object({
    title: z.string().min(1).max(80).optional(),
    bullets: z.array(z.string().min(1).max(200)).min(1).max(8).optional(),
  })
  .refine((p) => p.title !== undefined || p.bullets !== undefined, {
    message: 'patch must include at least one of: title, bullets',
  });

const chatActionSchema = z.object({
  label: z.string().min(1).max(20),
  kind: z.enum(['title', 'bullet', 'tone']),
  patch: chatPatchSchema,
});

const chatReplySchema = z.object({
  body: z.string().min(1),
  actions: z.array(chatActionSchema).min(1).max(3),
});

export type ChatReplyAction = z.infer<typeof chatActionSchema>;
export type ChatReply = z.infer<typeof chatReplySchema>;

export type ChatCardContext = {
  index: number;
  total: number;
  title: string;
  bullets: string[];
  layout: string;
};

export type ChatHistoryEntry = {
  role: 'user' | 'assistant';
  body: string;
};

export type GenerateChatReplyArgs = {
  message: string;
  card: ChatCardContext | null;
  deckTitle: string;
  deckPrompt: string;
  settings: DeckSettings;
  env: GenerateOutlineEnv;
  history?: ChatHistoryEntry[];
  model?: LanguageModel;
};

function assembleChatSystemPrompt(): string {
  return [VOICE_TONE, ANTI_SLOP, STRUCTURAL_RULES, CHAT_OUTPUT_FORMAT].join('\n\n---\n\n');
}

function buildChatUserPrompt(args: GenerateChatReplyArgs): string {
  const spec = resolveTemplate(args.settings.template);
  const lines = [
    `卡组主题：${args.deckPrompt}`,
    `当前模板：${spec.name}（${spec.voiceBias}）`,
    `文字密度：${args.settings.density}`,
  ];
  if (args.card) {
    lines.push(
      '',
      `用户当前锁定的卡片：#${String(args.card.index + 1).padStart(2, '0')} / ${String(args.card.total).padStart(2, '0')}`,
      `版式：${args.card.layout}`,
      `当前标题：${args.card.title}`,
      `当前要点：`,
      ...args.card.bullets.map((b, i) => `  - ${i + 1}. ${b}`),
    );
  } else {
    lines.push('', '用户当前对整套卡片对话（未锁定单卡）。');
  }
  lines.push('', `用户最新消息：${args.message}`);
  return lines.join('\n');
}

export async function generateChatReply(args: GenerateChatReplyArgs): Promise<ChatReply> {
  const model = args.model ?? buildOutlineModel(args.env);
  // 历史按时间序，过滤旧 system 消息（chat 只用 user/assistant 角色）。
  const historyMessages: ModelMessage[] = (args.history ?? [])
    .slice(-10) // 最多最近 10 条
    .map((entry) => ({ role: entry.role, content: entry.body }));
  const messages: ModelMessage[] = [
    ...historyMessages,
    { role: 'user', content: buildChatUserPrompt(args) },
  ];
  const result = await generateText({
    model,
    system: assembleChatSystemPrompt(),
    messages,
  });
  const json = extractJsonObject(result.text);
  return chatReplySchema.parse(JSON.parse(json));
}

export { chatReplySchema };
