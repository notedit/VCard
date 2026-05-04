import { ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createCardTool, type CreateCardCtx } from './tools/create-card.js';

const SYSTEM_PROMPT = `你是一名小红书内容编辑。

任务：根据用户给出的主题，生成 9 张卡片，按 index 0..8 调用 create_card 工具一次。

角色顺序固定为：
  0 cover · 1 hook · 2 argument · 3 argument · 4 argument · 5 list · 6 payoff · 7 cta · 8 cta

约束：
- 标题 ≤ 18 字，正文 ≤ 80 字
- 中文，自然口语，避免营销腔和过度感叹号
- 9 张全部生成完毕后立即停止，不要解释流程或重复调用同一 index`;

export const PLAN_MODEL_ID = 'claude-sonnet-4-5';

export type BuildPlanAgentArgs = {
  /** Inject for testing (real model in prod, MockLanguageModelV3 in unit tests). */
  model: LanguageModel;
  ctx: CreateCardCtx;
};

export function buildPlanAgent(args: BuildPlanAgentArgs) {
  return new ToolLoopAgent({
    model: args.model,
    instructions: SYSTEM_PROMPT,
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
