import { defineConfig } from '@playwright/test';

// Runs against the fictional in-browser data mode. Database permissions are covered by tests/rls.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:5175', trace: 'retain-on-failure', locale: 'zh-TW' },
  projects: [
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-375', use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --mode demo --port 5175',
    url: 'http://localhost:5175',
    reuseExistingServer: true,
  },
});
