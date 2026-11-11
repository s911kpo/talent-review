import { defineConfig } from '@playwright/test';

// Plant-scale UI timing: 5,000 fictional employees in the in-browser demo. Run: npm run test:stress:ui
export default defineConfig({
  testDir: 'tests/stress',
  testMatch: /.*\.spec\.ts/,
  timeout: 180_000,
  use: { baseURL: 'http://localhost:5176', locale: 'zh-TW', viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --mode stress --port 5176 --strictPort',
    url: 'http://localhost:5176',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
