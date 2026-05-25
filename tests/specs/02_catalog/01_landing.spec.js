// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { ProductGridPage } = require('../../pages/ProductGridPage');
const { CartPage } = require('../../pages/CartPage');
const products = require('../../data/products');

// ─────────────────────────────────────────────────────────────────────────────
// Retry-recoverable cascade design (same as Products + Location specs).
//
// Playwright retries re-run the test body only — not `beforeAll`, not prior
// TCs. CI run 25980717553 surfaced exactly this for TC-C04: attempt 1 left
// the grid scrolled at the bottom, attempts 2 & 3 then swiped against dead
// air (stuck at 6/32 collected). See `feedback-mid-cascade-retry`.
//
// Each TC's screen-mutating actions live in a module-level `actions<TC>()`
// helper. `beforeEach` checks `testInfo.retry > 0`; on retry it resets the
// app and replays every prior TC's actions in order so the failed TC restarts
// from the exact state the green cascade would.
// ─────────────────────────────────────────────────────────────────────────────

const TC_SEQUENCE = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07'];

test.describe('Catalog Module - Landing UI Master Check', () => {
  /** @type {LoginPage} */ let loginPage;
  /** @type {CatalogLandingPage} */ let landingPage;
  /** @type {ProductGridPage} */ let gridPage;
  /** @type {CartPage} */ let cartPage;

  async function fullResetAndLogin(driver) {
    if (loginPage.isAndroid) {
      await driver.execute('mobile: shell', { command: 'pm', args: ['clear', loginPage.appPackage] });
      await driver.pause(2500);
      await driver.execute('mobile: shell', { command: 'am', args: ['start', '-W', '-n', `${loginPage.appPackage}/.MainActivity`] });
      await driver.pause(1500);
    } else {
      // iOS has no `pm clear` equivalent — terminate + relaunch the app via
      // XCUITest mobile extensions. `noReset: true` keeps app data AND the
      // session persists across relaunch (proven by TC-L06), so the app may
      // come back already logged in on Landing rather than the cold Login
      // screen. The conditional login below handles both cases.
      await driver.execute('mobile: terminateApp', { bundleId: loginPage.appPackage });
      await driver.pause(1500);
      await driver.execute('mobile: launchApp', { bundleId: loginPage.appPackage });
      await driver.pause(1500);
    }

    // Log in only if the Login screen is present. WAIT for the login button
    // rather than single-shot isVisible: after a pm clear cold relaunch Flutter
    // takes hundreds of ms to draw it, so a single-shot check can race false and
    // SKIP login → app stuck on Login → landing never appears (Android cold-render
    // race, same class as the LO01 fix). waitForDisplayed absorbs the lag; on
    // iOS's persisted session it times out → skip login (already authenticated).
    let needsLogin = true;
    try {
      await loginPage.waitForDisplayed(loginPage.loginButton, 15000);
    } catch {
      needsLogin = false;
    }
    if (needsLogin) {
      await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
    }
    await landingPage.waitForPageLoad();
  }

  // ─── Per-TC action helpers (no assertions) ───
  async function actionsC01() {
    await landingPage.waitForPageLoad();
    await landingPage.scrollToCategory('Boho');
    await landingPage.resetToTop();
  }

  async function actionsC02() {
    await landingPage.navigateToCart();
    await cartPage.waitForPageLoad();
    await cartPage.clickContinueShopping();
    await landingPage.waitForPageLoad();
  }

  async function actionsC03() {
    await landingPage.navigateToShopAll();
    await gridPage.waitForPageLoad();
  }

  async function actionsC04() {
    await gridPage.verifyFullCatalogIntegrity();
  }

  async function actionsC05(driver) {
    const sorts = [
      { mode: 'LowHigh' },
      { mode: 'HighLow' },
      { mode: 'ZA' },
      { mode: 'AZ' },
    ];
    const { width } = await driver.getWindowRect();
    const isTablet = width > 1200;
    await gridPage.resetToTop(3);
    for (let i = 0; i < sorts.length; i++) {
      await gridPage.openSortMenu();
      await gridPage.selectSort(sorts[i].mode);
      if (i === 0) await gridPage.resetToTop(isTablet ? 3 : 2);
    }
  }

  async function actionsC06() {
    await gridPage.navigateToCart();
    await cartPage.waitForPageLoad();
    await cartPage.clickContinueShopping();
    await gridPage.waitForPageLoad();
  }

  async function actionsC07() {
    await gridPage.deviceBack();
    await landingPage.waitForPageLoad();
    await landingPage.navigateToViewAll();
    await gridPage.waitForPageLoad();
  }

  const ACTIONS = {
    C01: actionsC01,
    C02: actionsC02,
    C03: actionsC03,
    C04: actionsC04,
    C05: actionsC05,
    C06: actionsC06,
    C07: actionsC07,
  };

  async function replayCascadeUpTo(driver, targetTC) {
    const idx = TC_SEQUENCE.indexOf(targetTC);
    if (idx < 0) throw new Error(`Unknown TC for replay: ${targetTC}`);
    await fullResetAndLogin(driver);
    for (let i = 0; i < idx; i++) {
      const tc = TC_SEQUENCE[i];
      console.log(`[replay] running actions${tc} to restore state for ${targetTC}`);
      await ACTIONS[tc](driver);
    }
  }

  test.beforeAll(async ({ driver }) => {
    loginPage = new LoginPage(driver);
    landingPage = new CatalogLandingPage(driver);
    gridPage = new ProductGridPage(driver);
    cartPage = new CartPage(driver);

    const isLoggedOut = await loginPage.isVisible(loginPage.loginButton);
    if (isLoggedOut) {
      await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
      await landingPage.waitForPageLoad();
    }
  });

  test.beforeEach(async ({ driver }, testInfo) => {
    if (testInfo.retry === 0) return;
    const m = testInfo.title.match(/TC-(C0\d)/);
    if (!m) return;
    const tc = m[1];
    console.log(`[beforeEach] retry #${testInfo.retry} for ${tc} — replaying cascade`);
    await replayCascadeUpTo(driver, tc);
  });

  test('TC-C01: should verify Homepage comprehensive UI and adaptive scroll', async ({ driver }) => {
    await landingPage.waitForPageLoad();

    expect(await landingPage.isVisible(landingPage.navMenuBtn)).toBe(true);
    expect(await landingPage.isVisible(landingPage.title)).toBe(true);

    await landingPage.scrollToCategory('Boho');
    expect(await landingPage.isVisible(landingPage.categoryBoho)).toBe(true);

    await landingPage.resetToTop();
    expect(await landingPage.isVisible(landingPage.heroBanner)).toBe(true);
  });

  test('TC-C02: should verify the Cart empty state from Homepage', async ({ driver }) => {
    await landingPage.navigateToCart();
    await cartPage.waitForPageLoad();

    expect(await cartPage.isVisible(cartPage.cartTitle)).toBe(true);
    expect(await cartPage.isVisible(cartPage.emptyCartMsg)).toBe(true);

    await cartPage.clickContinueShopping();
    await landingPage.waitForPageLoad();
  });

  test('TC-C03: should verify the "All Dresses" page default state', async ({ driver }) => {
    await landingPage.navigateToShopAll();
    await gridPage.waitForPageLoad();

    const firstProduct = await gridPage.getFirstProductDetails();
    expect(firstProduct).toContain(products.anchors.alphaFirst.name);
  });

  test('TC-C04: should verify Full Catalog Data Integrity', async ({ driver }) => {
    // Tablet-only timeout branch. Diagnosis (2026-05-20): the deterministic
    // half-viewport scan reaches 30/32 by flick ~50 and finishes ~flick 53
    // (~195-200s) on the Pixel Tablet — its denser grid + slower a11y bridge
    // make each flick cost ~3.6s. Progress is steady/monotonic (not a stall),
    // so the scan mechanics are correct; it's purely ~10% over the 180s budget.
    // Give tablet headroom rather than speeding up the scroll (faster scrolling
    // re-introduces the a11y-bridge race the slow scan was built to avoid).
    // Phone path is untouched at 180s.
    const { width } = await driver.getWindowRect();
    const isTablet = width > 1200;
    test.setTimeout(isTablet ? 300000 : 180000);
    const catalogIntact = await gridPage.verifyFullCatalogIntegrity();
    expect(catalogIntact).toBe(true);
  });

  test('TC-C05: should verify all sorting modes using Universal Truths', async ({ driver }) => {
    const sorts = [
      { mode: 'LowHigh', anchor: products.anchors.cheapest.price },
      { mode: 'HighLow', anchor: products.anchors.mostExpensive.price },
      { mode: 'ZA', anchor: products.anchors.alphaLast.name },
      { mode: 'AZ', anchor: products.anchors.alphaFirst.name },
    ];

    const { width } = await driver.getWindowRect();
    const isTablet = width > 1200;

    await gridPage.resetToTop(3);

    for (let i = 0; i < sorts.length; i++) {
      await gridPage.openSortMenu();
      await gridPage.selectSort(sorts[i].mode);

      if (i === 0) {
        await gridPage.resetToTop(isTablet ? 3 : 2);
      }

      const details = await gridPage.getFirstProductDetails();
      expect(details).toContain(sorts[i].anchor);
    }
  });

  test('TC-C06: should verify Cart empty state from Grid', async ({ driver }) => {
    await gridPage.navigateToCart();
    await cartPage.waitForPageLoad();
    expect(await cartPage.isVisible(cartPage.cartTitle)).toBe(true);

    await cartPage.clickContinueShopping();
    await gridPage.waitForPageLoad();
  });

  test('TC-C07: should verify the "View All" hyperlink routing', async ({ driver }) => {
    await gridPage.deviceBack();
    await landingPage.waitForPageLoad();

    await landingPage.navigateToViewAll();
    await gridPage.waitForPageLoad();

    const firstProduct = await gridPage.getFirstProductDetails();
    expect(firstProduct).toContain(products.anchors.alphaFirst.name);
  });
});
