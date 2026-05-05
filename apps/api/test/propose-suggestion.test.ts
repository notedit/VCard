import { beforeEach, describe, expect, it } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { createDb } from '../src/db/client.js';
import { cards, projects, suggestions } from '../src/db/schema.js';
import { proposeSuggestionTool } from '../src/agent/tools/propose-suggestion.js';

const DATABASE_URL = process.env.DATABASE_URL_TEST!;
const db = createDb(DATABASE_URL);

async function truncateAll() {
  await db.execute(
    sql`TRUNCATE TABLE projects, skills, change_logs, gen_jobs, card_images, suggestions RESTART IDENTITY CASCADE`,
  );
}

async function seedProject(topic = 'dedup test') {
  const [project] = await db.insert(projects).values({ topic, userId: 'demo-user' }).returning();
  return project;
}

async function seedCard(projectId: string, index = 0) {
  const [card] = await db
    .insert(cards)
    .values({
      projectId,
      index,
      role: 'argument',
      title: `c${index}`,
      body: `b${index}`,
      version: 1,
    })
    .returning();
  return card;
}

describe('proposeSuggestionTool — pending dedup', () => {
  beforeEach(truncateAll);

  it('skips insert when a pending suggestion of same (project, card, type) exists', async () => {
    const project = await seedProject();
    const card = await seedCard(project.id);
    const t = proposeSuggestionTool({ db, projectId: project.id, cardId: card.id });

    const first = (await t.execute!(
      { type: 'structure', message: '第 1 条', actionLabel: '看', actionPayload: {} },
      { toolCallId: 't1', messages: [] } as never,
    )) as { id: string; deduped?: boolean };
    expect(first.deduped).toBeUndefined();

    const second = (await t.execute!(
      { type: 'structure', message: '第 2 条 (重复)', actionLabel: '看', actionPayload: {} },
      { toolCallId: 't2', messages: [] } as never,
    )) as { id: string; deduped?: boolean };
    expect(second.deduped).toBe(true);
    expect(second.id).toBe(first.id);

    const rows = await db.select().from(suggestions).where(eq(suggestions.projectId, project.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe('第 1 条'); // first wins, second is no-op
  });

  it('still inserts when type differs', async () => {
    const project = await seedProject();
    const card = await seedCard(project.id);
    const t = proposeSuggestionTool({ db, projectId: project.id, cardId: card.id });

    await t.execute!(
      { type: 'structure', message: '结构问题', actionLabel: 'a', actionPayload: {} },
      { toolCallId: 'a', messages: [] } as never,
    );
    await t.execute!(
      { type: 'platform_sop', message: '平台规范', actionLabel: 'b', actionPayload: {} },
      { toolCallId: 'b', messages: [] } as never,
    );
    await t.execute!(
      { type: 'quality', message: '质量', actionLabel: 'c', actionPayload: {} },
      { toolCallId: 'c', messages: [] } as never,
    );

    const rows = await db.select().from(suggestions).where(eq(suggestions.projectId, project.id));
    expect(rows).toHaveLength(3);
  });

  it('dedups project-level suggestions (cardId=null) separately from card-level', async () => {
    const project = await seedProject();
    const card = await seedCard(project.id);

    const projectLevel = proposeSuggestionTool({ db, projectId: project.id, cardId: null });
    const cardLevel = proposeSuggestionTool({ db, projectId: project.id, cardId: card.id });

    await projectLevel.execute!(
      { type: 'structure', message: '项目级', actionLabel: 'p', actionPayload: {} },
      { toolCallId: 'p', messages: [] } as never,
    );
    await cardLevel.execute!(
      { type: 'structure', message: '卡片级', actionLabel: 'c', actionPayload: {} },
      { toolCallId: 'c', messages: [] } as never,
    );

    const rows = await db.select().from(suggestions).where(eq(suggestions.projectId, project.id));
    expect(rows).toHaveLength(2);

    // Re-trigger project-level — should dedup against the existing project-level row.
    const second = (await projectLevel.execute!(
      { type: 'structure', message: '又一次', actionLabel: 'p', actionPayload: {} },
      { toolCallId: 'p2', messages: [] } as never,
    )) as { deduped?: boolean };
    expect(second.deduped).toBe(true);

    const finalRows = await db.select().from(suggestions).where(eq(suggestions.projectId, project.id));
    expect(finalRows).toHaveLength(2);
  });

  it('does NOT dedup when prior suggestion is accepted/ignored (only pending blocks)', async () => {
    const project = await seedProject();
    const card = await seedCard(project.id);
    const t = proposeSuggestionTool({ db, projectId: project.id, cardId: card.id });

    const first = (await t.execute!(
      { type: 'quality', message: '老建议', actionLabel: '看', actionPayload: {} },
      { toolCallId: 'q1', messages: [] } as never,
    )) as { id: string };

    // User ignored the first suggestion.
    await db.update(suggestions).set({ status: 'ignored' }).where(eq(suggestions.id, first.id));

    // A new pending suggestion of same type should now be allowed.
    const second = (await t.execute!(
      { type: 'quality', message: '新建议', actionLabel: '看', actionPayload: {} },
      { toolCallId: 'q2', messages: [] } as never,
    )) as { id: string; deduped?: boolean };
    expect(second.deduped).toBeUndefined();

    const rows = await db.select().from(suggestions).where(eq(suggestions.projectId, project.id));
    expect(rows).toHaveLength(2);
  });
});
