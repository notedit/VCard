import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z, ZodError } from 'zod';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  resolveTemplate,
  type ActivityActor,
  type ActivityTarget,
  type CardLayout,
  type DeckMode,
  type DeckSettings,
  type Density,
} from '@vcard/shared-types';
import { createDb, type Db } from './db/client.js';
import { activityLogs, chatMessages, deckCards, decks, generationJobs } from './db/schema.js';
import type { DeckCardRow, DeckRow } from './db/schema.js';
import { generateOutline, lintCards, stripSlop, type OutlineCard } from './llm/outline.js';
import { generateChatReply } from './llm/chat.js';
import { generateCardImage } from './image/gen-image.js';

export type ApiBindings = {
  DATABASE_URL: string;
  AIHUBMIX_API_KEY?: string;
  TAVILY_API_KEY?: string;
  OPENAI_API_KEY?: string;
};

// 一次最多并发跑 N 张卡片图像生成。OpenAI rate limit 与 Workers wall-time 都是约束。
const IMAGE_CONCURRENCY = 3;

type CardJobState = {
  cardId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
  finishedAt?: string;
};

type ImageJobResult = {
  cardJobs: CardJobState[];
};

type Variables = {
  db: Db;
};

const deckModeSchema = z.enum(['html', 'image']);
const aspectRatioSchema = z.enum(['1:1', '4:5', '9:16']);
const languageSchema = z.enum(['zh-CN', 'zh-TW', 'en', 'ja']);
const densitySchema = z.enum(['compact', 'standard', 'detailed', 'rich']);
const cardLayoutSchema = z.enum(['cover', 'list', 'quote', 'stat', 'closer']);

const settingsSchema = z.object({
  template: z.string().min(1).default('极简专业'),
  theme: z.string().min(1).default('mono'),
  density: densitySchema.default('standard'),
  layout: z.string().min(1).default('自动匹配'),
  imageStyle: z.string().min(1).default('editorial'),
});

const createDeckSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).max(1000),
  mode: deckModeSchema.default('html'),
  cardCount: z.number().int().min(1).max(24).default(7),
  aspectRatio: aspectRatioSchema.default('4:5'),
  language: languageSchema.default('zh-CN'),
  settings: settingsSchema.partial().default({}),
});

const updateDeckSchema = z.object({
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).max(1000).optional(),
  mode: deckModeSchema.optional(),
  cardCount: z.number().int().min(1).max(24).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  language: languageSchema.optional(),
  settings: settingsSchema.partial().optional(),
  status: z.enum(['draft', 'outlined', 'styled', 'generating', 'ready', 'exported']).optional(),
});

const upsertOutlineSchema = z.object({
  prompt: z.string().min(1).max(1000).optional(),
  cardCount: z.number().int().min(1).max(24).optional(),
  cards: z
    .array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string()).default([]),
        layout: cardLayoutSchema.default('list'),
        note: z.string().optional(),
      }),
    )
    .optional(),
});

const createCardSchema = z.object({
  index: z.number().int().min(0).optional(),
  title: z.string().min(1).default('新卡片'),
  bullets: z.array(z.string()).default(['补充一个要点']),
  layout: cardLayoutSchema.default('list'),
  note: z.string().optional(),
});

const patchCardSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  layout: cardLayoutSchema.optional(),
  note: z.string().nullable().optional(),
  locked: z.boolean().optional(),
});

const reorderCardsSchema = z.object({
  order: z.array(z.string().uuid()).min(1),
});

const generateSchema = z.object({
  mode: deckModeSchema.optional(),
  cardIds: z.array(z.string().uuid()).optional(),
});

const chatSchema = z.object({
  cardId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(1200),
});

const chatPatchSchema = z
  .object({
    title: z.string().min(1).max(80).optional(),
    bullets: z.array(z.string().min(1).max(200)).min(1).max(8).optional(),
  })
  .refine((p) => p.title !== undefined || p.bullets !== undefined, {
    message: 'patch must include at least one of: title, bullets',
  });

const applyChatActionSchema = z.object({
  cardId: z.string().uuid(),
  action: z.enum(['title', 'bullet', 'tone']),
  version: z.number().int().min(1),
  patch: chatPatchSchema,
});

export const app = new Hono<{ Bindings: ApiBindings; Variables: Variables }>();

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));

