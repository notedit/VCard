import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { app, flushBackgroundTasks } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { chatMessages, deckCards, decks, generationJobs } from '../src/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);
const env = { DATABASE_URL };
const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

async function truncateAll() {
  await db.execute(sql`TRUNCATE TABLE decks, deck_cards, generation_jobs, chat_messages, activity_logs RESTART IDENTITY CASCADE`);
}

describe('vCard deck API', () => {
  beforeEach(truncateAll);

  it('creates a deck with generated outline cards', async () => {
    const res = await app.request(
      '/decks',
      {
        method: 'POST',
        body: JSON.stringify({
          userId: TEST_USER_ID,
          prompt: '介绍 OpenAI Codex 最近发布的新能力',
          mode: 'html',
          cardCount: 5,
          aspectRatio: '4:5',
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as { deck: { id: string; status: string; cardCount: number }; cards: Array<{ index: number }> };
    expect(body.deck.status).toBe('outlined');
    expect(body.deck.cardCount).toBe(5);
    expect(body.cards.map((card) => card.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('patches a card with optimistic locking', async () => {
    const deck = await createDeck();
    const [card] = await db.select().from(deckCards).where(sql`${deckCards.deckId} = ${deck.id}`);

    const okRes = await app.request(
      `/decks/${deck.id}/cards/${card.id}`,
      { method: 'PATCH', body: JSON.stringify({ version: 1, title: '新版标题', bullets: ['第一点'] }) },
      env,
    );
    expect(okRes.status).toBe(200);
    const updated = (await okRes.json()) as { title: string; version: number; userEdited: boolean };
    expect(updated.title).toBe('新版标题');
    expect(updated.version).toBe(2);
    expect(updated.userEdited).toBe(true);

    const conflictRes = await app.request(
      `/decks/${deck.id}/cards/${card.id}`,
      { method: 'PATCH', body: JSON.stringify({ version: 1, title: '冲突标题' }) },
      env,
    );
    expect(conflictRes.status).toBe(409);
  });

  it('replaces outline and keeps ordered card indexes', async () => {
    const deck = await createDeck();
    const res = await app.request(
      `/decks/${deck.id}/outline`,
      {
        method: 'POST',
        body: JSON.stringify({
          cards: [
            { title: '封面', bullets: ['a'], layout: 'cover' },
            { title: '要点', bullets: ['b'], layout: 'list' },
            { title: '结尾', bullets: ['c'], layout: 'closer' },
          ],
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { deck: { cardCount: number }; cards: Array<{ index: number; title: string }> };
    expect(body.deck.cardCount).toBe(3);
    expect(body.cards.map((card) => `${card.index}:${card.title}`)).toEqual(['0:封面', '1:要点', '2:结尾']);
  });

  it('generates image snapshots asynchronously with placeholder images', async () => {
    const deck = await createDeck({ mode: 'image' });
    const res = await app.request(`/decks/${deck.id}/generate`, { method: 'POST', body: JSON.stringify({}) }, env);
    expect(res.status).toBe(202);
    const submitted = (await res.json()) as { job: { id: string; status: string } };
    expect(submitted.job.status).toBe('running');

    // 立即查 deck.status 应该是 generating
    const intermediate = await db.select().from(decks);
    expect(intermediate[0].status).toBe('generating');

    // 等待后台任务跑完
    await flushBackgroundTasks();

    const jobs = await db.select().from(generationJobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('done');

    const stored = await db.select().from(decks);
    expect(stored[0].status).toBe('ready');

    const cards = await db.select().from(deckCards);
    expect(cards.every((card) => typeof card.imagePrompt === 'string')).toBe(true);
    expect(cards.every((card) => typeof card.imageUrl === 'string' && card.imageUrl.startsWith('data:'))).toBe(true);
    expect(cards.every((card) => card.render.imageSource === 'placeholder')).toBe(true);
  });

  it('generates html render snapshots synchronously', async () => {
    const deck = await createDeck({ mode: 'html' });
    const res = await app.request(`/decks/${deck.id}/generate`, { method: 'POST', body: JSON.stringify({}) }, env);
    expect(res.status).toBe(202);

    const jobs = await db.select().from(generationJobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('done');

    const stored = await db.select().from(decks);
    expect(stored[0].status).toBe('ready');

    const cards = await db.select().from(deckCards);
    expect(cards.every((card) => card.render.mode === 'html')).toBe(true);
  });

  it('stores chat messages and applies assistant actions with explicit patch', async () => {
    const deck = await createDeck();
    const [card] = await db.select().from(deckCards).where(sql`${deckCards.deckId} = ${deck.id}`);

    const chatRes = await app.request(
      `/decks/${deck.id}/chat`,
      { method: 'POST', body: JSON.stringify({ cardId: card.id, message: '标题更口语一点' }) },
      env,
    );
    expect(chatRes.status).toBe(200);
    const chatBody = (await chatRes.json()) as {
      assistantMessage: { actions: Array<{ kind: string; patch?: { title?: string; bullets?: string[] } }> };
    };
    // 测试环境没有真实 LLM key，走 localChatReply fallback：3 条固定 actions，每条都带 patch
    expect(chatBody.assistantMessage.actions.map((action) => action.kind)).toEqual(['title', 'bullet', 'tone']);
    expect(chatBody.assistantMessage.actions.every((a) => a.patch !== undefined)).toBe(true);

    const messages = await db.select().from(chatMessages);
    expect(messages).toHaveLength(2);

    // apply 时由前端把 LLM 给的 patch 传回来；后端直接落库，不再做规则推导。
    const applyRes = await app.request(
      `/decks/${deck.id}/chat/apply`,
      {
        method: 'POST',
        body: JSON.stringify({
          cardId: card.id,
          action: 'bullet',
          version: card.version,
          patch: { bullets: [...card.bullets, '一条具体的新要点'] },
        }),
      },
      env,
    );
    expect(applyRes.status).toBe(200);
    const updated = (await applyRes.json()) as { bullets: string[]; version: number; userEdited: boolean };
    expect(updated.bullets.at(-1)).toBe('一条具体的新要点');
    expect(updated.bullets.length).toBe(card.bullets.length + 1);
    expect(updated.version).toBe(2);
    expect(updated.userEdited).toBe(true);
  });

  it('exports a deck as JSON manifest', async () => {
    const deck = await createDeck();
    const res = await app.request(`/decks/${deck.id}/export`, { method: 'POST' }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { exportedAt: string; files: unknown[] };
    expect(body.exportedAt).toBeTruthy();
    expect(body.files).toHaveLength(7);
  });
});

async function createDeck(overrides: Record<string, unknown> = {}) {
  const res = await app.request(
    '/decks',
    {
      method: 'POST',
      body: JSON.stringify({
        userId: TEST_USER_ID,
        prompt: '介绍 OpenAI Codex 最近发布的新能力',
        cardCount: 7,
        ...overrides,
      }),
    },
    env,
  );
  const body = (await res.json()) as { deck: { id: string } };
  return body.deck;
}
