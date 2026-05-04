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

function fakeImageClient(): { client: ImageClient; calls: Array<{ model: string; prompt: string }> } {
  const calls: Array<{ model: string; prompt: string }> = [];
  const client: ImageClient = {
    images: {
      async generate(args) {
        calls.push({ model: args.model, prompt: args.prompt });
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
    expect(ai.calls[0].prompt).toContain('hutong food');
    expect(ai.calls[0].prompt).toContain('a teacup');

    // After 1 of 2 cards: job still running
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

// Touch vi to keep the import used for future expansions; harmless.
void vi;