app.use('*', async (c, next) => {
  const url = c.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return c.json({ error: 'DATABASE_URL not configured' }, 500);
  c.set('db', createDb(url));
  await next();
});

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: 'invalid_request', issues: err.issues }, 400);
  }
  console.error(err);
  return c.json({ error: 'internal_error' }, 500);
});

app.get('/health', (c) => c.json({ ok: true, service: 'vcard-api' }));

app.get('/decks', async (c) => {
  const db = c.var.db;
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'user_id_required' }, 400);
  const rows = await db.select().from(decks).where(eq(decks.userId, userId)).orderBy(desc(decks.updatedAt));
  return c.json({ decks: rows });
});

app.post('/decks', async (c) => {
  const db = c.var.db;
  const body = createDeckSchema.parse(await c.req.json());
  const settings = normalizeSettings(body.settings);
  const [deck] = await db
    .insert(decks)
    .values({
      userId: body.userId,
      title: body.title ?? titleFromPrompt(body.prompt),
      prompt: body.prompt,
      mode: body.mode,
      cardCount: body.cardCount,
      aspectRatio: body.aspectRatio,
      language: body.language,
      settings,
      status: 'outlined',
    })
    .returning();

  const outline = await loadOutline({
    env: c.env,
    prompt: body.prompt,
    count: body.cardCount,
    language: body.language,
    settings,
  });
  await db.insert(deckCards).values(outline.map((card, index) => cardInsert(deck.id, card, index)));
  await writeActivity(db, deck.id, 'user', 'deck', deck.id, 'create_deck', null, { deck, cards: outline });

  return c.json(await loadDeck(db, deck.id), 201);
});

app.get('/decks/:id', async (c) => {
  const snapshot = await loadDeck(c.var.db, c.req.param('id'));
  if (!snapshot) return c.json({ error: 'not_found' }, 404);
  return c.json(snapshot);
});

app.patch('/decks/:id', async (c) => {
  const db = c.var.db;
  const id = c.req.param('id');
  const before = await db.query.decks.findFirst({ where: eq(decks.id, id) });
  if (!before) return c.json({ error: 'not_found' }, 404);

  const body = updateDeckSchema.parse(await c.req.json());
  const [updated] = await db
    .update(decks)
    .set({
      title: body.title ?? before.title,
      prompt: body.prompt ?? before.prompt,
      mode: body.mode ?? before.mode,
      cardCount: body.cardCount ?? before.cardCount,
      aspectRatio: body.aspectRatio ?? before.aspectRatio,
      language: body.language ?? before.language,
      settings: body.settings ? normalizeSettings({ ...before.settings, ...body.settings }) : before.settings,
      status: body.status ?? before.status,
      updatedAt: new Date(),
    })
    .where(eq(decks.id, id))
    .returning();

  await writeActivity(db, id, 'user', 'deck', id, 'update_deck', before, updated);
  return c.json(await loadDeck(db, id));
});

app.post('/decks/:id/outline', async (c) => {
  const db = c.var.db;
  const id = c.req.param('id');
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, id) });
  if (!deck) return c.json({ error: 'not_found' }, 404);

  const body = upsertOutlineSchema.parse(await c.req.json().catch(() => ({})));
  const prompt = body.prompt ?? deck.prompt;
  const outline =
    body.cards ??
    (await loadOutline({
      env: c.env,
      prompt,
      count: body.cardCount ?? deck.cardCount,
      language: deck.language,
      settings: deck.settings,
    }));

  const beforeCards = await listCards(db, id);
  await db.delete(deckCards).where(eq(deckCards.deckId, id));
  await db.insert(deckCards).values(outline.map((card, index) => cardInsert(id, card, index)));
  const [updatedDeck] = await db
    .update(decks)
    .set({ prompt, cardCount: outline.length, status: 'outlined', updatedAt: new Date() })
    .where(eq(decks.id, id))
    .returning();

  await writeActivity(db, id, 'assistant', 'deck', id, 'replace_outline', { deck, cards: beforeCards }, { deck: updatedDeck, cards: outline });
  return c.json(await loadDeck(db, id));
});

app.post('/decks/:id/cards', async (c) => {
  const db = c.var.db;
  const deckId = c.req.param('id');
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, deckId) });
  if (!deck) return c.json({ error: 'not_found' }, 404);

  const body = createCardSchema.parse(await c.req.json().catch(() => ({})));
  const cards = await listCards(db, deckId);
  const index = body.index ?? cards.length;
  await shiftCardIndexes(db, deckId, index);
  const [card] = await db
    .insert(deckCards)
    .values(cardInsert(deckId, body, index))
    .returning();
  await db.update(decks).set({ cardCount: cards.length + 1, updatedAt: new Date() }).where(eq(decks.id, deckId));
  await writeActivity(db, deckId, 'user', 'card', card.id, 'create_card', null, card);
  return c.json(card, 201);
});

