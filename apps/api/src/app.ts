import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import type { ChangeActor, ChangeTarget } from '@vcard/shared-types';
import { createDb, type Db } from './db/client.js';
import { cards, changeLogs, projects } from './db/schema.js';
import type { CardInsert, CardRow } from './db/schema.js';

export type ApiBindings = {
  DATABASE_URL: string;
  IMAGES?: R2Bucket;
  GEN_IMAGE_QUEUE?: Queue;
  SUGGEST_QUEUE?: Queue;
};

type Variables = {
  db: Db;
};

const createProjectSchema = z.object({
  topic: z.string().min(1),
  userId: z.string().default('demo-user'),
});

const patchCardSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  version: z.number().int(),
});

const reorderSchema = z.object({
  order: z.array(z.object({ cardId: z.string().uuid(), index: z.number().int().min(0) })),
});

export const app = new Hono<{ Bindings: ApiBindings; Variables: Variables }>();

app.use('*', async (c, next) => {
  const url = c.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return c.json({ error: 'DATABASE_URL not configured' }, 500);
  c.set('db', createDb(url));
  await next();
});

app.post('/projects', async (c) => {
  const body = createProjectSchema.parse(await c.req.json());
  const db = c.var.db;
  const [row] = await db.insert(projects).values({ topic: body.topic, userId: body.userId }).returning();
  return c.json(row, 201);
});

app.get('/projects/:id', async (c) => {
  const db = c.var.db;
  const id = c.req.param('id');
  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) return c.json({ error: 'not found' }, 404);
  const projectCards = await db
    .select()
    .from(cards)
    .where(eq(cards.projectId, id))
    .orderBy(asc(cards.index));
  return c.json({ project, cards: projectCards });
});

app.patch('/projects/:id/cards/:cardId', async (c) => {
  const db = c.var.db;
  const projectId = c.req.param('id');
  const cardId = c.req.param('cardId');
  const patch = patchCardSchema.parse(await c.req.json());

  const before = await db.query.cards.findFirst({
    where: and(eq(cards.id, cardId), eq(cards.projectId, projectId)),
  });
  if (!before) return c.json({ error: 'not found' }, 404);
  if (before.version !== patch.version) {
    return c.json({ error: 'version_conflict', expected: before.version }, 409);
  }

  const [updated] = await db
    .update(cards)
    .set({
      title: patch.title ?? before.title,
      body: patch.body ?? before.body,
      version: before.version + 1,
      userEdited: true,
    })
    .where(and(eq(cards.id, cardId), eq(cards.version, patch.version)))
    .returning();

  if (!updated) {
    // race: someone bumped version between our read and write
    const fresh = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
    return c.json({ error: 'version_conflict', expected: fresh?.version ?? null }, 409);
  }

  await writeChange(db, projectId, 'user', 'card', cardId, 'patch_card', before, updated);
  return c.json(updated);
});

app.patch('/projects/:id/cards', async (c) => {
  const db = c.var.db;
  const projectId = c.req.param('id');
  const { order } = reorderSchema.parse(await c.req.json());

  for (const row of order) {
    await db
      .update(cards)
      .set({ index: row.index })
      .where(and(eq(cards.id, row.cardId), eq(cards.projectId, projectId)));
  }

  await writeChange(db, projectId, 'user', 'project', projectId, 'reorder_cards', null, order);
  return c.json({ ok: true });
});

app.post('/internal/cards', async (c) => {
  const db = c.var.db;
  const body = (await c.req.json()) as CardInsert;
  const [row] = await db.insert(cards).values(body).returning();
  await writeChange(db, row.projectId, 'agent', 'card', row.id, 'create_card', null, row);
  return c.json(row, 201);
});

app.post('/changes/:id/undo', async (c) => {
  const db = c.var.db;
  const log = await db.query.changeLogs.findFirst({ where: eq(changeLogs.id, c.req.param('id')) });
  if (!log) return c.json({ error: 'not found' }, 404);

  if (log.target === 'card') {
    const before = log.before as CardRow | null;
    if (before) {
      await db
        .insert(cards)
        .values(before)
        .onConflictDoUpdate({ target: cards.id, set: before });
    } else {
      await db.delete(cards).where(eq(cards.id, log.targetId));
    }
  }

  await writeChange(
    db,
    log.projectId,
    'user',
    log.target,
    log.targetId,
    `undo:${log.action}`,
    log.after,
    log.before,
  );
  return c.json({ ok: true });
});

async function writeChange(
  db: Db,
  projectId: string,
  actor: ChangeActor,
  target: ChangeTarget,
  targetId: string,
  action: string,
  before: unknown,
  after: unknown,
) {
  await db.insert(changeLogs).values({
    projectId,
    actor,
    target,
    targetId,
    action,
    before: before as CardRow,
    after: after as CardRow,
  });
}
