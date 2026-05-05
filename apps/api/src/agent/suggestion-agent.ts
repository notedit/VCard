import { ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { Db } from '../db/client.js';
import { AIHUBMIX_ANTHROPIC_BASE_URL } from './model-config.js';
import { proposeSuggestionTool } from './tools/propose-suggestion.js';
import { readCardTool, readProjectTool } from './tools/read-context.js';
import { VOICE_TONE_RULES } from './voice-tone.js';

export const SUGGESTION_MODEL_ID = 'claude-haiku-4-5';

export type ReflectTrigger = 'edit' | 'reorder' | 'regen' | 'plan';

export type ReflectMessage = {
  projectId: string;
  cardId?: string;
  trigger: ReflectTrigger;
};

export type ReflectDeps = {
  db: Db;
  model: LanguageModel;
};

const SUGGESTION_INSTRUCTIONS = `你是一名小红书项目质量审视员，对当前项目的 Plan 提出最多 1 条改进建议。

工具：
- read_project()：查看项目状态 + 所有卡片
- read_card({cardId})：读单张卡片完整内容
- propose_suggestion({type, message, actionLabel, actionPayload})：写入 suggestions 表

判定流程：
1. 调用 read_project 获取全貌
2. 如有需要，调用 read_card 检查具体卡片
3. 决定：是否值得提一条建议？三类标准：
   - structure（结构）：角色排布、节奏失衡（黄）
   - platform_sop（平台规范）：小红书惯例、字数 / emoji / 标签（蓝）
   - quality（质量）：信息密度、口语自然度、避坑提醒（紫）
4. **如果没有显著问题，不要调用 propose_suggestion**——返回简短文字结束
5. 如果有，**只调用一次** propose_suggestion，message ≤ 80 字，actionLabel ≤ 8 字

${VOICE_TONE_RULES}`;

export function buildSuggestionAgent(args: {
  model: LanguageModel;
  db: Db;
  projectId: string;
  cardId?: string | null;
}) {
  const ctx = { db: args.db, projectId: args.projectId };
  return new ToolLoopAgent({
    model: args.model,
    instructions: SUGGESTION_INSTRUCTIONS,
    tools: {
      read_project: readProjectTool(ctx),
      read_card: readCardTool(ctx),
      propose_suggestion: proposeSuggestionTool({
        db: args.db,
        projectId: args.projectId,
        cardId: args.cardId ?? null,
      }),
    },
    stopWhen: stepCountIs(8),
  });
}

export function buildSuggestionModel(env: { AIHUBMIX_API_KEY: string }): LanguageModel {
  const anthropic = createAnthropic({
    apiKey: env.AIHUBMIX_API_KEY,
    baseURL: AIHUBMIX_ANTHROPIC_BASE_URL,
  });
  return anthropic(SUGGESTION_MODEL_ID);
}

export function buildReflectPrompt(payload: ReflectMessage): string {
  const triggerLabel: Record<ReflectTrigger, string> = {
    edit: '用户刚编辑了一张卡片',
    reorder: '用户刚重排了卡片顺序',
    regen: '用户刚触发了图像重生',
    plan: '刚完成一次 Plan 生成',
  };
  return `触发器：${triggerLabel[payload.trigger]}${payload.cardId ? `（cardId=${payload.cardId}）` : ''}\n\n按 instructions 流程判断是否需要建议。`;
}

/**
 * Run one reflect cycle. Used by the queue consumer (no streaming, no client).
 * If the agent decides no suggestion is warranted, the function returns
 * cleanly without writing to suggestions.
 */
export async function runSuggestionReflect(
  payload: ReflectMessage,
  deps: ReflectDeps,
): Promise<void> {
  const agent = buildSuggestionAgent({
    model: deps.model,
    db: deps.db,
    projectId: payload.projectId,
    cardId: payload.cardId,
  });

  await agent.generate({ prompt: buildReflectPrompt(payload) });
}
