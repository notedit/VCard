import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    testTimeout: 90000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // tests share one Neon test branch
    // Files truncate shared tables in beforeEach, so a parallel file's TRUNCATE
    // can wipe out another file's seed mid-test.
    // Force serial file execution to match the single-DB constraint.
    fileParallelism: false,
  },
});
