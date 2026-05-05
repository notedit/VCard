import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { app } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import {
  cardImages,
  cards,
  changeLogs,
  genJobs,
  projects,
} from '../src/db/schema.js';
import { processGenImageMessage } from '../src/queues/gen-image-consumer.js';
import type { ImageClient } from '../src/image/gen-image.js';
import type { R2PutBucket } from '../src/image/store-image.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);

// Tiny placeholder bytes — not a valid PNG, but we only need to verify the
// pipeline propagates them. Real-API test verifies actual gpt-image-2 output.
const FAKE_B64 = 'SEVMTE8='; // base64("HELLO")

async function truncateAll() {
  await db.execute(
    sql`TRUNCATE TABLE projects, skills, change_logs, gen_jobs, card_images, suggestions RESTART IDENTITY CASCADE`,
  );
}

function fakeBucket() {
  const calls: Array<{ key: string; bytes: Uint8Array; contentType?: string }> = [];
  const bucket: R2PutBucket = {
    async put(key, body, options) {
      const bytes =
        body instanceof Uint8Array
          ? body
          : body instanceof ArrayBuffer
            ? new Uint8Array(body)
            : ArrayBuffer.isView(body)
              ? new Uint8Array(body.buffer)
              : new Uint8Array();
      calls.push({ key, bytes, contentType: options?.httpMetadata?.contentType });
      return null;
    },
  };
  return { bucket, calls };
}

function fakeImageClient(): { client: ImageClient; calls: Array<{ model: string; prompt: string; size?: string }> } {
  const calls: Array<{ model: string; prompt: string; size?: string }> = [];
  const client: ImageClient = {
    images: {
      async generate(args) {
        calls.push({ model: args.model, prompt: args.prompt, size: args.size });
        return { data: [{ b64_json: FAKE_B64 }] };
      },
    },
  };
  return { client, calls };
}

function fakeQueue() {
  const sent: Array<{ body: unknown }> = [];
  const queue = {
    async send(body: unknown) {
      sent.push({ body });
    },
    async sendBatch(messages: Array<{ body: unknown }>) {
      for (const m of messages) sent.push({ body: m.body });
    },
  };
  return { queue: queue as unknown as Queue, sent };
}

async function seedProjectWithCards(topic: string, cardCount: number) {
  const [project] = await db.insert(projects).values({ topic, userId: 'demo-user' }).returning();
  const inserted = await db
    .insert(cards)
    .values(
      Array.from({ length: cardCount }, (_, i) => ({
        projectId: project.id,
        index: i,
        role: 'argument' as const,
        title: `c${i}`,
        body: `b${i}`,
        version: 1,
      })),
    )
    .returning();
  return { project, cards: inserted };
}

