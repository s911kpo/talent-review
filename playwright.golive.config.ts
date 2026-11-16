import { defineConfig } from '@playwright/test';
import { env } from './tests/golive/env';

// Go-live acceptance against a real backend with fictional accounts. See tests/golive/golive.spec.ts.
const remote = process.env.GOLIVE_BASE_URL;
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;

export default defineConfig({
  testDir: 'tests/golive',
  timeout: 180_000,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/golive', open: 'never' }]],
  use: {
    baseURL: remote ?? 'http://localhost:5178', locale: 'zh-TW',
    // GOLIVE_MOBILE=1 runs at phone width.
    viewport: process.env.GOLIVE_MOBILE ? { width: 375, height: 812 } : { width: 1440, height: 900 },
    proxy, trace: 'retain-on-failure', acceptDownloads: true,
  },
  webServer: remote ? undefined : {
    command: 'node node_modules/vite/bin/vite.js --port 5178 --strictPort',
    url: 'http://localhost:5178',
    reuseExistingServer: false,
    timeout: 120_000,
    // Values already in the environment win over Vite's .env files, so this points the app at the target.
    env: { VITE_SUPABASE_URL: env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY, VITE_AI_ENABLED: 'false' },
  },
});