app.patch('/decks/:id/cards/reorder', async (c) => {
  const db = c.var.db;
  const deckId = c.req.param('id');
  const { order } = reorderCardsSchema.parse(await c.req.json());
  const cards = await listCards(db, deckId);
  if (cards.length === 0) return c.json({ error: 'not_found' }, 404);
  const known = new Set(cards.map((card) => card.id));
  if (order.length !== cards.length || order.some((id) => !known.has(id))) {
    return c.json({ error: 'invalid_order' }, 400);
  }
  for (const [index, cardId] of order.entries()) {
    await db.update(deckCards).set({ index, updatedAt: new Date() }).where(and(eq(deckCards.deckId, deckId), eq(deckCards.id, cardId)));
  }
  await touchDeck(db, deckId);
  await writeActivity(db, deckId, 'user', 'deck', deckId, 'reorder_cards', cards.map((card) => card.id), order);
  return c.json(await loadDeck(db, deckId));
});

app.patch('/decks/:id/cards/:cardId', async (c) => {
  const db = c.var.db;
  const deckId = c.req.param('id');
  const cardId = c.req.param('cardId');
  const body = patchCardSchema.parse(await c.req.json());
  const before = await db.query.deckCards.findFirst({
    where: and(eq(deckCards.deckId, deckId), eq(deckCards.id, cardId)),
  });
  if (!before) return c.json({ error: 'not_found' }, 404);
  if (before.version !== body.version) return c.json({ error: 'version_conflict', expected: before.version }, 409);

  const [updated] = await db
    .update(deckCards)
    .set({
      title: body.title ?? before.title,
      bullets: body.bullets ?? before.bullets,
      layout: body.layout ?? before.layout,
      note: body.note === undefined ? before.note : body.note,
      locked: body.locked ?? before.locked,
      userEdited: true,
      version: before.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(deckCards.deckId, deckId), eq(deckCards.id, cardId), eq(deckCards.version, body.version)))
    .returning();
  if (!updated) {
    const fresh = await db.query.deckCards.findFirst({ where: eq(deckCards.id, cardId) });
    return c.json({ error: 'version_conflict', expected: fresh?.version ?? null }, 409);
  }
  await touchDeck(db, deckId);
  await writeActivity(db, deckId, 'user', 'card', cardId, 'patch_card', before, updated);
  return c.json(updated);
});

app.delete('/decks/:id/cards/:cardId', async (c) => {
  const db = c.var.db;
  const deckId = c.req.param('id');
  const cardId = c.req.param('cardId');
  const before = await db.query.deckCards.findFirst({ where: and(eq(deckCards.deckId, deckId), eq(deckCards.id, cardId)) });
  if (!before) return c.json({ error: 'not_found' }, 404);
  await db.delete(deckCards).where(eq(deckCards.id, cardId));
  await normalizeCardIndexes(db, deckId);
  const count = (await listCards(db, deckId)).length;
  await db.update(decks).set({ cardCount: count, updatedAt: new Date() }).where(eq(decks.id, deckId));
  await writeActivity(db, deckId, 'user', 'card', cardId, 'delete_card', before, null);
  return c.json(await loadDeck(db, deckId));
});

