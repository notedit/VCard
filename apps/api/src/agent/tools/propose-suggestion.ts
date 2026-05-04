import { tool } from 'ai';
import { z } from 'zod';
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
      const [row] = await ctx.db
        .insert(suggestions)
        .values({
          projectId: ctx.projectId,
          cardId: ctx.cardId ?? null,
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
