import { tool } from 'ai';
import { z } from 'zod';

export type ProposeEditOutput = {
  field: 'title' | 'body';
  newValue: string;
  rationale: string;
};

/**
 * propose_edit DOES NOT touch the DB. The execute return value is what the
 * client receives via the AI SDK UI Stream as a tool-result; the user then
 * decides to confirm (frontend calls PATCH /cards/:id) or cancel.
 *
 * Keeping execute side-effect-free means:
 * - Cancel is a no-op — no rollback needed.
 * - Confirm is a single optimistic-locked PATCH — ChangeLog is exactly one row.
 * - The agent can propose multiple revisions in a multi-turn session and the
 *   user picks one; only the chosen one writes.
 */
export function proposeEditTool() {
  return tool({
    description:
      '建议改写当前卡片的某一字段。返回新值后由用户在前端确认；本工具不直接落库。',
    inputSchema: z.object({
      field: z.enum(['title', 'body']),
      newValue: z.string().min(1).max(200),
      rationale: z.string().min(1).max(200),
    }),
    execute: async ({ field, newValue, rationale }): Promise<ProposeEditOutput> => {
      return { field, newValue, rationale };
    },
  });
}
