import { tool } from 'ai';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import { cards, changeLogs } from '../../db/schema.js';

export type CreateCardCtx = {
  db: Db;
  projectId: string;
};

export function createCardTool(ctx: CreateCardCtx) {
  return tool({
    description:
      '在当前项目里写入一张卡片。按 index 0..(N-1) 顺序生成；同一 index 不要重复创建。',
    inputSchema: z.object({
      index: z.number().int().min(0).max(8),
      role: z.enum(['cover', 'hook', 'argument', 'list', 'payoff', 'cta']),
      title: z.string().min(1).max(18),
      body: z.string().min(1).max(80),
    }),
    execute: async (input) => {
      const [row] = await ctx.db
        .insert(cards)
        .values({
          projectId: ctx.projectId,
          index: input.index,
          role: input.role,
          title: input.title,
          body: input.body,
          version: 1,
        })
        .returning();

      // ChangeLog written best-effort after the insert (no transaction on neon-http).
      // Failure here means an orphaned audit gap, not a corrupted card.
      await ctx.db.insert(changeLogs).values({
        projectId: ctx.projectId,
        actor: 'agent',
        target: 'card',
        targetId: row.id,
        action: 'create_card',
        before: null,
        after: row,
      });

      return { id: row.id, index: row.index, role: row.role };
    },
  });
}
