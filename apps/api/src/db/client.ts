import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(databaseUrl: string): Db {
  return drizzle(neon(databaseUrl), { schema });
}

export { schema };
