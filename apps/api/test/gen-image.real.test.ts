/**
 * Opt-in real-API smoke test for gpt-image-2 via AIHubMix.
 *
 * Cost: ~$0.16 per run (1 image at 1024x1024). Latency: ~228s p50.
 * Skipped by default. Enable explicitly:
 *
 *   set -a && . ~/.secrets/common.env && set +a
 *   RUN_REAL_IMAGE_TEST=1 npx vitest run test/gen-image.real.test.ts -t real
 *
 * The full /gen-jobs path enqueues N messages where N == project.cardCount;
 * to honor the "don't burn 9× cost in tests" rule we bypass the queue and call
 * `generateCardImage` directly with N=1 card.
 */
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb } from '../src/db/client.js';
import { cards, projects } from '../src/db/schema.js';
import { buildOpenAIClient, generateCardImage } from '../src/image/gen-image.js';

const RUN_REAL = process.env.RUN_REAL_IMAGE_TEST === '1';
const describeIfReal = RUN_REAL ? describe : describe.skip;
const DATABASE_URL = process.env.DATABASE_URL_TEST!;

describeIfReal('gpt-image-2 real-API smoke (opt-in, $0.16/run)', () => {
  it('real: generates 1 image via AIHubMix, returns valid PNG bytes', async () => {
    const apiKey = process.env.AIHUBMIX_API_KEY;
    if (!apiKey) throw new Error('AIHUBMIX_API_KEY missing — required for real test');

    const db = createDb(DATABASE_URL);
    await db.execute(
      sql`TRUNCATE TABLE projects, gen_jobs, card_images, change_logs RESTART IDENTITY CASCADE`,
    );

    const [project] = await db
      .insert(projects)
      .values({ topic: '红色瓷茶杯木桌', userId: 'demo-real-test' })
      .returning();
    const [card] = await db
      .insert(cards)
      .values({
        projectId: project.id,
        index: 0,
        role: 'cover',
        title: '红瓷茶杯',
        body: '木桌上的红色瓷茶杯，自然光俯拍。',
        version: 1,
      })
      .returning();

    const fakeJob = {
      id: '00000000-0000-4000-8000-000000000a01',
      projectId: project.id,
      status: 'running' as const,
      mainSubject: {
        description: '红色瓷茶杯放在木桌上，自然光，俯视',
        refImages: [],
        locks: [],
      },
      artStyle: '真实摄影',
      textLayout: 'top' as const,
      startedAt: new Date(),
      completedAt: null,
    };

    const client = buildOpenAIClient({ AIHUBMIX_API_KEY: apiKey });
    const t0 = Date.now();
    const result = await generateCardImage(client, { card, job: fakeJob, topic: project.topic });
    const ms = Date.now() - t0;

    expect(result.b64.length).toBeGreaterThan(1000); // real PNG is at least many KB b64
    expect(result.model).toBe('gpt-image-2');
    expect(result.fullPrompt).toContain('红色瓷茶杯');

    const bytes = Buffer.from(result.b64, 'base64');
    // PNG magic header: 89 50 4E 47 0D 0A 1A 0A
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);

    console.log(`[real-test] gpt-image-2 latency: ${ms}ms, png size: ${bytes.length} bytes`);
  }, 360_000); // 6min wall, p95 of gpt-image-2 per memory
});
