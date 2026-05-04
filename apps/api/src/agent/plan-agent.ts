import { ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createCardTool, type CreateCardCtx } from './tools/create-card.js';
import type { SkillRow } from '../db/schema.js';

const BASE_SYSTEM_PROMPT = `你是一名小红书内容编辑。

任务：根据用户给出的主题，生成 9 张卡片，按 index 0..8 调用 create_card 工具一次。

角色顺序固定为：
  0 cover · 1 hook · 2 argument · 3 argument · 4 argument · 5 list · 6 payoff · 7 cta · 8 cta

约束：
- 中文，自然口语，避免营销腔和过度感叹号
- 9 张全部生成完毕后立即停止，不要解释流程或重复调用同一 index`;

export const PLAN_MODEL_ID = 'claude-sonnet-4-5';

const DEFAULT_MAX_TITLE = 18;
const DEFAULT_MAX_BODY = 80;

export type BuildPlanAgentArgs = {
  /** Inject for testing (real model in prod, MockLanguageModelV3 in unit tests). */
  model: LanguageModel;
  ctx: CreateCardCtx;
  /** Skills the project has selected, in priority order (idx 0 = highest). */
  skills?: ReadonlyArray<SkillRow>;
};

/**
 * Build the system prompt by stacking selected skills onto the base prompt.
 * Per tech-design §5.3:
 * - Order matters: idx 0 has highest priority.
 * - Conflict fields (maxWordsPerCard, etc) — highest-priority value wins.
 * - Only skills whose appliesTo.stages includes 'plan' affect Plan generation.
 */
export function buildPlanInstructions(skills: ReadonlyArray<SkillRow> = []): string {
  const planSkills = skills.filter((skill) => skill.appliesTo.stages.includes('plan'));

  // Resolve word limits — first skill that defines the field wins.
  const maxBody =
    planSkills.find((s) => typeof s.outputSchema.maxWordsPerCard === 'number')?.outputSchema
      .maxWordsPerCard ?? DEFAULT_MAX_BODY;

  const limitsLine = `- 标题 ≤ ${DEFAULT_MAX_TITLE} 字，正文 ≤ ${maxBody} 字`;
  const baseWithLimits = `${BASE_SYSTEM_PROMPT}\n${limitsLine}`;

  if (planSkills.length === 0) return baseWithLimits;

  const skillBlocks = planSkills
    .map((skill, idx) => `### Skill #${idx + 1}: ${skill.name}\n${skill.systemPrompt}`)
    .join('\n\n');

  return `${baseWithLimits}\n\n---\n\n# 已挂载 Skills（按优先级，idx 0 最高）\n\n${skillBlocks}`;
}

export function buildPlanAgent(args: BuildPlanAgentArgs) {
  return new ToolLoopAgent({
    model: args.model,
    instructions: buildPlanInstructions(args.skills),
    tools: {
      create_card: createCardTool(args.ctx),
    },
    // 9 cards + slack for occasional retry steps.
    stopWhen: stepCountIs(20),
  });
}

export function buildPlanModel(env: { AIHUBMIX_API_KEY: string }): LanguageModel {
  const anthropic = createAnthropic({
    apiKey: env.AIHUBMIX_API_KEY,
    baseURL: 'https://aihubmix.com',
  });
  return anthropic(PLAN_MODEL_ID);
}

export function buildInitialPlanMessages(topic: string) {
  return [
    {
      id: crypto.randomUUID(),
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: `主题：${topic}` }],
    },
  ];
}
