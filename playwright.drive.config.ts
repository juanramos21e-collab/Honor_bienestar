import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/drive-browser', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 393, height: 851 },
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {},
  },
  webServer: { command: 'npm run dev -- --port 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI },
});
