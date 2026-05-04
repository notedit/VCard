import { config } from 'dotenv';
import os from 'node:os';
import path from 'node:path';

// Load ~/.secrets/common.env so DATABASE_URL_TEST + AIHUBMIX_API_KEY etc are available.
// dotenv parses with regex (not shell), so values containing `&` don't need quoting here.
config({ path: path.join(os.homedir(), '.secrets/common.env') });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST not set. Add to ~/.secrets/common.env (single-quoted if value contains &)',
  );
}
