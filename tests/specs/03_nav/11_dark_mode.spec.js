// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { PNG } = require('pngjs');
const { LoginPage } = require('../../pages/LoginPage');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');
const { AboutPage } = require('../../pages/AboutPage');

/**
 * Dark Mode Smoke Suite — cross-cutting visual contract.
 *
 * Flow:
 *   DK01: Default state at Home — drawer Dark Mode toggle OFF. Capture a
 *         3-spot light baseline. Toggle ON → drawer Switch checked=true;
 *         Home avg brightness drops by ≥ DARK_DELTA.
 *   DK02: Walk through every previously-tested page and assert each samples
 *         as dark (avg brightness < baseline − DARK_DELTA). Order:
 *         Catalog Landing → Categories → Cart → About (scroll → confirm the
 *         in-page Dark Mode Switch is also ON; the in-page toggle is bound
 *         to the same global setting) → Gestures → WebView (sampling
 *         skipped — see comment below) → Dialogs → Form → Permissions →
 *         Notifications → Tabs → Camera (deny dialog) → Location (deny
 *         dialog, Pixel 8 only).
 *   DK03: Toggle OFF via drawer → Switch checked=false; Home avg brightness
 *         within ±LIGHT_TOLERANCE of the original light baseline.
 *
 * Sample geometry: three points across the AppBar at fixed `Y = 0.07h`
 * and `X = 0.6w / 0.75w / 0.9w` — right of any centered page title and,
 * on Home, left of the cart icon. The AppBar background is uniformly
 * theme-aware on every screen (page-body sampling fails on Catalog
 * Landing because product imagery has dark colors even in light mode).
 *
 * WebView is NOT sampled: the inner WebView content is web-themed (not
 * app-themed), so even AppBar sampling on the WebView screen is
 * unaffected, but we exclude it for symmetry with future cases where
 * the WebView fills the AppBar. We still navigate in/out to confirm the
 * page doesn't crash under dark theme.
 *
 * Pixel Tablet: only the Location step inside DK02 is skipped — emulator-
 * 5556 GPS does not emit fixes (see 10_location.spec.js for the rationale).
 * DK01, DK03, and the rest of DK02 run on both devices.
 */

const DARK_DELTA = 80;
const LIGHT_TOLERANCE = 30;
const PERMISSION_DENY = 'android=new UiSelector().resourceIdMatches(".*permission_deny.*")';

async function sampleAvgBrightness(driver) {
  const { width, height } = await driver.getWindowRect();
  const base64 = await driver.takeScreenshot();
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  const y = Math.min(Math.round(0.07 * height), png.height - 1);
  const xs = [0.6, 0.75, 0.9].map((p) => Math.min(Math.round(p * width), png.width - 1));
  let sum = 0;
  for (const x of xs) {
    const idx = (png.width * y + x) * 4;
    sum += (png.data[idx] + png.data[idx + 1] + png.data[idx + 2]) / 3;
  }
  return sum / xs.length;
}

async function denyDialogIfPresent(driver, timeoutMs = 4000) {
  try {
    const btn = await driver.$(PERMISSION_DENY);
    await btn.waitForDisplayed({ timeout: timeoutMs });
    await btn.click();
    await driver.pause(1500);
  } catch {
    // No dialog — fine.
  }
}

async function returnHome(driver, navMenu, landingPage) {
  // Most module screens exit to Home on a single device-back. Some screens
  // (e.g. Form auto-focuses an EditText → raises the soft keyboard) eat
  // the first back to dismiss the keyboard, requiring a second tap. We
  // try up to 3 times before failing.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await driver.back();
    await driver.pause(800);
    try {
      await landingPage.waitForDisplayed(landingPage.shopAllBtn, 4000);
      return;
    } catch {
      // not on Home yet — try another back
    }
  }
  // Final attempt: surface the real timeout for diagnosis
  await landingPage.waitForDisplayed(landingPage.shopAllBtn, 4000);
}

