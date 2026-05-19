const { test: base } = require('@playwright/test');
const { remote } = require('webdriverio');
const { execFileSync } = require('child_process');
const { APPIUM_SERVER, APK_PATH, IPA_PATH, DEVICES } = require('../config/devices.config');

/**
 * Grant location perms to io.appium.settings on the given Android emulator.
 *
 * The Appium settings helper declares a ForegroundService with type=location;
 * on Android API 34+ that requires runtime ACCESS_*_LOCATION granted before
 * the service can start. Without it the helper crashes with SecurityException
 * → Appium's instrumentation init fails before our session is created.
 *
 * Runs pre-session via raw adb (not mobile:shell) because the WebdriverIO
 * session wouldn't have started yet. Cloud providers (no adb access) silently
 * skip. CI workflow grants these separately too — this is belt-and-suspenders
 * for local emulator boots where the developer would otherwise have to remember.
 */
function grantAppiumSettingsLocationPerms(udid) {
  if (!udid || !String(udid).startsWith('emulator-')) return; // cloud/real-device — skip
  const perms = ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'];
  for (const perm of perms) {
    try {
      execFileSync('adb', ['-s', udid, 'shell', 'pm', 'grant', 'io.appium.settings', perm], { stdio: 'ignore' });
    } catch {
      // Already granted, or perm doesn't apply on this API level — either is fine.
    }
  }
}

/**
 * appFixture — creates one WebdriverIO Appium session per Playwright worker.
 * Supports both Android (UIAutomator2) and iOS (XCUITest).
 */
const test = base.extend({
  driver: [
    async ({}, use, workerInfo) => {
      const device = workerInfo.project.use.deviceConfig || DEVICES[0];
      const isAndroid = device.platform === 'android';

      console.log(`[appFixture] Initializing ${device.platform.toUpperCase()} on ${device.name} (${device.udid})`);

      // Pre-flight: grant io.appium.settings location perms on Android so its
      // ForegroundService doesn't crash on API 34+ before our session starts.
      if (isAndroid) {
        grantAppiumSettingsLocationPerms(device.udid);
      }

      const commonCaps = {
        'appium:deviceName': device.name,
        'appium:udid': device.udid,
        'appium:noReset': true,
        'appium:fullReset': false,
        'appium:newCommandTimeout': 300,
      };

      const androidCaps = {
        platformName: 'Android',
        'appium:automationName': 'UIAutomator2',
        'appium:systemPort': device.systemPort,
        'appium:chromeDriverPort': device.chromeDriverPort,
        'appium:appPackage': 'com.taqelah.demo_app',
        'appium:appActivity': 'com.taqelah.demo_app.MainActivity',
        'appium:autoGrantPermissions': true,
        ...(APK_PATH ? { 'appium:app': APK_PATH } : {}),
      };

      const iosCaps = {
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:wdaLocalPort': device.wdaLocalPort,
        'appium:bundleId': 'com.taqelah.demoApp', // Typical Flutter iOS bundle
        ...(IPA_PATH ? { 'appium:app': IPA_PATH } : {}),
      };

      const capabilities = {
        ...commonCaps,
        ...(isAndroid ? androidCaps : iosCaps),
      };

      const driver = await remote({
        ...APPIUM_SERVER,
        capabilities,
        logLevel: 'warn',
      });

      // Android-specific: Detect gesture navigation
      let hasGestureNav = false;
      if (isAndroid) {
        try {
          const navMode = await driver.execute('mobile: shell', {
            command: 'settings',
            args: ['get', 'secure', 'navigation_mode'],
          });
          hasGestureNav = String(navMode).trim() === '2';
        } catch {}
      }

      driver._deviceProfile = {
        name: device.name,
        scrollPercent: device.scrollPercent,
        settlePause: device.settlePause,
        hasGestureNav,
      };

      await use(driver);

      await driver.deleteSession().catch((err) => {
        console.warn(`[appFixture] deleteSession warning: ${err.message}`);
      });
    },
    { scope: 'worker' },
  ],

  /**
   * Auto-fixture: after a failed test, ping the driver; if the session is
   * dead (e.g. UiAutomator2 instrumentation crashed mid-test), reload it
   * so the next test in the same worker starts with a live session.
   *
   * Triggers only on test failure → zero overhead on green runs. Without
   * this, an upstream crash (observed: Location TC-LO02 GPS timeout →
   * instrumentation crash) cascades into every downstream spec failing
   * with `invalid session id` at beforeAll time.
   *
   * `driver.reloadSession()` reuses the original capabilities, so the
   * Android/iOS branching and pre-flight perms set at session creation
   * carry over. App state survives because the original session uses
   * `noReset: true`.
   */
  _autoSessionRecovery: [
    async ({ driver }, use, testInfo) => {
      await use();
      if (testInfo.status === testInfo.expectedStatus) return;

      // Bounded ping — without a timeout, `getPageSource()` itself can hang
      // for minutes when UIA2 is half-dead (observed CI run 25982400098:
      // LO02 fail → 3m31s before next test). If the ping doesn't resolve
      // within 5s, treat the session as dead.
      const pingT0 = Date.now();
      const pingTimeout = 5000;
      let sessionAlive = false;
      try {
        await Promise.race([
          driver.getPageSource().then(() => { sessionAlive = true; }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), pingTimeout)),
        ]);
      } catch (err) {
        // fall through to reload
      }
      console.log(`[recovery] ping took ${Date.now() - pingT0}ms, sessionAlive=${sessionAlive}`);
      if (sessionAlive) return;

      console.warn(`[recovery] session dead after failed test "${testInfo.title}"; reloading`);
      const reloadT0 = Date.now();
      try {
        // Bound the reload too — on a hosed AVD it can never complete.
        await Promise.race([
          driver.reloadSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('reload timeout')), 60000)),
        ]);
        console.log(`[recovery] session reloaded in ${Date.now() - reloadT0}ms`);
      } catch (reloadErr) {
        console.error(`[recovery] reloadSession failed after ${Date.now() - reloadT0}ms: ${reloadErr.message}`);
      }
    },
    { auto: true },
  ],
});

const { expect } = base;
module.exports = { test, expect };
