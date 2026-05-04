import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { createAgentUIStreamResponse, type LanguageModel } from 'ai';
import type { ChangeActor, ChangeTarget } from '@vcard/shared-types';
import { createDb, type Db } from './db/client.js';
import { cardImages, cards, changeLogs, genJobs, projects, skills } from './db/schema.js';
import type { CardInsert, CardRow, SkillInsert } from './db/schema.js';
import {
  buildInitialPlanMessages,
  buildPlanAgent,
  buildPlanModel,
} from './agent/plan-agent.js';
import {
  buildEditAgent,
  buildEditModel,
  buildInitialEditMessages,
} from './agent/edit-agent.js';

export type ApiBindings = {
  DATABASE_URL: string;
  AIHUBMIX_API_KEY?: string;
  AGENT_BASE_URL?: string;
  IMAGES?: R2Bucket;
  GEN_IMAGE_QUEUE?: Queue;
  SUGGEST_QUEUE?: Queue;
  /** Test-only: inject a mocked LanguageModel for the plan endpoint. */
  __TEST_PLAN_MODEL__?: LanguageModel;
  /** Test-only: inject a mocked LanguageModel for the edit endpoint. */
  __TEST_EDIT_MODEL__?: LanguageModel;
};

type Variables = {
  db: Db;
};

const createProjectSchema = z.object({
  topic: z.string().min(1),
  userId: z.string().default('demo-user'),
});

const setProjectSkillsSchema = z.object({
  skillIds: z.array(z.string().uuid()).max(5),
});

const createPlanSchema = z.object({
  topic: z.string().min(1).optional(),
  skillIds: z.array(z.string().uuid()).optional(),
});

const mainSubjectSchema = z.object({
  description: z.string().min(1),
  refImages: z.array(z.string()).default([]),
  locks: z.array(z.enum(['lighting', 'camera', 'people', 'props'])).default([]),
});

const createGenJobSchema = z.object({
  mainSubject: mainSubjectSchema,
  artStyle: z.string().default('真实摄影'),
  textLayout: z.enum(['top', 'calligraphy', 'fullscreen', 'caption']).default('top'),
});

const patchCardSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  version: z.number().int(),
});

const editCardSchema = z.object({
  field: z.enum(['title', 'body']),
  instruction: z.string().min(1).max(500),
});

const reorderSchema = z.object({
  order: z.array(z.object({ cardId: z.string().uuid(), index: z.number().int().min(0) })),
});

export const app = new Hono<{ Bindings: ApiBindings; Variables: Variables }>();

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'] }));

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

