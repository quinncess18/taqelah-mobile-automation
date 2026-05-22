// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { ProductGridPage } = require('../../pages/ProductGridPage');
const { ProductDetailPage } = require('../../pages/ProductDetailPage');
const { CartPage } = require('../../pages/CartPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');

// ─────────────────────────────────────────────────────────────────────────────
// Retry-recoverable cascade design
//
// Playwright retries re-run the test body only — not `beforeAll`, not prior
// TCs. For a cascading spec that's catastrophic: a CI render-lag spike on
// any mid-cascade TC strands the app in some intermediate state, and all
// retries fail against the same broken state. (See feedback memory
// `feedback-mid-cascade-retry`.)
//
// Each TC's screen-mutating actions live in a module-level `actions<TC>()`
// helper that performs no assertions. The TC body calls its helper, then
// asserts on returned data + on-screen state. `test.beforeEach` checks
// `testInfo.retry > 0` and, when true, does:
//
//   1. `pm clear` + relogin + (tablet) re-apply portrait lock — universal reset.
//   2. Replay every prior TC's actions in this describe, in order, no
//      assertions, so the retry starts from the exact app state the green
//      cascade would be in just before this TC runs.
//
// Green-path cost: zero (beforeEach early-returns on retry === 0).
// Failed-retry cost: ~1–3 min of replay, in exchange for not hard-failing.
// ─────────────────────────────────────────────────────────────────────────────

const TC_SEQUENCE = ['PD01', 'PD02', 'PD03', 'PD04', 'PD05', 'PD06', 'SR01', 'SR02'];

