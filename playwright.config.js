// Playwright runs the real app in Chromium using hardware acceleration locally or SwiftShader in CI.
// The camera tests use Chromium's fake webcam, so no physical camera or permission prompt is needed.
import { defineConfig } from '@playwright/test';

import { gpuArgs } from './tests/runtime.js';

export default defineConfig({
  testDir: 'tests',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    permissions: ['camera'],
    launchOptions: {
      args: [...gpuArgs, '--enable-gpu', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
    trace: 'retain-on-failure',
  },
  webServer: { command: 'node server.mjs 5173', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 30_000 },
});
