import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = Number(process.env.PORT ?? 8787);
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set; source ~/.secrets/common.env first');
  process.exit(1);
}

const env = {
  DATABASE_URL,
  AIHUBMIX_API_KEY: process.env.AIHUBMIX_API_KEY,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
};

serve({
  fetch: (req) => app.fetch(req, env),
  port,
});

console.log(`API on http://localhost:${port}`);
