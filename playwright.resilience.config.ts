import { defineConfig } from '@playwright/test';

// Fault injection against the real Supabase project with the fictional demo accounts.
// Needs .env.local. Run: npm run test:resilience
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;

export default defineConfig({
  testDir: 'tests/resilience',
  timeout: 90_000,
  workers: 1,
  use: { baseURL: 'http://localhost:5177', locale: 'zh-TW', viewport: { width: 1440, height: 900 }, proxy, trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --port 5177 --strictPort',
    url: 'http://localhost:5177',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
