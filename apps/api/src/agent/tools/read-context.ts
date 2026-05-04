import { tool } from 'ai';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import { cards, projects } from '../../db/schema.js';

export type ReadContextCtx = {
  db: Db;
  projectId: string;
};

/** read_project: a snapshot of the project + all cards with title/body. */
export function readProjectTool(ctx: ReadContextCtx) {
  return tool({
    description: '读取项目元信息和所有卡片简要内容（title/body）。',
    inputSchema: z.object({}),
    execute: async () => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, ctx.projectId),
      });
      if (!project) return { project: null, cards: [] };
      const projectCards = await ctx.db
        .select({
          index: cards.index,
          role: cards.role,
          title: cards.title,
          body: cards.body,
          userEdited: cards.userEdited,
        })
        .from(cards)
        .where(eq(cards.projectId, ctx.projectId))
        .orderBy(asc(cards.index));
      return {
        project: {
          topic: project.topic,
          status: project.status,
          platform: project.platform,
          skillIds: project.skillIds,
        },
        cards: projectCards,
      };
    },
  });
}

/** read_card: full row of one card (when reflecting on a specific edit). */
export function readCardTool(ctx: ReadContextCtx) {
  return tool({
    description: '读取一张卡片的完整内容（含标题、正文、role、index）。',
    inputSchema: z.object({
      cardId: z.string().uuid(),
    }),
    execute: async ({ cardId }) => {
      const card = await ctx.db.query.cards.findFirst({ where: eq(cards.id, cardId) });
      if (!card) return { found: false };
      return {
        found: true,
        index: card.index,
        role: card.role,
        title: card.title,
        body: card.body,
        userEdited: card.userEdited,
      };
    },
  });
}
