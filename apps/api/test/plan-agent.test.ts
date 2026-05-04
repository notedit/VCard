import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sql, eq, asc } from 'drizzle-orm';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { app } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { cards, changeLogs, projects } from '../src/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);

const ROLES = ['cover', 'hook', 'argument', 'argument', 'argument', 'list', 'payoff', 'cta', 'cta'] as const;

function makeUsage() {
  return {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 10, text: 10, reasoning: 0 },
    totalTokens: 20,
  };
}

function nineToolCallEvents(): LanguageModelV3StreamPart[] {
  const calls: LanguageModelV3StreamPart[] = [{ type: 'stream-start', warnings: [] }];
  for (let i = 0; i < 9; i += 1) {
    calls.push({
      type: 'tool-call',
      toolCallId: `call-${i}`,
      toolName: 'create_card',
      input: JSON.stringify({
        index: i,
        role: ROLES[i],
        title: `T${i}`,
        body: `B${i}`,
      }),
    });
  }
  calls.push({
    type: 'finish',
    finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
    usage: makeUsage(),
  });
  return calls;
}

function finalTextEvents(): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'final' },
    { type: 'text-delta', id: 'final', delta: 'done' },
    { type: 'text-end', id: 'final' },
    { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: makeUsage() },
  ];
}

function buildMockModel() {
  let invocation = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      invocation += 1;
      const parts = invocation === 1 ? nineToolCallEvents() : finalTextEvents();
      return { stream: convertArrayToReadableStream(parts) };
    },
  });
}

async function truncateAll() {
  await db.execute(sql`TRUNCATE TABLE projects, skills, change_logs RESTART IDENTITY CASCADE`);
}

describe('POST /projects/:id/plan with mocked model', () => {
  beforeEach(truncateAll);
  afterEach(truncateAll);

  it('runs the agent loop, writes 9 cards + 9 changelog entries via create_card tool', async () => {
    // 1. seed a project
    const projectRes = await app.request(
      '/projects',
      { method: 'POST', body: JSON.stringify({ topic: '北京胡同周末美食 200 块' }) },
      { DATABASE_URL },
    );
    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    // 2. invoke /plan with injected mock model
    const mockModel = buildMockModel();
    const planRes = await app.request(
      `/projects/${project.id}/plan`,
      { method: 'POST', body: JSON.stringify({}) },
      { DATABASE_URL, __TEST_PLAN_MODEL__: mockModel },
    );
    expect(planRes.status).toBe(200);
    expect(planRes.headers.get('content-type') ?? '').toContain('text/event-stream');

    // 3. drain the stream so all tool calls fully execute
    const reader = planRes.body!.getReader();
    let chunks = 0;
    while (true) {
      const { done } = await reader.read();
      if (done) break;
      chunks += 1;
    }
    expect(chunks).toBeGreaterThan(0);

    // 4. assert DB state
    const writtenCards = await db
      .select()
      .from(cards)
      .where(eq(cards.projectId, project.id))
      .orderBy(asc(cards.index));
    expect(writtenCards).toHaveLength(9);
    expect(writtenCards.map((card) => card.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(writtenCards.map((card) => card.role)).toEqual([...ROLES]);
    expect(writtenCards[0].title).toBe('T0');
    expect(writtenCards[8].body).toBe('B8');

    const logs = await db
      .select()
      .from(changeLogs)
      .where(eq(changeLogs.projectId, project.id));
    const createCardLogs = logs.filter((log) => log.action === 'create_card' && log.actor === 'agent');
    expect(createCardLogs).toHaveLength(9);

    const stored = await db.query.projects.findFirst({ where: eq(projects.id, project.id) });
    expect(stored?.status).toBe('planning');
  });
});