app.get('/skills', async (c) => {
  const db = c.var.db;
  await seedOfficialSkills(db);
  const rows = await db.select().from(skills).orderBy(asc(skills.name));
  return c.json({ skills: rows });
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

app.patch('/projects/:id/skills', async (c) => {
  const db = c.var.db;
  const projectId = c.req.param('id');
  const { skillIds } = setProjectSkillsSchema.parse(await c.req.json());

  await seedOfficialSkills(db);
  const existing = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!existing) return c.json({ error: 'not found' }, 404);

  const knownSkills = await db.select().from(skills);
  const knownIds = new Set(knownSkills.map((skill) => skill.id));
  const unknown = skillIds.filter((id) => !knownIds.has(id));
  if (unknown.length > 0) return c.json({ error: 'unknown_skill', skillIds: unknown }, 400);

  const [updated] = await db
    .update(projects)
    .set({ skillIds, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  await writeChange(db, projectId, 'user', 'project', projectId, 'set_project_skills', existing, updated);
  return c.json(updated);
});

app.post('/projects/:id/plan', async (c) => {
  const db = c.var.db;
  const projectId = c.req.param('id');
  const body = createPlanSchema.parse(await c.req.json().catch(() => ({})));
  await seedOfficialSkills(db);

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return c.json({ error: 'not found' }, 404);

  const topic = body.topic ?? project.topic;
  const selectedSkillIds = body.skillIds ?? project.skillIds;

  // Resolve the LanguageModel: test override > AIHubMix-backed Anthropic.
  const testModel = c.env?.__TEST_PLAN_MODEL__;
  const apiKey = c.env?.AIHUBMIX_API_KEY ?? process.env.AIHUBMIX_API_KEY;
  if (!testModel && !apiKey) {
    return c.json({ error: 'AIHUBMIX_API_KEY not configured' }, 500);
  }
  const model: LanguageModel = testModel ?? buildPlanModel({ AIHUBMIX_API_KEY: apiKey! });

  // Load selected skills in the order specified by skillIds (priority order).
  const selectedSkills =
    selectedSkillIds.length === 0
      ? []
      : await loadSkillsInOrder(db, selectedSkillIds);

  // Restart the plan: clear previous cards so the agent's create_card calls are
  // the only source of truth for this project's card set.
  await db.delete(cards).where(eq(cards.projectId, projectId));
  await db
    .update(projects)
    .set({ status: 'planning', updatedAt: new Date(), skillIds: selectedSkillIds })
    .where(eq(projects.id, projectId));

  const agent = buildPlanAgent({
    model,
    ctx: { db, projectId },
    skills: selectedSkills,
  });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: buildInitialPlanMessages(topic),
    abortSignal: c.req.raw.signal,
  });
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
  await triggerReflect(c.env, { projectId, cardId, trigger: 'edit' });
  return c.json(updated);
});

app.post('/cards/:id/edit', async (c) => {
  const db = c.var.db;
  const cardId = c.req.param('id');
  const body = editCardSchema.parse(await c.req.json());

  const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
  if (!card) return c.json({ error: 'not found' }, 404);

  const testModel = c.env?.__TEST_EDIT_MODEL__;
  const apiKey = c.env?.AIHUBMIX_API_KEY ?? process.env.AIHUBMIX_API_KEY;
  if (!testModel && !apiKey) {
    return c.json({ error: 'AIHUBMIX_API_KEY not configured' }, 500);
  }
  const model: LanguageModel = testModel ?? buildEditModel({ AIHUBMIX_API_KEY: apiKey! });

  // Pull immediate-neighbor cards (index ± 1) for tone consistency context.
  const neighbors = await db
    .select({ index: cards.index, role: cards.role, title: cards.title, body: cards.body })
    .from(cards)
    .where(eq(cards.projectId, card.projectId))
    .orderBy(asc(cards.index));
  const contextCards = neighbors.filter(
    (c) => Math.abs(c.index - card.index) === 1,
  );

  const agent = buildEditAgent({ model, card, contextCards, field: body.field });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: buildInitialEditMessages(body.instruction),
    abortSignal: c.req.raw.signal,
  });
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
  await triggerReflect(c.env, { projectId, trigger: 'reorder' });
  return c.json({ ok: true });
});