test.describe('Navigation - Dark Mode Suite (TC-DK01-DK03)', () => {
  let loginPage, landingPage, navMenu, aboutPage;
  let lightBaseline;

  test.beforeAll(async ({ driver }) => {
    loginPage = new LoginPage(driver);
    landingPage = new CatalogLandingPage(driver);
    navMenu = new NavMenuPage(driver);
    aboutPage = new AboutPage(driver);

    // pm clear is NOT used: dark mode is a benign app setting; previous
    // permission grants/denials are fine context. DK03 turns Dark Mode OFF
    // at the end of every clean run, so DK01 always enters at default OFF.
    //
    // Three valid entry states this beforeAll must recover from:
    //   (a) Cold launch → login screen visible → log in, then Home.
    //   (b) Already on Home (Shop All visible) → done.
    //   (c) Logged in but parked on another screen (e.g. Location's
    //       denied state, which is what TC-LO08 leaves us on in CI's
    //       sequential spec order) → device-back to Home. We can't
    //       drawer-navigate here because some screens (Location denied,
    //       Camera, Settings deep-links) render a Back arrow in their
    //       TopAppBar instead of the hamburger, so navMenu.open() would
    //       time out waiting for "Open navigation menu".
    //
    // Cold-render note: login gate uses waitForDisplayed in a try/catch,
    // not single-shot isVisible. On tablet pm-clear cold launches, Flutter
    // takes hundreds of ms to draw the Login button; isVisible returns
    // false at the first millisecond and skips login. The wait absorbs
    // that render race and falls through cleanly on warm state.
    if (await landingPage.isVisible(landingPage.shopAllBtn)) {
      // (b) already at Home; nothing to do
    } else {
      let loggedIn = true;
      try {
        await loginPage.waitForDisplayed(loginPage.loginButton, 10000);
        loggedIn = false;
      } catch {
        // No login button → already past login, parked elsewhere
      }
      if (!loggedIn) {
        // (a) login screen → log in
        await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
        await landingPage.waitForDisplayed(landingPage.shopAllBtn, 15000);
      } else {
        // (c) logged in elsewhere → back out to Home
        await returnHome(driver, navMenu, landingPage);
      }
    }
  });

  test('TC-DK01: default state shows Dark Mode OFF; toggling ON darkens drawer and Home', async ({ driver }) => {
    // Capture the light baseline BEFORE toggling so DK02/DK03 can compare.
    lightBaseline = await sampleAvgBrightness(driver);
    expect(lightBaseline).toBeGreaterThan(180); // sanity: light AppBar is near-white

    await navMenu.open();
    await navMenu.scrollToItem(navMenu.darkModeToggle);
    expect(await navMenu.isDarkModeActive()).toBe(false);

    await (await driver.$(navMenu.darkModeToggle)).click();
    await driver.pause(800);
    expect(await navMenu.isDarkModeActive()).toBe(true);

    await driver.back();
    await driver.pause(800);
    await landingPage.waitForDisplayed(landingPage.shopAllBtn, 10000);

    const homeDark = await sampleAvgBrightness(driver);
    expect(homeDark).toBeLessThan(lightBaseline - DARK_DELTA);
  });

  test('TC-DK02: every previously-tested page renders dark; About in-page Dark Mode Switch is synced ON', async ({ driver }) => {
    const { width } = await driver.getWindowRect();
    const isTablet = width > 1200;

    // 1. Catalog Landing — already on it, just sample.
    const catalogDark = await sampleAvgBrightness(driver);
    expect(catalogDark, 'Catalog Landing should sample as dark').toBeLessThan(lightBaseline - DARK_DELTA);

    // 2. Shop All product grid — reached from Home's Shop All button.
    await landingPage.navigateToShopAll();
    await driver.pause(1000);
    const shopAllDark = await sampleAvgBrightness(driver);
    expect(shopAllDark, 'Shop All grid should sample as dark').toBeLessThan(lightBaseline - DARK_DELTA);
    await returnHome(driver, navMenu, landingPage);

    // 3. Each individual category page — Casual, Evening, Party, Boho.
    // Category cards live on Home's "Shop by Category" section; tap each
    // from Home, sample the resulting product grid, back to Home, repeat.
    // The "View All" Categories grid is intentionally skipped as redundant
    // with Shop All for dark-mode smoke purposes (both are AppBar + grid).
    for (const cat of ['Casual', 'Evening', 'Party', 'Boho']) {
      await landingPage.selectCategory(cat);
      await driver.pause(1000);
      const catDark = await sampleAvgBrightness(driver);
      expect(catDark, `${cat} category page should sample as dark`).toBeLessThan(lightBaseline - DARK_DELTA);
      await returnHome(driver, navMenu, landingPage);
    }

    // 3. Cart — drawer.
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navCart);
    await driver.pause(800);
    const cartDark = await sampleAvgBrightness(driver);
    expect(cartDark).toBeLessThan(lightBaseline - DARK_DELTA);
    await returnHome(driver, navMenu, landingPage);

    // 4. About — drawer; in-page toggle should be ON (synced with drawer).
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navAbout);
    await aboutPage.waitForPageLoad();
    await driver.pause(500);
    const aboutDark = await sampleAvgBrightness(driver);
    expect(aboutDark, 'About should sample as dark').toBeLessThan(lightBaseline - DARK_DELTA);
    await aboutPage.scrollToBottom();
    expect(await aboutPage.isDarkModeActive(), 'About in-page switch should be ON when drawer toggle is ON').toBe(true);
    await returnHome(driver, navMenu, landingPage);

    // 5–13. Remaining test screens — drawer-navigate, sample, back to Home.
    // WebView is a special case (sampling skipped — web content is not
    // app-themed). Camera and Location prompt OS dialogs on cold entry;
    // deny inline and sample the denied state.
    const walk = [
      { sel: navMenu.navGestures, label: 'Gestures' },
      { sel: navMenu.navWebView, label: 'WebView', skipSample: true },
      { sel: navMenu.navDialogs, label: 'Dialogs' },
      { sel: navMenu.navForm, label: 'Form' },
      { sel: navMenu.navPermissions, label: 'Permissions' },
      { sel: navMenu.navNotifications, label: 'Notifications' },
      { sel: navMenu.navTabs, label: 'Tabs' },
      { sel: navMenu.navCamera, label: 'Camera', denyDialog: true },
      { sel: navMenu.navLocation, label: 'Location', denyDialog: true, phoneOnly: true, preSwipe: true },
    ];

    for (const step of walk) {
      if (step.phoneOnly && isTablet) continue;

      await navMenu.open();
      if (step.preSwipe) {
        // Location sits at the drawer's bottom edge; without a forced swipe
        // the tap can land on a partially-clipped widget. Same drawer-
        // column math as 10_location.spec.js / NavMenuPage.scrollToItem.
        const { width, height } = await driver.getWindowRect();
        const safeX = Math.round(width * (isTablet ? 0.15 : 0.3));
        await navMenu.swipe(safeX, Math.round(height * 0.7), safeX, Math.round(height * 0.3), 800);
      }
      await navMenu.navigateTo(step.sel);
      await driver.pause(800);

      if (step.denyDialog) await denyDialogIfPresent(driver);

      if (!step.skipSample) {
        const sample = await sampleAvgBrightness(driver);
        expect(sample, `${step.label} should sample as dark`).toBeLessThan(lightBaseline - DARK_DELTA);
      }

      // Camera prompts a second (Audio) dialog if Camera was granted earlier;
      // here we always deny Camera first, so Audio never appears. No-op for
      // the rest.
      await returnHome(driver, navMenu, landingPage);
    }
  });

  test('TC-DK03: toggling Dark Mode OFF via drawer restores Home to the light baseline', async ({ driver }) => {
    await navMenu.open();
    await navMenu.scrollToItem(navMenu.darkModeToggle);
    expect(await navMenu.isDarkModeActive()).toBe(true);

    await (await driver.$(navMenu.darkModeToggle)).click();
    await driver.pause(800);
    expect(await navMenu.isDarkModeActive()).toBe(false);

    await driver.back();
    await driver.pause(800);
    await landingPage.waitForDisplayed(landingPage.shopAllBtn, 10000);

    const restored = await sampleAvgBrightness(driver);
    expect(Math.abs(restored - lightBaseline)).toBeLessThan(LIGHT_TOLERANCE);
  });
});
