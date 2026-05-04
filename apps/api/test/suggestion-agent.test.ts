import { beforeEach, describe, expect, it } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModelV3Content } from '@ai-sdk/provider';
import { createDb } from '../src/db/client.js';
import { cards, projects, suggestions } from '../src/db/schema.js';
import { runSuggestionReflect } from '../src/agent/suggestion-agent.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);

function makeUsage() {
  return {
    inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 6, text: 0, reasoning: 0 },
    totalTokens: 14,
  };
}

function buildReflectMockModel(opts: {
  propose: { type: 'structure' | 'platform_sop' | 'quality'; message: string; actionLabel: string };
}) {
  let invocation = 0;
  return new MockLanguageModelV3({
    // ToolLoopAgent.generate uses doGenerate (non-streaming).
    doGenerate: async () => {
      invocation += 1;
      if (invocation === 1) {
        const content: LanguageModelV3Content[] = [
          {
            type: 'tool-call',
            toolCallId: 'sug-1',
            toolName: 'propose_suggestion',
            input: JSON.stringify({
              type: opts.propose.type,
              message: opts.propose.message,
              actionLabel: opts.propose.actionLabel,
              actionPayload: { focusCardIndex: 4 },
            }),
          },
        ];
        return {
          content,
          finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
          usage: makeUsage(),
          warnings: [],
        };
      }
      const content: LanguageModelV3Content[] = [{ type: 'text', text: 'done' }];
      return {
        content,
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: makeUsage(),
        warnings: [],
      };
    },
  });
}

function buildSilentReflectMockModel() {
  // The model decides no suggestion is needed and just returns text.
  return new MockLanguageModelV3({
    doGenerate: async () => {
      const content: LanguageModelV3Content[] = [
        { type: 'text', text: '看起来无明显问题。' },
      ];
      return {
        content,
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: makeUsage(),
        warnings: [],
      };
    },
  });
}

async function truncateAll() {
  await db.execute(
    sql`TRUNCATE TABLE projects, skills, change_logs, gen_jobs, card_images, suggestions RESTART IDENTITY CASCADE`,
  );
}

async function seed() {
  const [project] = await db
    .insert(projects)
    .values({ topic: '北京胡同周末美食 200 块', userId: 'demo-user' })
    .returning();
  const [card] = await db
    .insert(cards)
    .values({
      projectId: project.id,
      index: 4,
      role: 'list',
      title: '清单卡',
      body: '具体的 5 个推荐',
      version: 1,
    })
    .returning();
  return { project, card };
}

describe('runSuggestionReflect (queue consumer side, mocked Haiku)', () => {
  beforeEach(truncateAll);

  it('writes a suggestion row when the agent calls propose_suggestion', async () => {
    const { project, card } = await seed();
    const model = buildReflectMockModel({
      propose: {
        type: 'structure',
        message: '第 5 张承担清单转折，建议把信息密度再压紧一些。',
        actionLabel: '查看第 5 张',
      },
    });

    await runSuggestionReflect(
      { projectId: project.id, cardId: card.id, trigger: 'edit' },
      { db, model },
    );

    const rows = await db.select().from(suggestions).where(eq(suggestions.projectId, project.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('structure');
    expect(rows[0].message).toContain('第 5 张');
    expect(rows[0].cardId).toBe(card.id);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].actionLabel).toBe('查看第 5 张');
    expect(rows[0].actionPayload).toEqual({ focusCardIndex: 4 });
  });

  it('writes nothing when the agent decides no suggestion is warranted', async () => {
    const { project } = await seed();
    const model = buildSilentReflectMockModel();
    await runSuggestionReflect(
      { projectId: project.id, trigger: 'plan' },
      { db, model },
    );
    const rows = await db.select().from(suggestions).where(eq(suggestions.projectId, project.id));
    expect(rows).toHaveLength(0);
  });
});