app.post('/projects/:id/gen-jobs', async (c) => {
  const db = c.var.db;
  const projectId = c.req.param('id');
  const body = createGenJobSchema.parse(await c.req.json());
  const queue = c.env?.GEN_IMAGE_QUEUE;
  if (!queue) return c.json({ error: 'GEN_IMAGE_QUEUE not configured' }, 500);

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return c.json({ error: 'not found' }, 404);

  const projectCards = await db
    .select()
    .from(cards)
    .where(eq(cards.projectId, projectId))
    .orderBy(asc(cards.index));
  if (projectCards.length === 0) return c.json({ error: 'no_cards' }, 409);

  // GenJob row is created synchronously (so the client gets a jobId for polling
  // /gen-jobs/:id/status), but image generation itself fans out via the queue.
  // The consumer (apps/api/src/queues/gen-image-consumer.ts) writes CardImage
  // rows + flips status='done' when every card lands.
  const [job] = await db
    .insert(genJobs)
    .values({
      projectId,
      status: 'running',
      mainSubject: body.mainSubject,
      artStyle: body.artStyle,
      textLayout: body.textLayout,
    })
    .returning();

  await queue.sendBatch(
    projectCards.map((card) => ({
      body: { cardId: card.id, genJobId: job.id, projectId } satisfies GenImageQueueMessage,
    })),
  );

  await db
    .update(projects)
    .set({ status: 'generating', updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  await triggerReflect(c.env, { projectId, trigger: 'regen' });

  return c.json({ job, queued: projectCards.length }, 202);
});

type GenImageQueueMessage = {
  cardId: string;
  genJobId: string;
  projectId: string;
};

app.get('/gen-jobs/:id/status', async (c) => {
  const db = c.var.db;
  const jobId = c.req.param('id');
  const job = await db.query.genJobs.findFirst({ where: eq(genJobs.id, jobId) });
  if (!job) return c.json({ error: 'not found' }, 404);

  const images = await db
    .select({
      id: cardImages.id,
      cardId: cardImages.cardId,
      url: cardImages.url,
      cardIndex: cards.index,
    })
    .from(cardImages)
    .innerJoin(cards, eq(cardImages.cardId, cards.id))
    .where(eq(cardImages.genJobId, jobId))
    .orderBy(asc(cards.index));

  return c.json({
    job,
    done: images.map((image) => image.cardIndex),
    pending: [],
    failed: [],
    images,
  });
});

app.post('/projects/:id/export', async (c) => {
  const db = c.var.db;
  const projectId = c.req.param('id');
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return c.json({ error: 'not found' }, 404);

  const rows = await db
    .select({
      card: cards,
      imageUrl: cardImages.url,
    })
    .from(cards)
    .leftJoin(cardImages, eq(cards.id, cardImages.cardId))
    .where(eq(cards.projectId, projectId))
    .orderBy(asc(cards.index));

  if (rows.length === 0) return c.json({ error: 'no_cards' }, 409);

  const files = rows.map((row) => ({
    name: `${String(row.card.index + 1).padStart(2, '0')}_${row.card.role}.txt`,
    content: `${row.card.title}\n\n${row.card.body}\n\nimage: ${row.imageUrl ?? 'not generated'}\n`,
  }));
  files.unshift({
    name: 'manifest.json',
    content: JSON.stringify({ project, cardCount: rows.length, exportedAt: new Date().toISOString() }, null, 2),
  });

  const archive = createZip(files);
  await db.update(projects).set({ status: 'exported', updatedAt: new Date() }).where(eq(projects.id, projectId));
  return new Response(archive, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="vcard-${projectId}.zip"`,
    },
  });
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

const officialSkillRows: SkillInsert[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    name: '爆款标题手',
    author: 'VCard',
    category: ['title', 'redbook'],
    systemPrompt: '强化小红书封面标题：具体、反差、可收藏，避免空泛形容词。',
    fewShotExamples: [{ input: '北京胡同美食', output: '200块吃到扶墙出：7家胡同老店' }],
    imageRefs: [],
    outputSchema: { mustHave: ['cover', 'hook'], maxWordsPerCard: 42, titleEmojiProb: 0.2 },
    appliesTo: { platforms: ['redbook'], stages: ['plan', 'edit'] },
    isOfficial: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    name: '小红书种草体',
    author: 'VCard',
    category: ['copywriting', 'redbook'],
    systemPrompt: '使用自然口吻、经验密度和避坑表达，让内容像真实用户分享。',
    fewShotExamples: [{ input: '咖啡店推荐', output: '这家我会二刷，但只建议工作日下午去。' }],
    imageRefs: [],
    outputSchema: { mustHave: ['list', 'cta'], maxWordsPerCard: 56, titleEmojiProb: 0.1 },
    appliesTo: { platforms: ['redbook'], stages: ['plan', 'edit', 'image_prompt'] },
    isOfficial: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    name: '真实摄影',
    author: 'VCard',
    category: ['image', 'photo'],
    systemPrompt: '图片提示词偏真实摄影：自然光、现场感、不过度商业棚拍。',
    fewShotExamples: [{ input: '餐厅', output: '自然光下的桌面细节，手机摄影质感。' }],
    imageRefs: [],
    outputSchema: {},
    appliesTo: { platforms: ['redbook'], stages: ['image_prompt'] },
    isOfficial: true,
  },
];

async function seedOfficialSkills(db: Db) {
  await db.insert(skills).values(officialSkillRows).onConflictDoNothing();
}

/**
 * Best-effort enqueue of a reflect message. We deliberately do NOT throw on
 * missing binding — the user-facing action shouldn't fail because the async
 * suggestion pipeline isn't configured (e.g., local node-server without
 * SUGGEST_QUEUE binding).
 */
async function triggerReflect(
  env: ApiBindings | undefined,
  payload: { projectId: string; cardId?: string; trigger: 'edit' | 'reorder' | 'regen' | 'plan' },
) {
  const queue = env?.SUGGEST_QUEUE;
  if (!queue) return;
  try {
    await queue.send(payload);
  } catch (err) {
    console.error('SUGGEST_QUEUE.send failed (non-fatal):', err);
  }
}

/** Fetch skills by id and return them in the order of the input array. */
async function loadSkillsInOrder(db: Db, skillIds: string[]) {
  if (skillIds.length === 0) return [];
  const rows = await db.select().from(skills).where(inArray(skills.id, skillIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return skillIds.map((id) => byId.get(id)).filter((row): row is typeof rows[number] => !!row);
}

function createZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(content.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      name,
      content,
    ]);
    localParts.push(local);

    centralParts.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(content.length),
        u32(content.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  }

  const central = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...localParts, central, end]);
}

function u16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
