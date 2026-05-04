import { eq } from 'drizzle-orm';
import { createDb, type Db } from '../db/client.js';
import { cardImages, cards, genJobs, projects } from '../db/schema.js';
import { buildOpenAIClient, generateCardImage, type ImageClient } from '../image/gen-image.js';
import { storeCardImage, type R2PutBucket } from '../image/store-image.js';
import {
  buildSuggestionModel,
  runSuggestionReflect,
  type ReflectDeps,
  type ReflectMessage,
} from '../agent/suggestion-agent.js';
import type { ApiBindings } from '../app.js';

export type GenImageMessage = {
  cardId: string;
  genJobId: string;
  projectId: string;
};

/** Minimal CF Queues message + batch shape we depend on. */
type QueueMessage<T> = {
  body: T;
  ack(): void;
  retry(): void;
};
type MessageBatch<T> = {
  queue: string;
  messages: ReadonlyArray<QueueMessage<T>>;
};

export type GenImageDeps = {
  db: Db;
  client: ImageClient;
  bucket: R2PutBucket;
};

/**
 * Process one queue message. Pure function over { db, client, bucket } so tests
 * can inject fakes and never touch real OpenAI / R2 / Postgres.
 */
export async function processGenImageMessage(
  payload: GenImageMessage,
  deps: GenImageDeps,
): Promise<void> {
  const { db, client, bucket } = deps;

  const card = await db.query.cards.findFirst({ where: eq(cards.id, payload.cardId) });
  if (!card) throw new Error(`card not found: ${payload.cardId}`);

  const job = await db.query.genJobs.findFirst({ where: eq(genJobs.id, payload.genJobId) });
  if (!job) throw new Error(`gen job not found: ${payload.genJobId}`);

  const project = await db.query.projects.findFirst({ where: eq(projects.id, payload.projectId) });
  if (!project) throw new Error(`project not found: ${payload.projectId}`);

  const result = await generateCardImage(client, { card, job, topic: project.topic });

  await storeCardImage({
    bucket,
    db,
    cardId: card.id,
    genJobId: job.id,
    projectId: project.id,
    b64: result.b64,
    fullPrompt: result.fullPrompt,
  });

  await maybeMarkJobDone(db, job.id, project.id);
}

/** When every card in the project has at least one image for this job, mark done. */
export async function maybeMarkJobDone(db: Db, genJobId: string, projectId: string): Promise<void> {
  const job = await db.query.genJobs.findFirst({ where: eq(genJobs.id, genJobId) });
  if (!job || job.status !== 'running') return;

  const projectCards = await db.select({ id: cards.id }).from(cards).where(eq(cards.projectId, projectId));
  if (projectCards.length === 0) return;

  const generated = await db
    .select({ cardId: cardImages.cardId })
    .from(cardImages)
    .where(eq(cardImages.genJobId, genJobId));
  const doneCardIds = new Set(generated.map((row) => row.cardId));
  const allDone = projectCards.every((row) => doneCardIds.has(row.id));

  if (allDone) {
    await db
      .update(genJobs)
      .set({ status: 'done', completedAt: new Date() })
      .where(eq(genJobs.id, genJobId));
  }
}

/**
 * Cloudflare Queues handler. Wired in worker.ts.
 * Dispatches by `batch.queue` because we share one Worker between multiple queues
 * (gen-image-jobs and suggestion-reflect).
 */
export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  env: ApiBindings,
): Promise<void> {
  if (batch.queue === 'gen-image-jobs') {
    if (!env.AIHUBMIX_API_KEY) throw new Error('AIHUBMIX_API_KEY not configured');
    if (!env.IMAGES) throw new Error('IMAGES R2 binding not configured');

    const deps: GenImageDeps = {
      db: createDb(env.DATABASE_URL),
      client: buildOpenAIClient({ AIHUBMIX_API_KEY: env.AIHUBMIX_API_KEY }),
      bucket: env.IMAGES,
    };

    for (const msg of batch.messages as ReadonlyArray<QueueMessage<GenImageMessage>>) {
      try {
        await processGenImageMessage(msg.body, deps);
        msg.ack();
      } catch (err) {
        console.error('gen-image-jobs failed:', err);
        msg.retry(); // wrangler.toml: max_retries=2 then DLQ
      }
    }
    return;
  }

  if (batch.queue === 'suggestion-reflect') {
    if (!env.AIHUBMIX_API_KEY) {
      // Without LLM, just ack so the queue doesn't pile up. Real ops should
      // alert when this happens; for MVP-5 this is the safe default.
      console.warn('suggestion-reflect: AIHUBMIX_API_KEY not configured, acking without running');
      for (const msg of batch.messages) msg.ack();
      return;
    }
    const deps: ReflectDeps = {
      db: createDb(env.DATABASE_URL),
      model: buildSuggestionModel({ AIHUBMIX_API_KEY: env.AIHUBMIX_API_KEY }),
    };
    for (const msg of batch.messages as ReadonlyArray<QueueMessage<ReflectMessage>>) {
      try {
        await runSuggestionReflect(msg.body, deps);
        msg.ack();
      } catch (err) {
        console.error('suggestion-reflect failed:', err);
        msg.retry();
      }
    }
    return;
  }

  // Unknown queue: ack to avoid retry loops while we figure out routing.
  for (const msg of batch.messages) msg.ack();
}
