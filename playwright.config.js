// @ts-check
const { defineConfig } = require('@playwright/test');
const { DEVICES } = require('./config/devices.config');

/**
 * Playwright Config: Universal Hybrid Infrastructure
 * Optimized for Local, GitHub Actions, and Cloud (BrowserStack/SauceLabs)
 */
module.exports = defineConfig({
  testDir: './tests/specs',
  fullyParallel: false, // Mobile tests usually require sequential execution per device
  forbidOnly: !!process.env.CI,
  /* 2 retries on CI to absorb emulator-induced flakiness (cold-boot
   * Pixel 6 on a hardware-constrained runner is intermittently slow on
   * Flutter rendering, form submit toast, dialog dismiss animation). Local
   * runs stay at 0 — flakes there indicate a real fix is needed. */
  retries: process.env.CI ? 2 : 0,
  /* Stop on first failure locally to save time */
  maxFailures: process.env.CI ? 0 : 1,
  
  /* Single worker — devices run sequentially to avoid Appium port
   * collisions and UIAutomator2 session crashes that surface when
   * multiple devices share a worker pool. */
  workers: 1,

  reporter: [
    ['html'],
    ['list'],
    ['github'] // Enhanced output inside GHA UI
  ],

  use: {
    /* Base timeout for Appium commands */
    actionTimeout: 30000,
    // No `trace` / `screenshot` — those hook into Playwright's BrowserContext,
    // which doesn't exist in this Appium-driven suite. Mobile diagnostics are
    // captured by `_iosFailureDiagnostic` in fixtures/appFixture.js (page
    // source XML + screenshot on iOS+CI failures, written to
    // test-results/diagnostics/).
  },

  /* 
   * PROJECT MATRIX 
   * Dynamically maps our Device Registry to Playwright Projects.
   */
  projects: DEVICES.map((device) => ({
    name: device.name,
    use: { 
      deviceConfig: device,
      // Placeholder for Cloud Provider credentials
      isCloud: !!process.env.CLOUD_PROVIDER,
      cloudProvider: process.env.CLOUD_PROVIDER || 'local'
    },
    timeout: device.testTimeout || 180000,
  })),
});
