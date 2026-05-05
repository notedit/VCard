import { tool } from 'ai';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { suggestions } from '../../db/schema.js';

export type ProposeSuggestionCtx = {
  db: Db;
  projectId: string;
  cardId?: string | null;
};

/**
 * propose_suggestion DOES write to the DB (suggestions table). The reflect
 * agent runs in a queue consumer with no client SSE — it's fire-and-forget,
 * so the agent's tool calls are the only persistence path. The frontend
 * polls `GET /projects/:id/suggestions` (TODO endpoint) to surface them.
 *
 * Dedup: if a pending suggestion with the same (projectId, cardId, type)
 * already exists, skip the insert. Frequent edit/reorder/regen would
 * otherwise pile up duplicates (every reflect cycle, the agent re-runs the
 * same heuristics and re-proposes the same issue).
 */
export function proposeSuggestionTool(ctx: ProposeSuggestionCtx) {
  return tool({
    description:
      '提出一条对当前项目的改进建议。会落到 suggestions 表，用户在前端看到并可接受 / 忽略。',
    inputSchema: z.object({
      type: z.enum(['structure', 'platform_sop', 'quality']),
      message: z.string().min(1).max(200),
      actionLabel: z.string().min(1).max(40),
      actionPayload: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async ({ type, message, actionLabel, actionPayload }) => {
      const cardId = ctx.cardId ?? null;
      const cardClause = cardId === null ? isNull(suggestions.cardId) : eq(suggestions.cardId, cardId);
      const existing = await ctx.db.query.suggestions.findFirst({
        where: and(
          eq(suggestions.projectId, ctx.projectId),
          cardClause,
          eq(suggestions.type, type),
          eq(suggestions.status, 'pending'),
        ),
      });
      if (existing) {
        return { id: existing.id, type: existing.type, message: existing.message, deduped: true };
      }

      const [row] = await ctx.db
        .insert(suggestions)
        .values({
          projectId: ctx.projectId,
          cardId,
          type,
          message,
          actionLabel,
          actionPayload,
        })
        .returning();
      return { id: row.id, type: row.type, message: row.message };
    },
  });
}