describe('POST /projects/:id/gen-jobs producer', () => {
  beforeEach(truncateAll);

  it('enqueues one message per card and returns 202 with jobId', async () => {
    const { project } = await seedProjectWithCards('test topic', 3);
    const q = fakeQueue();

    const res = await app.request(
      `/projects/${project.id}/gen-jobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          mainSubject: { description: 'a teacup', refImages: [], locks: [] },
          artStyle: '真实摄影',
          textLayout: 'top',
        }),
      },
      { DATABASE_URL, GEN_IMAGE_QUEUE: q.queue },
    );

    expect(res.status).toBe(202);
    const body = (await res.json()) as { job: { id: string; status: string }; queued: number };
    expect(body.job.status).toBe('running');
    expect(body.queued).toBe(3);

    expect(q.sent).toHaveLength(3);
    for (const msg of q.sent) {
      const payload = msg.body as { cardId: string; genJobId: string; projectId: string };
      expect(payload.projectId).toBe(project.id);
      expect(payload.genJobId).toBe(body.job.id);
      expect(typeof payload.cardId).toBe('string');
    }

    const projectRow = await db.query.projects.findFirst({ where: eq(projects.id, project.id) });
    expect(projectRow?.status).toBe('generating');
  });

  it('returns 409 if a job is already running (idempotency on retry / double-click)', async () => {
    const { project } = await seedProjectWithCards('idempotent topic', 2);
    const q = fakeQueue();
    const body = JSON.stringify({
      mainSubject: { description: 'x', refImages: [], locks: [] },
      artStyle: '',
      textLayout: 'top',
    });

    const first = await app.request(
      `/projects/${project.id}/gen-jobs`,
      { method: 'POST', body },
      { DATABASE_URL, GEN_IMAGE_QUEUE: q.queue },
    );
    expect(first.status).toBe(202);
    const firstBody = (await first.json()) as { job: { id: string } };
    const firstJobId = firstBody.job.id;

    const second = await app.request(
      `/projects/${project.id}/gen-jobs`,
      { method: 'POST', body },
      { DATABASE_URL, GEN_IMAGE_QUEUE: q.queue },
    );
    expect(second.status).toBe(409);
    const secondBody = (await second.json()) as { error: string; jobId: string };
    expect(secondBody.error).toBe('job_already_running');
    expect(secondBody.jobId).toBe(firstJobId);

    // Second call should NOT have enqueued additional messages.
    expect(q.sent).toHaveLength(2);
  });

  it('can enqueue only selected cardIds for cheap local smoke tests', async () => {
    const { project, cards: seeded } = await seedProjectWithCards('single image test', 3);
    const q = fakeQueue();

    const res = await app.request(
      `/projects/${project.id}/gen-jobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          mainSubject: { description: 'a teacup', refImages: [], locks: [] },
          artStyle: '真实摄影',
          textLayout: 'top',
          cardIds: [seeded[1].id],
        }),
      },
      { DATABASE_URL, GEN_IMAGE_QUEUE: q.queue },
    );

    expect(res.status).toBe(202);
    const body = (await res.json()) as { queued: number };
    expect(body.queued).toBe(1);
    expect(q.sent).toHaveLength(1);
    expect((q.sent[0].body as { cardId: string }).cardId).toBe(seeded[1].id);
  });

  it('rejects cardIds outside the project', async () => {
    const { project } = await seedProjectWithCards('bad card id', 1);
    const q = fakeQueue();

    const res = await app.request(
      `/projects/${project.id}/gen-jobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          mainSubject: { description: 'a teacup', refImages: [], locks: [] },
          artStyle: '真实摄影',
          textLayout: 'top',
          cardIds: ['00000000-0000-4000-8000-000000000999'],
        }),
      },
      { DATABASE_URL, GEN_IMAGE_QUEUE: q.queue },
    );

    expect(res.status).toBe(400);
    expect(q.sent).toHaveLength(0);
  });

  it('returns 409 if project has no cards', async () => {
    const [project] = await db.insert(projects).values({ topic: 'no cards', userId: 'demo-user' }).returning();
    const q = fakeQueue();
    const res = await app.request(
      `/projects/${project.id}/gen-jobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          mainSubject: { description: 'x', refImages: [], locks: [] },
          artStyle: '',
          textLayout: 'top',
        }),
      },
      { DATABASE_URL, GEN_IMAGE_QUEUE: q.queue },
    );
    expect(res.status).toBe(409);
    expect(q.sent).toHaveLength(0);
  });
});

