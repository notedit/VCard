import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { app, flushBackgroundTasks } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { deckCards, decks, generationJobs } from '../src/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);
const env = { DATABASE_URL };
const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

async function truncateAll() {
  await db.execute(
    sql`TRUNCATE TABLE decks, deck_cards, generation_jobs, chat_messages, activity_logs RESTART IDENTITY CASCADE`,
  );
}

async function createDeck(overrides: Record<string, unknown> = {}) {
  const res = await app.request(
    '/decks',
    {
      method: 'POST',
      body: JSON.stringify({
        userId: TEST_USER_ID,
        prompt: '测试主题',
        cardCount: 3,
        mode: 'image',
        ...overrides,
      }),
    },
    env,
  );
  return (await res.json()) as { deck: { id: string }; cards: Array<{ id: string; index: number }> };
}

describe('image generation: async job', () => {
  beforeEach(async () => {
    await truncateAll();
    await flushBackgroundTasks();
  });

  it('returns 202 immediately with running job and queued cardJobs', async () => {
    const { deck, cards } = await createDeck();
    const res = await app.request(`/decks/${deck.id}/generate`, { method: 'POST', body: '{}' }, env);
    expect(res.status).toBe(202);
    const body = (await res.json()) as {
      job: { id: string; status: string; result: { cardJobs: Array<{ cardId: string; status: string }> } };
    };
    expect(body.job.status).toBe('running');
    expect(body.job.result.cardJobs).toHaveLength(cards.length);
    expect(body.job.result.cardJobs.every((cj) => cj.status === 'queued')).toBe(true);

    // deck 进入 generating 状态，前端应该看见 status 不再是 outlined
    const stored = await db.select().from(decks);
    expect(['generating', 'ready']).toContain(stored[0].status);

    await flushBackgroundTasks();
  });

  it('GET /decks/:id/generations/:jobId returns the job with progress', async () => {
    const { deck } = await createDeck();
    const submit = await app.request(`/decks/${deck.id}/generate`, { method: 'POST', body: '{}' }, env);
    const submitBody = (await submit.json()) as { job: { id: string } };
    const jobId = submitBody.job.id;

    await flushBackgroundTasks();

    const res = await app.request(`/decks/${deck.id}/generations/${jobId}`, {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      job: { status: string; result: { cardJobs: Array<{ cardId: string; status: string }> } };
    };
    expect(body.job.status).toBe('done');
    expect(body.job.result.cardJobs.every((cj) => cj.status === 'done')).toBe(true);
  });

  it('GET on missing job id returns 404', async () => {
    const { deck } = await createDeck();
    const res = await app.request(`/decks/${deck.id}/generations/99999999-9999-4999-8999-999999999999`, {}, env);
    expect(res.status).toBe(404);
  });

  it('eventually writes placeholder image data URLs to every card', async () => {
    const { deck } = await createDeck();
    await app.request(`/decks/${deck.id}/generate`, { method: 'POST', body: '{}' }, env);
    await flushBackgroundTasks();

    const cards = await db.select().from(deckCards);
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.imageUrl?.startsWith('data:image/svg+xml'))).toBe(true);
    expect(cards.every((card) => typeof card.imagePrompt === 'string' && card.imagePrompt.length > 0)).toBe(true);

    const finalDeck = await db.select().from(decks);
    expect(finalDeck[0].status).toBe('ready');
    const job = await db.select().from(generationJobs);
    expect(job[0].status).toBe('done');
    expect(job[0].error).toBeNull();
  });

  it('only regenerates the requested cards when cardIds are provided', async () => {
    const { deck, cards } = await createDeck();
    // 先全部跑一遍
    await app.request(`/decks/${deck.id}/generate`, { method: 'POST', body: '{}' }, env);
    await flushBackgroundTasks();
    const before = await db.select().from(deckCards);
    const original = new Map(before.map((c) => [c.id, c.imageUrl]));

    // 删掉第 1 张的 imageUrl，模拟"用户想重跑这张"
    await db.update(deckCards).set({ imageUrl: null }).where(sql`${deckCards.id} = ${cards[1].id}`);

    const res = await app.request(
      `/decks/${deck.id}/generate`,
      { method: 'POST', body: JSON.stringify({ cardIds: [cards[1].id] }) },
      env,
    );
    expect(res.status).toBe(202);
    await flushBackgroundTasks();

    const after = await db.select().from(deckCards);
    const target = after.find((c) => c.id === cards[1].id);
    expect(target?.imageUrl?.startsWith('data:image/svg+xml')).toBe(true);
    // 其他卡片的 imageUrl 没变
    for (const card of after) {
      if (card.id === cards[1].id) continue;
      expect(card.imageUrl).toBe(original.get(card.id));
    }
  });
});
