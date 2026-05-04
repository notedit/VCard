import { ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { proposeEditTool } from './tools/propose-edit.js';
import { VOICE_TONE_RULES } from './voice-tone.js';
import type { CardRow, SkillRow } from '../db/schema.js';

export const EDIT_MODEL_ID = 'claude-haiku-4-5';

const DEFAULT_MAX_TITLE = 18;
const DEFAULT_MAX_BODY = 80;

export type BuildEditAgentArgs = {
  /** Inject for testing (real Haiku in prod, MockLanguageModelV3 in unit tests). */
  model: LanguageModel;
  /** The card being edited. */
  card: CardRow;
  /** Sibling cards (e.g., immediate neighbors) for tone context. Pass [] to skip. */
  contextCards: ReadonlyArray<Pick<CardRow, 'index' | 'role' | 'title' | 'body'>>;
  /** The field the user wants to change. */
  field: 'title' | 'body';
  /** Skills attached to the project, in priority order (idx 0 = highest). */
  skills?: ReadonlyArray<SkillRow>;
};

/**
 * Build the Edit-stage system prompt. Mirrors Plan-stage Skill stacking:
 * - filters to edit-stage skills
 * - highest-priority maxWordsPerCard wins (overrides default 80)
 * - injects Skill few-shot examples for tone consistency
 * - prepends shared Voice & Tone rules
 */
export function buildEditInstructions(args: BuildEditAgentArgs): string {
  const editSkills = (args.skills ?? []).filter((s) => s.appliesTo.stages.includes('edit'));
  const maxBody =
    editSkills.find((s) => typeof s.outputSchema.maxWordsPerCard === 'number')?.outputSchema
      .maxWordsPerCard ?? DEFAULT_MAX_BODY;

  const currentValue = args.field === 'title' ? args.card.title : args.card.body;
  const contextSnippets = args.contextCards
    .map((c) => `  - 第 ${c.index + 1} 张 (${c.role}): 标题「${c.title}」 / 正文「${c.body}」`)
    .join('\n');

  const skillBlocks = editSkills
    .map((skill, idx) => {
      const header = `### Skill #${idx + 1}: ${skill.name}\n${skill.systemPrompt}`;
      if (skill.fewShotExamples.length === 0) return header;
      const examples = skill.fewShotExamples
        .map((ex, exIdx) => `示例 ${exIdx + 1}:\n  Input: ${ex.input}\n  Output: ${ex.output}`)
        .join('\n');
      return `${header}\n\n**Few-shot 示例**：\n${examples}`;
    })
    .join('\n\n');

  const lines: Array<string | false> = [
    '你是一名小红书内容编辑，按用户指令改写当前卡片的指定字段。',
    '',
    '**约束**：',
    '- 只调用一次 `propose_edit` 工具，输出新值。**不要直接落库** —— 用户会在前端确认后再写入。',
    `- 标题 ≤ ${DEFAULT_MAX_TITLE} 字，正文 ≤ ${maxBody} 字。`,
    '- 保留原意，除非用户明确要求改方向。',
    '',
    VOICE_TONE_RULES,
    '',
    '**当前卡片**：',
    `  - 序号: 第 ${args.card.index + 1} 张`,
    `  - 角色: ${args.card.role}`,
    `  - 字段: ${args.field}`,
    `  - 当前值: 「${currentValue}」`,
    '',
    contextSnippets ? '**邻近卡片（用于保持语气一致）**：\n' + contextSnippets : false,
    skillBlocks
      ? `\n---\n\n# 已挂载 Skills（按优先级，idx 0 最高）\n\n${skillBlocks}`
      : false,
    '',
    '收到指令后立即调用 `propose_edit({ field, newValue, rationale })`。',
  ];

  return lines.filter((line): line is string => line !== false).join('\n');
}

export function buildEditAgent(args: BuildEditAgentArgs) {
  return new ToolLoopAgent({
    model: args.model,
    instructions: buildEditInstructions(args),
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
