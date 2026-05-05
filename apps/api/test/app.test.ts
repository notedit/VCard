import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { app } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { cards, suggestions } from '../src/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);
const env = { DATABASE_URL };

async function truncateAll() {
  await db.execute(
    sql`TRUNCATE TABLE projects, skills, change_logs, gen_jobs, card_images, suggestions RESTART IDENTITY CASCADE`,
  );
}

describe('project and cards', () => {
  beforeEach(truncateAll);

  it('creates project then edits card with optimistic lock', async () => {
    // 1. create project
    const pRes = await app.request(
      '/projects',
      { method: 'POST', body: JSON.stringify({ topic: 'test' }) },
      env,
    );
    expect(pRes.status).toBe(201);
    const project = (await pRes.json()) as { id: string };

    // 2. seed a card directly (bypassing agent path)
    const [card] = await db
      .insert(cards)
      .values({
        projectId: project.id,
        index: 0,
        role: 'cover',
        title: 't',
        body: 'b',
        version: 1,
      })
      .returning();

    // 3. happy path: patch with correct version
    const okRes = await app.request(
      `/projects/${project.id}/cards/${card.id}`,
      { method: 'PATCH', body: JSON.stringify({ title: 'new', version: 1 }) },
      env,
    );
    expect(okRes.status).toBe(200);
    const updated = (await okRes.json()) as { title: string; version: number };
    expect(updated.title).toBe('new');
    expect(updated.version).toBe(2);

    // 4. version conflict: re-patch with stale version 1
    const conflictRes = await app.request(
      `/projects/${project.id}/cards/${card.id}`,
      { method: 'PATCH', body: JSON.stringify({ title: 'x', version: 1 }) },
      env,
    );
    expect(conflictRes.status).toBe(409);
  });

  it('GET /projects/:id returns project + ordered cards', async () => {
    const project = (await (
      await app.request(
        '/projects',
        { method: 'POST', body: JSON.stringify({ topic: 'order test' }) },
        env,
      )
    ).json()) as { id: string };

    // insert 3 cards out of order
    for (const idx of [2, 0, 1]) {
      await db.insert(cards).values({
        projectId: project.id,
        index: idx,
        role: 'argument',
        title: `c${idx}`,
        body: '',
        version: 1,
      });
    }

    const res = await app.request(`/projects/${project.id}`, {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: { index: number }[] };
    expect(body.cards.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it('lists and updates suggestion status', async () => {
    const project = (await (
      await app.request(
        '/projects',
        { method: 'POST', body: JSON.stringify({ topic: 'suggestion test' }) },
        env,
      )
    ).json()) as { id: string };

    const [suggestion] = await db
      .insert(suggestions)
      .values({
        projectId: project.id,
        type: 'structure',
        message: '第 5 张信息密度偏高',
        actionLabel: '拆成两张',
        actionPayload: { kind: 'split_card' },
      })
      .returning();

    const listRes = await app.request(`/projects/${project.id}/suggestions`, {}, env);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { suggestions: Array<{ id: string; status: string }> };
    expect(listBody.suggestions).toHaveLength(1);
    expect(listBody.suggestions[0].status).toBe('pending');

    const ignoreRes = await app.request(`/suggestions/${suggestion.id}/ignore`, { method: 'POST' }, env);
    expect(ignoreRes.status).toBe(200);
    const ignored = (await ignoreRes.json()) as { status: string };
    expect(ignored.status).toBe('ignored');
  });

  // The previous "runs the P0 flow" mega-test was retired in MVP-1: it asserted
  // the bespoke `event: card / event: done` SSE format which the /plan endpoint
  // no longer emits (now uses AI SDK UI Stream). Plan coverage moved to
  // test/plan-agent.test.ts. The gen-jobs / export pieces will be re-tested
  // standalone in MVP-2 when the queue-backed image pipeline lands.
});
