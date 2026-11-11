import { defineConfig } from 'vitest/config';

// Slow scale tests, run on demand: npm run test:stress
export default defineConfig({
  test: { include: ['tests/stress/**/*.test.ts'], testTimeout: 600_000, hookTimeout: 600_000, fileParallelism: false },
});