app.post('/decks/:id/generate', async (c) => {
  const db = c.var.db;
  const deckId = c.req.param('id');
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, deckId) });
  if (!deck) return c.json({ error: 'not_found' }, 404);
  const body = generateSchema.parse(await c.req.json().catch(() => ({})));
  const mode = body.mode ?? deck.mode;
  const cards = body.cardIds?.length ? await listCardsByIds(db, deckId, body.cardIds) : await listCards(db, deckId);
  if (cards.length === 0) return c.json({ error: 'no_cards' }, 409);
  if (body.cardIds && cards.length !== body.cardIds.length) return c.json({ error: 'unknown_card_ids' }, 400);

  // image mode 走异步路径。html mode 保留旧的同步快回。
  if (mode === 'image') {
    const initialResult: ImageJobResult = {
      cardJobs: cards.map((card) => ({ cardId: card.id, status: 'queued' })),
    };
    const [job] = await db
      .insert(generationJobs)
      .values({
        deckId,
        mode,
        status: 'running',
        startedAt: new Date(),
        requested: { cardIds: cards.map((card) => card.id), settings: deck.settings },
        result: initialResult,
      })
      .returning();
    await db.update(decks).set({ status: 'generating', mode, updatedAt: new Date() }).where(eq(decks.id, deckId));

    runInBackground(c, () =>
      runImageJob({
        env: c.env,
        databaseUrl: c.env?.DATABASE_URL ?? process.env.DATABASE_URL!,
        deckId,
        jobId: job.id,
        deck,
        cardIds: cards.map((card) => card.id),
      }),
    );

    return c.json({ job, deck: await loadDeck(db, deckId) }, 202);
  }

  // html mode：同步快回（仅写 render 元数据）。
  const [job] = await db
    .insert(generationJobs)
    .values({
      deckId,
      mode,
      status: 'running',
      startedAt: new Date(),
      requested: { cardIds: cards.map((card) => card.id), settings: deck.settings },
    })
    .returning();

  for (const card of cards) {
    await db
      .update(deckCards)
      .set(renderPatch(deck, card, mode))
      .where(eq(deckCards.id, card.id));
  }

  const result = { generatedCards: cards.length, mode };
  const [updatedJob] = await db
    .update(generationJobs)
    .set({ status: 'done', result, completedAt: new Date() })
    .where(eq(generationJobs.id, job.id))
    .returning();
  await db.update(decks).set({ status: 'ready', mode, updatedAt: new Date() }).where(eq(decks.id, deckId));
  await writeActivity(db, deckId, 'system', 'generation', job.id, 'generate_cards', null, updatedJob);
  return c.json({ job: updatedJob, deck: await loadDeck(db, deckId) }, 202);
});

app.get('/decks/:id/generations/:jobId', async (c) => {
  const deckId = c.req.param('id');
  const jobId = c.req.param('jobId');
  const job = await c.var.db.query.generationJobs.findFirst({
    where: and(eq(generationJobs.id, jobId), eq(generationJobs.deckId, deckId)),
  });
  if (!job) return c.json({ error: 'not_found' }, 404);
  return c.json({ job });
});

app.get('/decks/:id/generations', async (c) => {
  const deckId = c.req.param('id');
  const rows = await c.var.db.select().from(generationJobs).where(eq(generationJobs.deckId, deckId)).orderBy(desc(generationJobs.createdAt));
  return c.json({ generations: rows });
});

app.post('/decks/:id/chat', async (c) => {
  const db = c.var.db;
  const deckId = c.req.param('id');
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, deckId) });
  if (!deck) return c.json({ error: 'not_found' }, 404);
  const body = chatSchema.parse(await c.req.json());
  const card = body.cardId ? await db.query.deckCards.findFirst({ where: and(eq(deckCards.deckId, deckId), eq(deckCards.id, body.cardId)) }) : null;
  if (body.cardId && !card) return c.json({ error: 'card_not_found' }, 404);
  const targetCard = card ?? null;

  const [userMessage] = await db
    .insert(chatMessages)
    .values({ deckId, cardId: body.cardId ?? null, role: 'user', body: body.message, actions: [] })
    .returning();

  // 拉最近 10 条历史（user/assistant 都要，按时间序）作为对话上下文。
  // 注意：刚插入的 userMessage 也会被拉到，会重复，所以查询时过滤掉它。
  const cardScope = body.cardId
    ? eq(chatMessages.cardId, body.cardId)
    : isNull(chatMessages.cardId);
  const recentHistory = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.deckId, deckId), cardScope))
    .orderBy(desc(chatMessages.createdAt))
    .limit(11);
  const history = recentHistory
    .filter((m) => m.id !== userMessage.id)
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', body: m.body }));

  const cardCount = (await listCards(db, deckId)).length;
  const reply = await loadChatReply({
    env: c.env,
    message: body.message,
    deck,
    card: targetCard,
    cardCount,
    history,
  });

  const [assistantMessage] = await db
    .insert(chatMessages)
    .values({ deckId, cardId: body.cardId ?? null, role: 'assistant', body: reply.body, actions: reply.actions })
    .returning();
  await writeActivity(db, deckId, 'assistant', 'chat', assistantMessage.id, 'chat_reply', userMessage, assistantMessage);
  return c.json({ userMessage, assistantMessage });
});