describe('processGenImageMessage consumer (1 message at a time)', () => {
  beforeEach(truncateAll);

  it('writes image to R2, inserts CardImage row, marks job done when last card lands', async () => {
    const { project, cards: seeded } = await seedProjectWithCards('hutong food', 2);
    const [job] = await db
      .insert(genJobs)
      .values({
        projectId: project.id,
        status: 'running',
        mainSubject: { description: 'a teacup', refImages: [], locks: [] },
        artStyle: '真实摄影',
        textLayout: 'top',
      })
      .returning();

    const r2 = fakeBucket();
    const ai = fakeImageClient();

    // Process card 0
    await processGenImageMessage(
      { cardId: seeded[0].id, genJobId: job.id, projectId: project.id },
      { db, client: ai.client, bucket: r2.bucket },
    );

    expect(r2.calls).toHaveLength(1);
    expect(r2.calls[0].key).toBe(`card-images/${job.id}/${seeded[0].id}-v1.png`);
    expect(r2.calls[0].contentType).toBe('image/png');
    expect(ai.calls[0].model).toBe('gpt-image-2');
    expect(ai.calls[0].size).toBe('1024x1536');
    expect(ai.calls[0].prompt).toContain('hutong food');
    expect(ai.calls[0].prompt).toContain('a teacup');

    // Full-project jobs stay running until every queued card lands.
    let jobRow = await db.query.genJobs.findFirst({ where: eq(genJobs.id, job.id) });
    expect(jobRow?.status).toBe('running');

    // Process card 1 — should trigger maybeMarkJobDone
    await processGenImageMessage(
      { cardId: seeded[1].id, genJobId: job.id, projectId: project.id },
      { db, client: ai.client, bucket: r2.bucket },
    );

    expect(r2.calls).toHaveLength(2);
    jobRow = await db.query.genJobs.findFirst({ where: eq(genJobs.id, job.id) });
    expect(jobRow?.status).toBe('done');
    expect(jobRow?.completedAt).toBeTruthy();

    // Both cards now have an image and bumped imageVersionId
    const [c0, c1] = await Promise.all([
      db.query.cards.findFirst({ where: eq(cards.id, seeded[0].id) }),
      db.query.cards.findFirst({ where: eq(cards.id, seeded[1].id) }),
    ]);
    expect(c0?.imageVersionId).toBeTruthy();
    expect(c1?.imageVersionId).toBeTruthy();

    // CardImage rows
    const images = await db.select().from(cardImages).where(eq(cardImages.genJobId, job.id));
    expect(images).toHaveLength(2);
    expect(images.every((row) => row.url.startsWith(`card-images/${job.id}/`))).toBe(true);

    // ChangeLog rows
    const logs = await db
      .select()
      .from(changeLogs)
      .where(eq(changeLogs.projectId, project.id));
    const imageLogs = logs.filter((l) => l.target === 'image' && l.action === 'create_card_image');
    expect(imageLogs).toHaveLength(2);
  });

  it('marks selected-card jobs done when their queued card lands', async () => {
    const { project, cards: seeded } = await seedProjectWithCards('single card job', 3);
    const [job] = await db
      .insert(genJobs)
      .values({
        projectId: project.id,
        status: 'running',
        mainSubject: {
          description: 'x',
          refImages: [],
          locks: [],
          queuedCardIds: [seeded[1].id],
        } as { description: string; refImages: string[]; locks: []; queuedCardIds: string[] },
        artStyle: '',
        textLayout: 'top',
      })
      .returning();
    const r2 = fakeBucket();
    const ai = fakeImageClient();

    await processGenImageMessage(
      { cardId: seeded[1].id, genJobId: job.id, projectId: project.id },
      { db, client: ai.client, bucket: r2.bucket },
    );

    const jobRow = await db.query.genJobs.findFirst({ where: eq(genJobs.id, job.id) });
    expect(jobRow?.status).toBe('done');
    expect(jobRow?.completedAt).toBeTruthy();
  });

  it('is idempotent on retry: second processGenImageMessage call no-ops the row insert and ChangeLog', async () => {
    const { project, cards: seeded } = await seedProjectWithCards('retry topic', 1);
    const [job] = await db
      .insert(genJobs)
      .values({
        projectId: project.id,
        status: 'running',
        mainSubject: { description: 'x', refImages: [], locks: [] },
        artStyle: '',
        textLayout: 'top',
      })
      .returning();
    const r2 = fakeBucket();
    const ai = fakeImageClient();
    const payload = { cardId: seeded[0].id, genJobId: job.id, projectId: project.id };

    await processGenImageMessage(payload, { db, client: ai.client, bucket: r2.bucket });
    await processGenImageMessage(payload, { db, client: ai.client, bucket: r2.bucket });

    // R2 put runs twice (idempotent overwrite of same key) and the model is called twice
    // (Queue retry semantics — the consumer doesn't know if the prior call succeeded).
    // But DB rows must be exactly one each:
    const images = await db.select().from(cardImages).where(eq(cardImages.cardId, seeded[0].id));
    expect(images).toHaveLength(1);
    const imageLogs = await db
      .select()
      .from(changeLogs)
      .where(eq(changeLogs.projectId, project.id));
    expect(imageLogs.filter((l) => l.action === 'create_card_image')).toHaveLength(1);
  });

  it('cards.imageVersionId becomes NULL when the referenced cardImage is deleted (FK ON DELETE SET NULL)', async () => {
    const { project, cards: seeded } = await seedProjectWithCards('fk topic', 1);
    const [job] = await db
      .insert(genJobs)
      .values({
        projectId: project.id,
        status: 'running',
        mainSubject: { description: 'x', refImages: [], locks: [] },
        artStyle: '',
        textLayout: 'top',
      })
      .returning();
    const r2 = fakeBucket();
    const ai = fakeImageClient();
    await processGenImageMessage(
      { cardId: seeded[0].id, genJobId: job.id, projectId: project.id },
      { db, client: ai.client, bucket: r2.bucket },
    );

    // After processing, card has an imageVersionId pointing at the cardImage row.
    const before = await db.query.cards.findFirst({ where: eq(cards.id, seeded[0].id) });
    expect(before?.imageVersionId).toBeTruthy();

    // Delete the cardImage row directly. FK should null out cards.imageVersionId.
    await db.delete(cardImages).where(eq(cardImages.id, before!.imageVersionId!));

    const after = await db.query.cards.findFirst({ where: eq(cards.id, seeded[0].id) });
    expect(after?.imageVersionId).toBeNull();
  });

  it('throws on missing card so the queue can retry', async () => {
    const { project } = await seedProjectWithCards('topic', 1);
    const [job] = await db
      .insert(genJobs)
      .values({
        projectId: project.id,
        status: 'running',
        mainSubject: { description: 'x', refImages: [], locks: [] },
        artStyle: '',
        textLayout: 'top',
      })
      .returning();
    const r2 = fakeBucket();
    const ai = fakeImageClient();
    await expect(
      processGenImageMessage(
        { cardId: '00000000-0000-4000-8000-000000000999', genJobId: job.id, projectId: project.id },
        { db, client: ai.client, bucket: r2.bucket },
      ),
    ).rejects.toThrow(/card not found/);
    expect(r2.calls).toHaveLength(0);
    expect(ai.calls).toHaveLength(0);
  });
});

describe('GET /images/* R2 proxy', () => {
  it('serves card image keys from R2 with immutable cache headers', async () => {
    const key = 'card-images/job-1/card-1-v1.png';
    const bucket = {
      async get(requestedKey: string) {
        if (requestedKey !== key) return null;
        return {
          body: new Uint8Array([1, 2, 3]),
          httpEtag: '"etag-1"',
          writeHttpMetadata(headers: Headers) {
            headers.set('content-type', 'image/png');
          },
        };
      },
    } as unknown as R2Bucket;

    const res = await app.request(`/images/${key}`, {}, { DATABASE_URL, IMAGES: bucket });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects keys outside card-images', async () => {
    const bucket = { async get() { return null; } } as unknown as R2Bucket;
    const res = await app.request('/images/private/foo.png', {}, { DATABASE_URL, IMAGES: bucket });
    expect(res.status).toBe(400);
  });
});

// Touch vi to keep the import used for future expansions; harmless.
void vi;
