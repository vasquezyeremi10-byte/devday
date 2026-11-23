import { defineConfig } from '@playwright/test';

/** Puerto del servidor de desarrollo; MINA_PORT permite usar otro libre. */
const env = (
  globalThis as { process?: { env: Record<string, string | undefined> } }
).process?.env;
const port = env?.MINA_PORT ?? '5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    channel: 'msedge',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
