import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const demoStub = fileURLToPath(new URL('./src/data/demo.stub.ts', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  envDir: '.',
  server: { port: 5173, strictPort: true },
  // Outside demo mode, the fictional demo data module is swapped for a stub (see src/data/demo.stub.ts).
  resolve: ['demo', 'showcase', 'stress', 'test'].includes(mode) ? {} : { alias: [{ find: /^\.\/demo$/, replacement: demoStub }] },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/rls/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 120000,
  },
}));
