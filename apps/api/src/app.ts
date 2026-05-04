import { Hono } from 'hono';
import { z } from 'zod';
import { db, uid } from './store.js';
import type { Card, ChangeLog, Project } from '@vcard/shared-types';

const createProjectSchema = z.object({ topic: z.string().min(1), userId: z.string().default('demo-user') });
const patchCardSchema = z.object({ title: z.string().optional(), body: z.string().optional(), version: z.number().int() });
const reorderSchema = z.object({ order: z.array(z.object({ cardId: z.string(), index: z.number().int().min(0) })) });

export const app = new Hono();

app.post('/projects', async c => {
  const body = createProjectSchema.parse(await c.req.json());
  const now = new Date();
  const project: Project = { id: uid(), userId: body.userId, platform: 'redbook', topic: body.topic, cardCount: 9, aspectRatio: '4:5', language: 'zh', tone: 'native', skillIds: [], status: 'draft', createdAt: now, updatedAt: now };
  db.projects.set(project.id, project);
  return c.json(project, 201);
});

app.get('/projects/:id', c => {
  const project = db.projects.get(c.req.param('id'));
  if (!project) return c.json({ error: 'not found' }, 404);
  const cards = [...db.cards.values()].filter(x => x.projectId === project.id).sort((a, b) => a.index - b.index);
  return c.json({ project, cards });
});

app.patch('/projects/:id/cards/:cardId', async c => {
  const patch = patchCardSchema.parse(await c.req.json());
  const card = db.cards.get(c.req.param('cardId'));
  if (!card || card.projectId !== c.req.param('id')) return c.json({ error: 'not found' }, 404);
  if (card.version !== patch.version) return c.json({ error: 'version_conflict', expected: card.version }, 409);
  const before = { ...card };
  if (patch.title !== undefined) card.title = patch.title;
  if (patch.body !== undefined) card.body = patch.body;
  card.version += 1;
  card.userEdited = true;
  db.cards.set(card.id, card);
  writeChange(card.projectId, 'user', 'card', card.id, 'patch_card', before, { ...card });
  return c.json(card);
});

app.patch('/projects/:id/cards', async c => {
  const { order } = reorderSchema.parse(await c.req.json());
  const projectId = c.req.param('id');
  for (const row of order) {
    const card = db.cards.get(row.cardId);
    if (card && card.projectId === projectId) card.index = row.index;
  }
  writeChange(projectId, 'user', 'project', projectId, 'reorder_cards', null, order);
  return c.json({ ok: true });
});

app.post('/internal/cards', async c => {
  const card = (await c.req.json()) as Card;
  db.cards.set(card.id, card);
  writeChange(card.projectId, 'agent', 'card', card.id, 'create_card', null, card);
  return c.json(card, 201);
});

app.post('/changes/:id/undo', c => {
  const row = db.changeLogs.get(c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.target === 'card') {
    const before = row.before as Card | null;
    if (before) db.cards.set(row.targetId, before);
    else db.cards.delete(row.targetId);
  }
  writeChange(row.projectId, 'user', row.target, row.targetId, `undo:${row.action}`, row.after, row.before);
  return c.json({ ok: true });
});

function writeChange(projectId: string, actor: ChangeLog['actor'], target: ChangeLog['target'], targetId: string, action: string, before: unknown, after: unknown) {
  const log: ChangeLog = { id: uid(), projectId, actor, target, targetId, action, before, after, createdAt: new Date() };
  db.changeLogs.set(log.id, log);
  return log;
}
