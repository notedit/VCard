// Cloudflare Workers entrypoint. The existing Hono app from `app.ts` is
// runtime-agnostic, so the default export is the app itself.
//
// DO classes must be re-exported by class name so wrangler can map
// `class_name = "AgentSession"` (in wrangler.toml) to the runtime class.
//
// Local Node dev: `npm run dev` → tsx watch src/index.ts (uses @hono/node-server,
//                 DOs are not exercised — that path is for endpoint iteration only).
// Workers dev:    `npx wrangler dev` (uses this file, full bindings + DOs).
import { app } from './app.js';

export { AgentSession } from './do/agent-session.js';
export { GenJob } from './do/gen-job.js';

export default app;
