import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    testTimeout: 90000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }, // tests share one Neon test branch; serialize them
  },
});