test.describe('Products Module — Product Detail + Add to Cart', () => {
  /** @type {LoginPage} */ let loginPage;
  /** @type {CatalogLandingPage} */ let landingPage;
  /** @type {ProductGridPage} */ let gridPage;
  /** @type {ProductDetailPage} */ let detailPage;
  /** @type {CartPage} */ let cartPage;
  /** @type {NavMenuPage} */ let navMenu;

  // Cascade-shared state: each replay overwrites these because the random
  // picks differ across runs (and across replays). The variant snackbar
  // pair is also captured because TC-PD02 asserts equality.
  /** @type {{ name: string, price: string }} */ let shopAllPick;
  /** @type {string} */ let variantSnack1;
  /** @type {string} */ let variantSnack2;
  /** @type {{ name: string }} */ let casualPick;
  /** @type {{ name: string }} */ let eveningPick;
  /** @type {Set<string>} */ let cocktailAdded;
  /** @type {number} */ let cocktailExpected;

  // ─── Universal reset + relogin + portrait lock (tablet) ───
  async function fullResetAndLogin(driver) {
    // pm clear wipes everything — login, cart, permissions, prefs.
    await driver.execute('mobile: shell', { command: 'pm', args: ['clear', loginPage.appPackage] });
    await driver.pause(2500);
    await driver.execute('mobile: shell', { command: 'am', args: ['start', '-W', '-n', `${loginPage.appPackage}/.MainActivity`] });
    await driver.pause(1500);

    // Re-apply the same Flutter-bridge tuning beforeAll did.
    try { await driver.updateSettings({ waitForIdleTimeout: 0 }); } catch {}

    await loginPage.waitForPageLoad();
    await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
    await landingPage.waitForPageLoad();

    const { width } = await driver.getWindowRect();
    if (width > 1200) {
      try {
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '0'] });
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '1'] });
        await driver.pause(2500);
        await landingPage.waitForPageLoad();
      } catch (e) {
        console.log(`[fullResetAndLogin] orientation lock failed: ${e?.message || e}`);
      }
    }
  }

  // Open Product Detail from a grid pick, tolerant of the Flutter+UIA2 cold-tap
  // race: on a slow CI emulator the first tap can be consumed before the card's
  // gesture handler is wired, so the route never pushes and detailPage's 60s
  // waitForPageLoad still times out on a fully-rendered grid (CI run
  // 26276972532: PD03 sat on the Casual grid, badge correct, after the full
  // wait — the tap, not the render, was the miss). Re-pick + re-tap, but only
  // while we're still on the grid, so we never re-tap a slow-but-loading Detail.
  async function openDetailFromPick(driver, pick, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      await pick.el.click();
      try {
        await detailPage.waitForPageLoad();
        return pick;
      } catch (err) {
        const stillOnGrid = await gridPage.isVisible(gridPage.firstProductCard);
        if (i === attempts - 1 || !stillOnGrid) throw err;
        // Tap didn't route. The prior element ref may be stale → re-pick + retry.
        pick = await gridPage.pickRandomProduct();
      }
    }
    return pick;
  }

  // ─── Per-TC action helpers (no assertions; mutate state + capture data) ───
  async function actionsPD01(driver) {
    await landingPage.navigateToShopAll();
    await gridPage.waitForPageLoad();
    let pick = await gridPage.pickRandomProduct();
    pick = await openDetailFromPick(driver, pick);
    shopAllPick = { name: pick.name, price: pick.price };
    return pick;
  }

  /** @type {number} */ let variantCartLineCount;

  async function actionsPD02(driver) {
    await detailPage.waitForPageLoad();
    await detailPage.selectColorByInstance(0);
    variantSnack1 = await detailPage.addToCart();
    await detailPage.waitForSnackbarDismissed();
    await detailPage.selectColorByInstance(1);
    variantSnack2 = await detailPage.addToCart();
    await detailPage.waitForSnackbarDismissed();
    await driver.back();
    await gridPage.waitForPageLoad();
    const gridCartBtn = await driver.$(gridPage.cartBtn);
    await gridCartBtn.click();
    await cartPage.waitForPageLoad();
    variantCartLineCount = await cartPage.getLineCount();
    await driver.back();
    await gridPage.waitForPageLoad();
  }

  /** @type {number} */ let casualGridBadge;

  async function actionsPD03(driver) {
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navHome);
    await landingPage.waitForPageLoad();
    await landingPage.selectCategory('Casual');
    await gridPage.waitForPageLoad();
    casualGridBadge = await gridPage.getCartBadgeCount();
    let pick = await gridPage.pickRandomProduct();
    pick = await openDetailFromPick(driver, pick);
    casualPick = { name: pick.name };
    return pick;
  }

  async function actionsPD04(driver) {
    await detailPage.waitForPageLoad();
    const snack = await detailPage.addToCart();
    await detailPage.waitForSnackbarDismissed();
    await driver.back();
    await gridPage.waitForPageLoad();
    return snack;
  }

  async function actionsPD05(driver) {
    await driver.back();
    await landingPage.waitForPageLoad();
    await landingPage.selectCategory('Evening');
    await gridPage.waitForPageLoad();
  }

  async function actionsPD06(driver) {
    await gridPage.waitForPageLoad();
    const pick = await gridPage.pickRandomProductDirectAdd();
    await pick.addBtn.click();
    const snackText = await gridPage.getAddedSnackbarText();
    await gridPage.waitForSnackbarDismissed();
    eveningPick = { name: pick.name };
    return { pick, snackText };
  }

  async function actionsSR01(driver) {
    await driver.back();
    await landingPage.waitForPageLoad();
    await landingPage.selectCategory('Party');
    await gridPage.waitForPageLoad();
    await gridPage.searchProducts('Cocktail');

    const counterText = await (await driver.$(gridPage.resultCount)).getAttribute('content-desc');
    const counterMatch = counterText.match(/Showing\s+(\d+)\s+of\s+\d+\s+items/);
    cocktailExpected = counterMatch ? parseInt(counterMatch[1], 10) : 3;

    const { width, height } = await driver.getWindowRect();
    const safeX = Math.round(width * 0.3);
    await gridPage.swipe(safeX, Math.round(height * 0.7), safeX, Math.round(height * 0.3), 800);
    await driver.pause(gridPage.settlePause);

    cocktailAdded = new Set();
    const perTapSnacks = [];
    const maxIterations = 5;
    for (let iter = 0; iter < maxIterations; iter++) {
      const visible = (await gridPage.getVisibleProductNames()).reverse();
      for (const name of visible) {
        if (cocktailAdded.has(name)) continue;
        await gridPage.tapDirectAddByName(name);
        const snackText = await gridPage.getAddedSnackbarText();
        perTapSnacks.push({ name, snackText });
        await gridPage.waitForSnackbarDismissed();
        cocktailAdded.add(name);
      }
      if (cocktailAdded.size >= cocktailExpected) break;
      await gridPage.swipe(safeX, Math.round(height * 0.3), safeX, Math.round(height * 0.7), 800);
      await driver.pause(gridPage.settlePause);
    }
    return perTapSnacks;
  }

  async function actionsSR02(driver) {
    await driver.back();
    await landingPage.waitForPageLoad();
    await landingPage.selectCategory('Boho');
    await gridPage.waitForPageLoad();
    await gridPage.searchProducts('shorts');
  }

  const ACTIONS = {
    PD01: actionsPD01,
    PD02: actionsPD02,
    PD03: actionsPD03,
    PD04: actionsPD04,
    PD05: actionsPD05,
    PD06: actionsPD06,
    SR01: actionsSR01,
    SR02: actionsSR02,
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
    try { await driver.updateSettings({ waitForIdleTimeout: 0 }); } catch {}

    loginPage = new LoginPage(driver);
    landingPage = new CatalogLandingPage(driver);
    gridPage = new ProductGridPage(driver);
    detailPage = new ProductDetailPage(driver);
    cartPage = new CartPage(driver);
    navMenu = new NavMenuPage(driver);

    // Reach a known anchor (login OR landing) via device-back ×3. Handles
    // the case where a prior spec left the app parked on a deeper screen
    // (e.g. Location-denied after 10_location.spec.js). Mirrors the same
    // returnHome pattern dark-mode uses.
    for (let i = 0; i < 3; i++) {
      if (await loginPage.isVisible(loginPage.loginButton)) break;
      if (await landingPage.isVisible(landingPage.shopAllBtn)) break;
      await driver.back();
      await driver.pause(500);
    }

    if (await loginPage.isVisible(loginPage.loginButton)) {
      await loginPage.waitForPageLoad();
      await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
    }
    await landingPage.waitForPageLoad();

    const { width } = await driver.getWindowRect();
    if (width > 1200) {
      try {
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '0'] });
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '1'] });
        await driver.pause(2500);
        await landingPage.waitForPageLoad();
      } catch (e) {
        console.log(`[beforeAll] orientation lock failed: ${e?.message || e}`);
      }
    }
  });

  test.beforeEach(async ({ driver }, testInfo) => {
    if (testInfo.retry === 0) return;
    const m = testInfo.title.match(/TC-(\w+)/);
    if (!m) return;
    const tc = m[1];
    console.log(`[beforeEach] retry #${testInfo.retry} for ${tc} — replaying cascade`);
    await replayCascadeUpTo(driver, tc);
  });

  test('TC-PD01: should open Product Detail from Shop All and render full layout', async ({ driver }) => {
    const pick = await actionsPD01(driver);

    expect(pick.price).toMatch(/^\$\d+(\.\d{2})?$/);
    expect(await detailPage.isVisible(detailPage.byContentDesc(pick.name))).toBe(true);
    expect(await detailPage.isVisible(detailPage.byContentDesc(pick.price))).toBe(true);
    expect(await detailPage.isVisible(detailPage.colorLabel)).toBe(true);
    expect(await detailPage.isVisible(detailPage.colorSwatch(0))).toBe(true);
    expect(await detailPage.isVisible(detailPage.colorSwatch(1))).toBe(true);
    expect(await detailPage.isVisible(detailPage.colorSwatch(2))).toBe(true);
    expect(await detailPage.isVisible(detailPage.byContentDesc('1'))).toBe(true); // default qty
    expect(await detailPage.isVisible(detailPage.addToCartBtn)).toBe(true);
  });

  test('TC-PD02: should treat each color as a variant — 2 swatches → 2 cart lines', async ({ driver }) => {
    await actionsPD02(driver);

    expect(variantSnack1).toMatch(/^.+ added to cart$/);
    expect(variantSnack2).toBe(variantSnack1); // same product name regardless of color variant
    expect(variantCartLineCount).toBe(2);
  });

  test('TC-PD03: should carry cart badge=2 across navigation to a Category product Detail', async ({ driver }) => {
    // Pre-actions sanity: PD02 left us on Shop All with badge=2.
    expect(await gridPage.getCartBadgeCount()).toBe(2);

    const pick = await actionsPD03(driver);

    // Badge persists across navigation to the Casual grid (captured mid-action).
    expect(casualGridBadge).toBe(2);
    expect(await detailPage.isVisible(detailPage.byContentDesc(pick.name))).toBe(true);
    expect(await detailPage.isVisible(detailPage.addToCartBtn)).toBe(true);
  });

  test('TC-PD04: should add the Casual product to cart and bump badge to 3', async ({ driver }) => {
    const snack = await actionsPD04(driver);

    expect(snack).toBe(`${casualPick.name} added to cart`);
    expect(await gridPage.getCartBadgeCount()).toBe(3);
  });

  test('TC-PD05: should navigate from Casual back to Catalog Landing then into Evening grid', async ({ driver }) => {
    await actionsPD05(driver);

    expect(await gridPage.isVisible(gridPage.gridTitle('Evening Dresses'))).toBe(true);
    expect(await gridPage.getCartBadgeCount()).toBe(3);
  });

  test('TC-PD06: should add a product directly from the Evening card icon (no Detail visit) and bump badge to 4', async ({ driver }) => {
    const { pick, snackText } = await actionsPD06(driver);

    expect(snackText).toBe(`${pick.name} added to cart`);
    expect(await gridPage.getCartBadgeCount()).toBe(4);
  });

  test('TC-SR01: should filter Party grid to "Cocktail" matches and add all 3 from the search results', async ({ driver }) => {
    const perTapSnacks = await actionsSR01(driver);

    expect(cocktailExpected).toBe(3);
    expect(cocktailAdded.size).toBe(cocktailExpected);
    for (const { name, snackText } of perTapSnacks) {
      expect(snackText).toBe(`${name} added to cart`);
    }
    // Badge: 4 (from PD06) + 3 (cocktails) = 7
    expect(await gridPage.getCartBadgeCount()).toBe(7);
  });

  test('TC-SR02: should show empty state when searching Boho for an off-catalog clothing term', async ({ driver }) => {
    await actionsSR02(driver);

    expect(await gridPage.isVisible(gridPage.gridTitle('Boho Dresses'))).toBe(true);
    expect(await gridPage.getVisibleProductNames()).toHaveLength(0);
    expect(await gridPage.getCartBadgeCount()).toBe(7);
  });

  // No orientation revert here — Cart (§14) chains off this spec's state
  // and needs portrait too. The end-of-chain spec in 04_products/ owns
  // the final revert. If running test:products alone, the tablet stays
  // in portrait; reboot or run a downstream revert if that matters.
});