app.post('/decks/:id/chat/apply', async (c) => {
  const db = c.var.db;
  const deckId = c.req.param('id');
  const body = applyChatActionSchema.parse(await c.req.json());
  const card = await db.query.deckCards.findFirst({ where: and(eq(deckCards.deckId, deckId), eq(deckCards.id, body.cardId)) });
  if (!card) return c.json({ error: 'not_found' }, 404);
  if (card.version !== body.version) return c.json({ error: 'version_conflict', expected: card.version }, 409);
  // 直接落库 LLM 给出的 patch，不再走任何字符串规则。
  const updateSet: Record<string, unknown> = {
    userEdited: true,
    version: card.version + 1,
    updatedAt: new Date(),
  };
  if (body.patch.title !== undefined) updateSet.title = body.patch.title;
  if (body.patch.bullets !== undefined) updateSet.bullets = body.patch.bullets;
  const [updated] = await db
    .update(deckCards)
    .set(updateSet)
    .where(and(eq(deckCards.id, card.id), eq(deckCards.version, body.version)))
    .returning();
  if (!updated) return c.json({ error: 'version_conflict', expected: null }, 409);
  await touchDeck(db, deckId);
  await writeActivity(db, deckId, 'assistant', 'card', card.id, `apply_chat_action:${body.action}`, card, updated);
  return c.json(updated);
});

app.get('/decks/:id/chat', async (c) => {
  const deckId = c.req.param('id');
  const rows = await c.var.db.select().from(chatMessages).where(eq(chatMessages.deckId, deckId)).orderBy(asc(chatMessages.createdAt));
  return c.json({ messages: rows });
});

app.post('/decks/:id/export', async (c) => {
  const db = c.var.db;
  const deckId = c.req.param('id');
  const snapshot = await loadDeck(db, deckId);
  if (!snapshot) return c.json({ error: 'not_found' }, 404);
  if (snapshot.cards.length === 0) return c.json({ error: 'no_cards' }, 409);
  await db.update(decks).set({ status: 'exported', updatedAt: new Date() }).where(eq(decks.id, deckId));
  const exportPayload = {
    ...snapshot,
    exportedAt: new Date().toISOString(),
    files: snapshot.cards.map((card) => ({
      name: `${String(card.index + 1).padStart(2, '0')}_${card.layout}.json`,
      card,
    })),
  };
  await writeActivity(db, deckId, 'system', 'deck', deckId, 'export_deck', null, { cardCount: snapshot.cards.length });
  return c.json(exportPayload);
});

async function loadDeck(db: Db, deckId: string) {
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, deckId) });
  if (!deck) return null;
  const [cards, latestGeneration, messages] = await Promise.all([
    listCards(db, deckId),
    db.query.generationJobs.findFirst({ where: eq(generationJobs.deckId, deckId), orderBy: desc(generationJobs.createdAt) }),
    db.select().from(chatMessages).where(eq(chatMessages.deckId, deckId)).orderBy(asc(chatMessages.createdAt)),
  ]);
  return { deck, cards, latestGeneration: latestGeneration ?? null, messages };
}

async function listCards(db: Db, deckId: string) {
  return db.select().from(deckCards).where(eq(deckCards.deckId, deckId)).orderBy(asc(deckCards.index));
}

