import { syncDevVars } from './dev-vars-lib.mjs';

try {
  const result = syncDevVars();
  console.log(`Synced ${result.keys.join(', ')} from ${result.source} -> ${result.target}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  console.error('Add DATABASE_URL and AIHUBMIX_API_KEY to ~/.secrets/common.env.');
  process.exit(1);
}
