import { ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { proposeEditTool } from './tools/propose-edit.js';
import type { CardRow } from '../db/schema.js';

export const EDIT_MODEL_ID = 'claude-haiku-4-5';

export type BuildEditAgentArgs = {
  /** Inject for testing (real Haiku in prod, MockLanguageModelV3 in unit tests). */
  model: LanguageModel;
  /** The card being edited. */
  card: CardRow;
  /** Sibling cards (e.g., immediate neighbors) for tone context. Pass [] to skip. */
  contextCards: ReadonlyArray<Pick<CardRow, 'index' | 'role' | 'title' | 'body'>>;
  /** The field the user wants to change. */
  field: 'title' | 'body';
};

export function buildEditAgent(args: BuildEditAgentArgs) {
  const currentValue = args.field === 'title' ? args.card.title : args.card.body;
  const contextSnippets = args.contextCards
    .map((c) => `  - 第 ${c.index + 1} 张 (${c.role}): 标题「${c.title}」 / 正文「${c.body}」`)
    .join('\n');

  const instructions = [
    '你是一名小红书内容编辑，按用户指令改写当前卡片的指定字段。',
    '',
    '**约束**：',
    '- 只调用一次 `propose_edit` 工具，输出新值。**不要直接落库** —— 用户会在前端确认后再写入。',
    '- 风格：自然口语、避免营销腔、避免空泛形容词。',
    '- 标题 ≤ 18 字，正文 ≤ 80 字。',
    '- 保留原意，除非用户明确要求改方向。',
    '',
    '**当前卡片**：',
    `  - 序号: 第 ${args.card.index + 1} 张`,
    `  - 角色: ${args.card.role}`,
    `  - 字段: ${args.field}`,
    `  - 当前值: 「${currentValue}」`,
    '',
    contextSnippets ? '**邻近卡片（用于保持语气一致）**：\n' + contextSnippets : '',
    '',
    '收到指令后立即调用 `propose_edit({ field, newValue, rationale })`。',
  ]
    .filter(Boolean)
    .join('\n');

  return new ToolLoopAgent({
    model: args.model,
    instructions,
    tools: { propose_edit: proposeEditTool() },
    // Single round expected; cap so a misbehaving model can't loop forever.
    stopWhen: stepCountIs(3),
  });
}

export function buildEditModel(env: { AIHUBMIX_API_KEY: string }): LanguageModel {
  const anthropic = createAnthropic({
    apiKey: env.AIHUBMIX_API_KEY,
    baseURL: 'https://aihubmix.com',
  });
  return anthropic(EDIT_MODEL_ID);
}

export function buildInitialEditMessages(instruction: string) {
  return [
    {
      id: crypto.randomUUID(),
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: instruction }],
    },
  ];
}
