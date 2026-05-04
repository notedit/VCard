import { beforeEach, describe, expect, it } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { app } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { cards, projects } from '../src/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);

function makeUsage() {
  return {
    inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 8, text: 0, reasoning: 0 },
    totalTokens: 20,
  };
}

function buildEditMockModel(newTitle: string, rationale: string) {
  let invocation = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      invocation += 1;
      if (invocation === 1) {
        const parts: LanguageModelV3StreamPart[] = [
          { type: 'stream-start', warnings: [] },
          {
            type: 'tool-call',
            toolCallId: 'edit-1',
            toolName: 'propose_edit',
            input: JSON.stringify({
              field: 'title',
              newValue: newTitle,
              rationale,
            }),
          },
          {
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: makeUsage(),
          },
        ];
        return { stream: convertArrayToReadableStream(parts) };
      }
      // Final round (after tool result fed back) — agent stops with text.
      const parts: LanguageModelV3StreamPart[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'final' },
        { type: 'text-delta', id: 'final', delta: 'done' },
        { type: 'text-end', id: 'final' },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: makeUsage(),
        },
      ];
      return { stream: convertArrayToReadableStream(parts) };
    },
  });
}

async function truncateAll() {
  await db.execute(
    sql`TRUNCATE TABLE projects, skills, change_logs, gen_jobs, card_images, suggestions RESTART IDENTITY CASCADE`,
  );
}

describe('POST /cards/:id/edit with mocked Haiku', () => {
  beforeEach(truncateAll);

  it('streams a propose_edit tool call WITHOUT mutating the card row', async () => {
    const [project] = await db
      .insert(projects)
      .values({ topic: '北京胡同周末美食', userId: 'demo-user' })
      .returning();
    const [card] = await db
      .insert(cards)
      .values({
        projectId: project.id,
        index: 0,
        role: 'cover',
        title: '原始标题',
        body: '原始正文',
        version: 1,
      })
      .returning();

    const mockModel = buildEditMockModel('200块吃到扶墙：胡同 7 家老店', '更具体、有反差');

    const res = await app.request(
      `/cards/${card.id}/edit`,
      {
        method: 'POST',
        body: JSON.stringify({ field: 'title', instruction: '把标题改俏皮一点，强调价格反差' }),
      },
      { DATABASE_URL, __TEST_EDIT_MODEL__: mockModel },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('text/event-stream');

    // Drain the stream so the tool execute runs.
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
    // The tool-result shows up as JSON with our newValue inside the AI SDK
    // data stream. We don't assert the exact frame, just that the proposed
    // value is mentioned somewhere in the output.
    expect(body).toContain('200块吃到扶墙');
    expect(body).toContain('更具体、有反差');

    // Critical: card row in PG is UNCHANGED — propose_edit doesn't auto-commit.
    const after = await db.query.cards.findFirst({ where: eq(cards.id, card.id) });
    expect(after?.title).toBe('原始标题');
    expect(after?.body).toBe('原始正文');
    expect(after?.version).toBe(1);
    expect(after?.userEdited).toBe(false);
  });

  it('returns 404 when the card does not exist', async () => {
    const mockModel = buildEditMockModel('foo', 'bar');
    const res = await app.request(
      `/cards/00000000-0000-4000-8000-000000000999/edit`,
      {
        method: 'POST',
        body: JSON.stringify({ field: 'title', instruction: '随便' }),
      },
      { DATABASE_URL, __TEST_EDIT_MODEL__: mockModel },
    );
    expect(res.status).toBe(404);
  });
});