async function listCardsByIds(db: Db, deckId: string, cardIds: string[]) {
  const rows = await db
    .select()
    .from(deckCards)
    .where(and(eq(deckCards.deckId, deckId), inArray(deckCards.id, cardIds)))
    .orderBy(asc(deckCards.index));
  const order = new Map(cardIds.map((id, index) => [id, index]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

async function shiftCardIndexes(db: Db, deckId: string, fromIndex: number) {
  const cards = await listCards(db, deckId);
  for (const card of cards.filter((item) => item.index >= fromIndex).reverse()) {
    await db.update(deckCards).set({ index: card.index + 1 }).where(eq(deckCards.id, card.id));
  }
}

async function normalizeCardIndexes(db: Db, deckId: string) {
  const cards = await listCards(db, deckId);
  for (const [index, card] of cards.entries()) {
    if (card.index !== index) await db.update(deckCards).set({ index }).where(eq(deckCards.id, card.id));
  }
}

async function touchDeck(db: Db, deckId: string) {
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId));
}

async function writeActivity(
  db: Db,
  deckId: string,
  actor: ActivityActor,
  target: ActivityTarget,
  targetId: string | null,
  action: string,
  before: unknown,
  after: unknown,
) {
  await db.insert(activityLogs).values({ deckId, actor, target, targetId, action, before, after });
}

function normalizeSettings(input: Partial<DeckSettings>): DeckSettings {
  const spec = resolveTemplate(input.template);
  return {
    template: input.template ?? spec.name,
    theme: input.theme ?? spec.defaultTheme,
    density: (input.density ?? 'standard') as Density,
    layout: input.layout ?? '自动匹配',
    imageStyle: input.imageStyle ?? spec.defaultImageStyle,
  };
}

function titleFromPrompt(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}...` : cleaned;
}

async function loadOutline(args: {
  env: ApiBindings;
  prompt: string;
  count: number;
  language: DeckRow['language'];
  settings: DeckSettings;
}): Promise<OutlineCard[]> {
  if (!args.env.AIHUBMIX_API_KEY) {
    console.warn('[llm] AIHUBMIX_API_KEY missing, using local outline template');
    return makeOutline(args.prompt, args.count);
  }
  try {
    return await generateOutline({
      prompt: args.prompt,
      count: args.count,
      language: args.language,
      settings: args.settings,
      env: { AIHUBMIX_API_KEY: args.env.AIHUBMIX_API_KEY, TAVILY_API_KEY: args.env.TAVILY_API_KEY },
    });
  } catch (err) {
    console.error('[llm] outline generation failed, falling back to template', err);
    return makeOutline(args.prompt, args.count);
  }
}

function makeOutline(prompt: string, count: number) {
  const topic = titleFromPrompt(prompt);
  const middleLayouts: CardLayout[] = ['list', 'list', 'quote', 'list', 'stat'];
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) {
      return {
        title: `${topic}：一套看懂`,
        bullets: ['先给结论，再拆关键变化', '适合做资讯和知识分享封面'],
        layout: 'cover' as CardLayout,
      };
    }
    if (index === count - 1) {
      return {
        title: '一句话总结',
        bullets: ['把复杂信息拆成可保存、可转发的卡片', '下一步是根据平台反馈继续迭代'],
        layout: 'closer' as CardLayout,
      };
    }
    return {
      title: outlineTitle(index),
      bullets: [
        `${topic} 的关键判断之一`,
        '用一句话说清楚变化、影响和行动建议',
        '避免堆信息，每张卡只承载一个观点',
      ],
      layout: middleLayouts[(index - 1) % middleLayouts.length],
    };
  });
}

function outlineTitle(index: number) {
  const titles = ['先讲用户能得到什么', '把变化拆成三个层级', '给一个具体应用场景', '补充数据或判断标准', '收束到行动建议'];
  return titles[(index - 1) % titles.length];
}

function cardInsert(deckId: string, card: { title: string; bullets: string[]; layout?: CardLayout; note?: string }, index: number) {
  return {
    deckId,
    index,
    title: card.title,
    bullets: card.bullets,
    layout: card.layout ?? ('list' as CardLayout),
    note: card.note,
  };
}

// Workers 上必须用 ctx.waitUntil 让后台 promise 在响应返回后存活；Node 下没有 executionCtx，
// 直接 fire-and-forget 即可（本地开发 / Render / Fly 跑 Node entry 都走这条路径）。
// 测试场景下需要等所有 in-flight 任务完成，可调用 flushBackgroundTasks()。
type WaitUntilLike = { waitUntil(promise: Promise<unknown>): void };
const pendingBackgroundTasks = new Set<Promise<unknown>>();

export async function flushBackgroundTasks(): Promise<void> {
  while (pendingBackgroundTasks.size > 0) {
    const snapshot = Array.from(pendingBackgroundTasks);
    await Promise.allSettled(snapshot);
  }
}

function runInBackground(c: { executionCtx?: WaitUntilLike }, fn: () => Promise<void>) {
  const promise = fn().catch((err) => console.error('[background-task]', err));
  // Hono 的 c.executionCtx 在 Workers 之外的环境（Node、Bun、test）会抛 "no ExecutionContext"
  // 而不是返回 undefined，所以这里用 try 包起来。
  let ctx: WaitUntilLike | undefined;
  try {
    ctx = c.executionCtx;
  } catch {
    ctx = undefined;
  }
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
    return;
  }
  pendingBackgroundTasks.add(promise);
  promise.finally(() => pendingBackgroundTasks.delete(promise));
}

// 单个图像 job 的后台执行：并发拿卡片，调用 generateCardImage，逐张写回 image_url + 更新进度。
async function runImageJob(args: {
  env: ApiBindings;
  databaseUrl: string;
  deckId: string;
  jobId: string;
  deck: DeckRow;
  cardIds: string[];
}) {
  const db = createDb(args.databaseUrl);
  const queue = [...args.cardIds];
  const inflight = new Set<Promise<void>>();

  const runOne = async (cardId: string) => {
    await markCardJobStatus(db, args.jobId, cardId, 'running');
    const card = await db.query.deckCards.findFirst({ where: eq(deckCards.id, cardId) });
    if (!card) {
      await markCardJobStatus(db, args.jobId, cardId, 'failed', 'card_missing');
      return;
    }
    try {
      const result = await generateCardImage({
        prompt: args.deck.prompt,
        cardTitle: card.title,
        cardIndex: card.index,
        aspectRatio: args.deck.aspectRatio,
        settings: args.deck.settings,
        env: {
          AIHUBMIX_API_KEY: args.env.AIHUBMIX_API_KEY,
          OPENAI_API_KEY: args.env.OPENAI_API_KEY,
        },
      });
      await db
        .update(deckCards)
        .set({
          imageUrl: result.imageUrl,
          imagePrompt: result.imagePrompt,
          render: {
            mode: 'image',
            aspectRatio: args.deck.aspectRatio,
            theme: args.deck.settings.theme,
            density: args.deck.settings.density,
            title: card.title,
            bullets: card.bullets,
            imageSource: result.source,
          },
          updatedAt: new Date(),
        })
        .where(eq(deckCards.id, cardId));
      await markCardJobStatus(db, args.jobId, cardId, 'done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      console.error('[image-job] card failed', cardId, err);
      await markCardJobStatus(db, args.jobId, cardId, 'failed', message);
    }
  };

  while (queue.length > 0 || inflight.size > 0) {
    while (queue.length > 0 && inflight.size < IMAGE_CONCURRENCY) {
      const cardId = queue.shift()!;
      const task = runOne(cardId).finally(() => {
        inflight.delete(task);
      });
      inflight.add(task);
    }
    if (inflight.size > 0) {
      await Promise.race(inflight);
    }
  }

  // 全部跑完，确定整体状态
  const finalJob = await db.query.generationJobs.findFirst({ where: eq(generationJobs.id, args.jobId) });
  const result = (finalJob?.result ?? { cardJobs: [] }) as ImageJobResult;
  const anyFailed = result.cardJobs.some((cj) => cj.status === 'failed');
  await db
    .update(generationJobs)
    .set({
      status: anyFailed ? 'failed' : 'done',
      completedAt: new Date(),
      error: anyFailed ? 'partial_failure' : null,
    })
    .where(eq(generationJobs.id, args.jobId));
  await db
    .update(decks)
    .set({ status: anyFailed ? 'styled' : 'ready', updatedAt: new Date() })
    .where(eq(decks.id, args.deckId));
  await writeActivity(db, args.deckId, 'system', 'generation', args.jobId, 'image_job_done', null, {
    cardCount: args.cardIds.length,
    failed: result.cardJobs.filter((cj) => cj.status === 'failed').length,
  });
}

async function markCardJobStatus(
  db: Db,
  jobId: string,
  cardId: string,
  status: CardJobState['status'],
  error?: string,
) {
  // 用 jsonb 原子重写避免并发 read-modify-write 时的 lost update。
  // jsonb_array_elements 把 cardJobs 数组展开成行；对每行用 CASE 判断是否为目标 cardId，
  // 是则在原对象上叠加新字段；最后用 jsonb_agg 收回数组。整条 SQL 在 Postgres 中是原子的。
  const finishedAt = status === 'done' || status === 'failed' ? new Date().toISOString() : null;
  const errorValue = error ?? null;
  await db.execute(sql`
    UPDATE generation_jobs
    SET result = jsonb_set(
      coalesce(result, '{}'::jsonb),
      '{cardJobs}',
      coalesce(
        (
          SELECT jsonb_agg(
            CASE
              WHEN cj->>'cardId' = ${cardId} THEN
                cj
                  || jsonb_build_object('status', ${status}::text)
                  || (CASE WHEN ${finishedAt}::text IS NULL THEN '{}'::jsonb
                           ELSE jsonb_build_object('finishedAt', ${finishedAt}::text) END)
                  || (CASE WHEN ${errorValue}::text IS NULL THEN '{}'::jsonb
                           ELSE jsonb_build_object('error', ${errorValue}::text) END)
              ELSE cj
            END
          )
          FROM jsonb_array_elements(result->'cardJobs') AS cj
        ),
        '[]'::jsonb
      )
    )
    WHERE id = ${jobId}
  `);
}

function renderPatch(deck: DeckRow, card: DeckCardRow, mode: DeckMode) {
  const render = {
    mode,
    aspectRatio: deck.aspectRatio,
    theme: deck.settings.theme,
    density: deck.settings.density,
    title: card.title,
    bullets: card.bullets,
  };
  if (mode === 'image') {
    return {
      render,
      imagePrompt: `Editorial social card, ${deck.settings.imageStyle}, topic: ${deck.prompt}, card title: ${card.title}`,
      imageUrl: card.imageUrl,
      updatedAt: new Date(),
    };
  }
  return { render, updatedAt: new Date() };
}

type ChatActionWithPatch = {
  label: string;
  kind: 'title' | 'bullet' | 'tone';
  patch: { title?: string; bullets?: string[] };
};

async function loadChatReply(args: {
  env: ApiBindings;
  message: string;
  deck: DeckRow;
  card: DeckCardRow | null;
  cardCount: number;
  history: Array<{ role: 'user' | 'assistant'; body: string }>;
}): Promise<{ body: string; actions: ChatActionWithPatch[] }> {
  if (!args.env.AIHUBMIX_API_KEY) {
    return localChatReply(args.message, args.card, args.deck);
  }
  try {
    const reply = await generateChatReply({
      message: args.message,
      card: args.card
        ? {
            index: args.card.index,
            total: args.cardCount,
            title: args.card.title,
            bullets: args.card.bullets,
            layout: args.card.layout,
          }
        : null,
      deckTitle: args.deck.title,
      deckPrompt: args.deck.prompt,
      settings: args.deck.settings,
      env: { AIHUBMIX_API_KEY: args.env.AIHUBMIX_API_KEY },
      history: args.history,
    });
    return reply;
  } catch (err) {
    console.error('[llm] chat reply failed, falling back to stub', err);
    return localChatReply(args.message, args.card, args.deck);
  }
}

// 缺 AIHUBMIX_API_KEY 或 LLM 失败时的兜底 stub：用 voice-tone 黑名单做最低限度
// 的"标题清营销词、bullet 加一条占位"，保证点击 action 后卡片**确实有变化**，
// 不再像之前那样和真实 LLM 路径产生不一致。
function localChatReply(message: string, card: DeckCardRow | null, deck: DeckRow): {
  body: string;
  actions: ChatActionWithPatch[];
} {
  const scope = card ? `#${String(card.index + 1).padStart(2, '0')}「${card.title}」` : `整套「${deck.title}」`;
  const trimmed = message.length > 36 ? `${message.slice(0, 36)}…` : message;
  const fallbackTitle = card ? deriveCleanerTitle(card.title) : `${deck.title} 摘要`;
  const fallbackBullets = card
    ? [...card.bullets, '补一条具体判断或数据点，避免泛泛而谈']
    : ['补一条具体判断或数据点，避免泛泛而谈'];
  return {
    body: `锁定 ${scope}。按「${trimmed}」处理；以下三条是离线兜底建议（未连 LLM）。`,
    actions: [
      { label: '更精炼标题', kind: 'title', patch: { title: fallbackTitle } },
      { label: '加一个数据点', kind: 'bullet', patch: { bullets: fallbackBullets } },
      { label: '换更有力的开场', kind: 'tone', patch: { title: fallbackTitle } },
    ],
  };
}

function deriveCleanerTitle(original: string): string {
  // 取冒号前段、≤18 字、并跑 slop 黑名单清营销词。
  const colonStripped = original.split(/[:：]/, 1)[0];
  const trimmed = colonStripped.length > 18 ? colonStripped.slice(0, 18) : colonStripped;
  const fakeCard = { title: trimmed, bullets: [], layout: 'list' as const };
  const { hits } = lintCards([fakeCard]);
  if (hits.length === 0) return trimmed;
  const [stripped] = stripSlop([fakeCard]);
  return stripped.title || trimmed;
}
