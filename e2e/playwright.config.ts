import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  globalSetup: './global-setup.ts',
  workers: 1, // one shared database: tests must not interleave
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure', storageState: '.auth.json' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 800 } } },
    // The narrow phone-width layout is where hint text and buttons overflowed.
    { name: 'narrow', use: { viewport: { width: 390, height: 800 } }, testMatch: /layout\.spec\.ts/ },
  ],
})
