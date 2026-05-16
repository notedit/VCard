import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { app } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { deckCards } from '../src/db/schema.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);
const env = { DATABASE_URL };
const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
const MISSING_UUID = '99999999-9999-4999-8999-999999999999';

async function truncateAll() {
  await db.execute(sql`TRUNCATE TABLE decks, deck_cards, generation_jobs, chat_messages, activity_logs RESTART IDENTITY CASCADE`);
}

async function createTestDeck(overrides: Record<string, unknown> = {}) {
  const res = await app.request(
    '/decks',
    {
      method: 'POST',
      body: JSON.stringify({
        userId: TEST_USER_ID,
        prompt: '一个测试主题',
        cardCount: 3,
        ...overrides,
      }),
    },
    env,
  );
  const body = (await res.json()) as { deck: { id: string }; cards: Array<{ id: string; index: number }> };
  return body;
}

describe('vCard API: health & list', () => {
  beforeEach(truncateAll);

  it('returns 200 from /health', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('vcard-api');
  });

  it('rejects /decks list without userId query', async () => {
    const res = await app.request('/decks', {}, env);
    expect(res.status).toBe(400);
  });

  it('lists decks owned by a user, ordered desc by updatedAt', async () => {
    await createTestDeck({ prompt: 'A' });
    await createTestDeck({ prompt: 'B' });
    const res = await app.request(`/decks?userId=${TEST_USER_ID}`, {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { decks: Array<{ prompt: string }> };
    expect(body.decks).toHaveLength(2);
    expect(['A', 'B']).toContain(body.decks[0].prompt);
  });
});

describe('vCard API: 404 paths', () => {
  beforeEach(truncateAll);

  it('returns 404 when fetching a missing deck', async () => {
    const res = await app.request(`/decks/${MISSING_UUID}`, {}, env);
    expect(res.status).toBe(404);
  });

  it('returns 404 when patching a missing deck', async () => {
    const res = await app.request(
      `/decks/${MISSING_UUID}`,
      { method: 'PATCH', body: JSON.stringify({ title: 'x' }) },
      env,
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when patching a card on missing deck', async () => {
    const { cards } = await createTestDeck();
    // wrong deck id with valid card id → 404 because we filter by deckId
    const res = await app.request(
      `/decks/${MISSING_UUID}/cards/${cards[0].id}`,
      { method: 'PATCH', body: JSON.stringify({ version: 1, title: 'x' }) },
      env,
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleting a missing card', async () => {
    const { deck } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/cards/${MISSING_UUID}`,
      { method: 'DELETE' },
      env,
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when chat is sent on missing deck', async () => {
    const res = await app.request(
      `/decks/${MISSING_UUID}/chat`,
      { method: 'POST', body: JSON.stringify({ message: 'hi' }) },
      env,
    );
    expect(res.status).toBe(404);
  });
});

describe('vCard API: input validation (zod)', () => {
  beforeEach(truncateAll);

  it('rejects deck create without userId', async () => {
    const res = await app.request(
      '/decks',
      { method: 'POST', body: JSON.stringify({ prompt: 'x' }) },
      env,
    );
    expect(res.status).toBe(400);
  });

  it('rejects unknown card layout', async () => {
    const { deck } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/cards`,
      { method: 'POST', body: JSON.stringify({ layout: 'invalid' }) },
      env,
    );
    expect(res.status).toBe(400);
  });

  it('rejects unknown aspect ratio', async () => {
    const res = await app.request(
      '/decks',
      {
        method: 'POST',
        body: JSON.stringify({
          userId: TEST_USER_ID,
          prompt: 'p',
          aspectRatio: '5:7',
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it('rejects card patch missing version', async () => {
    const { deck, cards } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/cards/${cards[0].id}`,
      { method: 'PATCH', body: JSON.stringify({ title: 'x' }) },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe('vCard API: deck update', () => {
  beforeEach(truncateAll);

  it('PATCH /decks/:id updates language and settings, merging existing settings', async () => {
    const { deck } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          language: 'en',
          settings: { theme: 'paper' },
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deck: { language: string; settings: { theme: string; template: string } } };
    expect(body.deck.language).toBe('en');
    expect(body.deck.settings.theme).toBe('paper');
    // 旧 template 应保留（合并而不是替换）
    expect(body.deck.settings.template).toBeTruthy();
  });

  it('PATCH /decks/:id with status moves the deck through lifecycle', async () => {
    const { deck } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}`,
      { method: 'PATCH', body: JSON.stringify({ status: 'styled' }) },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deck: { status: string } };
    expect(body.deck.status).toBe('styled');
  });
});

describe('vCard API: card CRUD edges', () => {
  beforeEach(truncateAll);

  it('POST /cards inserts at requested index and shifts later cards', async () => {
    const { deck, cards } = await createTestDeck();
    const originalIds = cards.map((c) => c.id);

    const res = await app.request(
      `/decks/${deck.id}/cards`,
      { method: 'POST', body: JSON.stringify({ index: 1, title: '插入', bullets: ['x'] }) },
      env,
    );
    expect(res.status).toBe(201);
    const newCard = (await res.json()) as { id: string; index: number };
    expect(newCard.index).toBe(1);

    const all = await db
      .select()
      .from(deckCards)
      .where(sql`${deckCards.deckId} = ${deck.id}`);
    const sorted = all.sort((a, b) => a.index - b.index);
    expect(sorted).toHaveLength(4);
    // 原第 1 张应被推到 index=2
    expect(sorted[2].id).toBe(originalIds[1]);
  });

  it('DELETE /cards/:id renumbers subsequent indexes', async () => {
    const { deck, cards } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/cards/${cards[1].id}`,
      { method: 'DELETE' },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: Array<{ index: number }> };
    expect(body.cards.map((c) => c.index)).toEqual([0, 1]);
    expect(body.cards).toHaveLength(2);
  });

  it('PATCH /cards/reorder rejects orders that miss cards', async () => {
    const { deck, cards } = await createTestDeck();
    const partial = cards.slice(0, 2).map((c) => c.id);
    const res = await app.request(
      `/decks/${deck.id}/cards/reorder`,
      { method: 'PATCH', body: JSON.stringify({ order: partial }) },
      env,
    );
    expect(res.status).toBe(400);
  });

  it('PATCH /cards/reorder applies a new order when ids match', async () => {
    const { deck, cards } = await createTestDeck();
    const reversed = [...cards].reverse().map((c) => c.id);
    const res = await app.request(
      `/decks/${deck.id}/cards/reorder`,
      { method: 'PATCH', body: JSON.stringify({ order: reversed }) },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: Array<{ id: string }> };
    expect(body.cards.map((c) => c.id)).toEqual(reversed);
  });
});

describe('vCard API: chat apply actions', () => {
  beforeEach(truncateAll);

  it('apply title writes the patch.title verbatim', async () => {
    const { deck, cards } = await createTestDeck();
    const target = cards[0];
    const res = await app.request(
      `/decks/${deck.id}/chat/apply`,
      {
        method: 'POST',
        body: JSON.stringify({
          cardId: target.id,
          action: 'title',
          version: 1,
          patch: { title: 'GPT-5：发布与争议' },
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { title: string; version: number; userEdited: boolean };
    expect(updated.title).toBe('GPT-5：发布与争议');
    expect(updated.version).toBe(2);
    expect(updated.userEdited).toBe(true);
  });

  it('apply tone returns 200 and bumps version', async () => {
    const { deck, cards } = await createTestDeck();
    const target = cards[0];
    const res = await app.request(
      `/decks/${deck.id}/chat/apply`,
      {
        method: 'POST',
        body: JSON.stringify({
          cardId: target.id,
          action: 'tone',
          version: 1,
          patch: { title: '一句更克制的标题' },
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { version: number };
    expect(updated.version).toBe(2);
  });

  it('apply with stale version returns 409', async () => {
    const { deck, cards } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/chat/apply`,
      {
        method: 'POST',
        body: JSON.stringify({
          cardId: cards[0].id,
          action: 'bullet',
          version: 99,
          patch: { bullets: ['x'] },
        }),
      },
      env,
    );
    expect(res.status).toBe(409);
  });

  it('apply rejects request missing patch field', async () => {
    const { deck, cards } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/chat/apply`,
      {
        method: 'POST',
        body: JSON.stringify({ cardId: cards[0].id, action: 'title', version: 1 }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it('apply rejects empty patch (no title or bullets)', async () => {
    const { deck, cards } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/chat/apply`,
      {
        method: 'POST',
        body: JSON.stringify({ cardId: cards[0].id, action: 'title', version: 1, patch: {} }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe('vCard API: generate edges', () => {
  beforeEach(truncateAll);

  it('returns 409 when generating a deck with no cards', async () => {
    const { deck } = await createTestDeck();
    // 删空所有卡片
    await db.execute(sql`DELETE FROM deck_cards WHERE deck_id = ${deck.id}`);

    const res = await app.request(
      `/decks/${deck.id}/generate`,
      { method: 'POST', body: JSON.stringify({}) },
      env,
    );
    expect(res.status).toBe(409);
  });

  it('returns 400 when cardIds mix real and unknown ids', async () => {
    const { deck, cards } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/generate`,
      { method: 'POST', body: JSON.stringify({ cardIds: [cards[0].id, MISSING_UUID] }) },
      env,
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 when all referenced cardIds are unknown (no cards selected)', async () => {
    const { deck } = await createTestDeck();
    const res = await app.request(
      `/decks/${deck.id}/generate`,
      { method: 'POST', body: JSON.stringify({ cardIds: [MISSING_UUID] }) },
      env,
    );
    expect(res.status).toBe(409);
  });
});
