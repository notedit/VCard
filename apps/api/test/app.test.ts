import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { app } from '../src/app.js';
import { createDb } from '../src/db/client.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);
const env = { DATABASE_URL };

async function truncateAll() {
  await db.execute(
    sql`TRUNCATE TABLE projects, skills, change_logs RESTART IDENTITY CASCADE`,
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

    // 2. agent inserts a card via internal endpoint
    const cardRes = await app.request(
      '/internal/cards',
      {
        method: 'POST',
        body: JSON.stringify({
          projectId: project.id,
          index: 0,
          role: 'cover',
          title: 't',
          body: 'b',
          version: 1,
        }),
      },
      env,
    );
    expect(cardRes.status).toBe(201);
    const card = (await cardRes.json()) as { id: string; version: number };

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
      await app.request(
        '/internal/cards',
        {
          method: 'POST',
          body: JSON.stringify({
            projectId: project.id,
            index: idx,
            role: 'argument',
            title: `c${idx}`,
            body: '',
            version: 1,
          }),
        },
        env,
      );
    }

    const res = await app.request(`/projects/${project.id}`, {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: { index: number }[] };
    expect(body.cards.map((c) => c.index)).toEqual([0, 1, 2]);
  });
});
