// Cloudflare Workers entrypoint.
// - fetch: Hono app (HTTP + AI SDK UI Stream)
// - queue: dispatcher for gen-image-jobs + suggestion-reflect (MVP-2)
// DOs are re-exported by class name so wrangler can map class_name → runtime class.
//
// Local Node dev: `npm run dev` → tsx watch src/index.ts (uses @hono/node-server,
//                 only fetch path; queues + DOs not exercised — endpoint iteration only).
// Workers dev:    `npx wrangler dev` (full bindings + queues + DOs).
import { app } from './app.js';
import { handleQueueBatch } from './queues/gen-image-consumer.js';

export { AgentSession } from './do/agent-session.js';
export { GenJob } from './do/gen-job.js';

export default {
  fetch: app.fetch,
  queue: handleQueueBatch,
};
