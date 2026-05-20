// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { ProductGridPage } = require('../../pages/ProductGridPage');
const { ProductDetailPage } = require('../../pages/ProductDetailPage');
const { CartPage } = require('../../pages/CartPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');

// ─────────────────────────────────────────────────────────────────────────────
// §14 Shopping Cart — chains off §12+§13 end-state.
//
// Entry strategy (beforeAll):
//   1. Cold-entry recovery (device-back ×3 to anchor on login or landing).
//   2. If we're on Login, run the full PD cascade to seed the 7-line cart
//      (standalone-run path).
//   3. If we're already deep inside the app (Products just ran), open drawer
//      → Cart. If the cart is populated we're done — no cascade replay.
//      If empty (unlikely without standalone), fall back to cascade.
//
// Retry-replay (beforeEach on retry > 0): pm clear + relogin + full PD
// cascade + enter Cart + replay every prior S* TC. Self-sufficient.
//
// Plus/Minus cap: N=5. Stepper target = line 0 (a PD02 variant) so the
// progression is asserted against one specific line while siblings stay flat.
// ─────────────────────────────────────────────────────────────────────────────

const PD_SEQUENCE = ['PD01', 'PD02', 'PD03', 'PD04', 'PD05', 'PD06', 'SR01', 'SR02'];
const S_SEQUENCE = ['S01', 'S02', 'S03', 'S04', 'S05'];
const STEPPER_TARGET_INDEX = 0; // line we drive Plus/Minus on for S02/S03
const STEPPER_MAX_QTY = 5;
const DELETE_TARGET_INDEX = 0; // line we delete in S04

test.describe('Products Module — Shopping Cart (§14)', () => {
  /** @type {LoginPage} */ let loginPage;
  /** @type {CatalogLandingPage} */ let landingPage;
  /** @type {ProductGridPage} */ let gridPage;
  /** @type {ProductDetailPage} */ let detailPage;
  /** @type {CartPage} */ let cartPage;
  /** @type {NavMenuPage} */ let navMenu;

  // Cascade state captured across PD action replays
  /** @type {{ name: string, price: string }} */ let shopAllPick;
  /** @type {{ name: string }} */ let casualPick;
  /** @type {{ name: string }} */ let eveningPick;
  /** @type {Set<string>} */ let cocktailAdded;
  /** @type {number} */ let cocktailExpected;

  // Cart-screen captured state shared across S* TCs
  /** @type {number} */ let entryLineCount;
  /** @type {number} */ let entryCartTotal;
  /** @type {{ name: string, total: number, qty: number, raw: string }[]} */ let entryLines;
  /** @type {{ name: string, total: number, qty: number, raw: string }} */ let stepperBaseline;

  // ─── Universal reset + relogin + portrait lock (tablet) ───
  async function fullResetAndLogin(driver) {
    await driver.execute('mobile: shell', { command: 'pm', args: ['clear', loginPage.appPackage] });
    await driver.pause(2500);
    await driver.execute('mobile: shell', { command: 'am', args: ['start', '-W', '-n', `${loginPage.appPackage}/.MainActivity`] });
    await driver.pause(1500);
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

  // ─── PD cascade action helpers (mirrors §12; no assertions) ───
  async function actionsPD01() {
    await landingPage.navigateToShopAll();
    await gridPage.waitForPageLoad();
    const pick = await gridPage.pickRandomProduct();
    await pick.el.click();
    await detailPage.waitForPageLoad();
    shopAllPick = { name: pick.name, price: pick.price };
  }

  async function actionsPD02(driver) {
    await detailPage.waitForPageLoad();
    await detailPage.selectColorByInstance(0);
    await detailPage.addToCart();
    await detailPage.waitForSnackbarDismissed();
    await detailPage.selectColorByInstance(1);
    await detailPage.addToCart();
    await detailPage.waitForSnackbarDismissed();
    await driver.back();
    await gridPage.waitForPageLoad();
  }

  async function actionsPD03() {
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navHome);
    await landingPage.waitForPageLoad();
    await landingPage.selectCategory('Casual');
    await gridPage.waitForPageLoad();
    const pick = await gridPage.pickRandomProduct();
    await pick.el.click();
    await detailPage.waitForPageLoad();
    casualPick = { name: pick.name };
  }

  async function actionsPD04(driver) {
    await detailPage.waitForPageLoad();
    await detailPage.addToCart();
    await detailPage.waitForSnackbarDismissed();
    await driver.back();
    await gridPage.waitForPageLoad();
  }

  async function actionsPD05(driver) {
    await driver.back();
    await landingPage.waitForPageLoad();
    await landingPage.selectCategory('Evening');
    await gridPage.waitForPageLoad();
  }

  async function actionsPD06() {
    await gridPage.waitForPageLoad();
    const pick = await gridPage.pickRandomProductDirectAdd();
    await pick.addBtn.click();
    await gridPage.getAddedSnackbarText();
    await gridPage.waitForSnackbarDismissed();
    eveningPick = { name: pick.name };
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
    const maxIterations = 5;
    for (let iter = 0; iter < maxIterations; iter++) {
      const visible = (await gridPage.getVisibleProductNames()).reverse();
      for (const name of visible) {
        if (cocktailAdded.has(name)) continue;
        await gridPage.tapDirectAddByName(name);
        await gridPage.getAddedSnackbarText();
        await gridPage.waitForSnackbarDismissed();
        cocktailAdded.add(name);
      }
      if (cocktailAdded.size >= cocktailExpected) break;
      await gridPage.swipe(safeX, Math.round(height * 0.3), safeX, Math.round(height * 0.7), 800);
      await driver.pause(gridPage.settlePause);
    }
  }

  async function actionsSR02(driver) {
    await driver.back();
    await landingPage.waitForPageLoad();
    await landingPage.selectCategory('Boho');
    await gridPage.waitForPageLoad();
    await gridPage.searchProducts('shorts');
  }

  const PD_ACTIONS = {
    PD01: actionsPD01,
    PD02: actionsPD02,
    PD03: actionsPD03,
    PD04: actionsPD04,
    PD05: actionsPD05,
    PD06: actionsPD06,
    SR01: actionsSR01,
    SR02: actionsSR02,
  };

  /**
   * Run the entire §12+§13 cascade from a clean Catalog Landing state and
   * land on the Cart screen with 7 lines. Used by retry-replay only —
   * green-path beforeAll prefers `enterCartFromCurrent`.
   */
  async function buildCartAndEnter(driver) {
    for (const tc of PD_SEQUENCE) {
      await PD_ACTIONS[tc](driver);
    }
    const cartIcon = await driver.$(gridPage.cartBtn);
    await cartIcon.click();
    await cartPage.waitForPageLoad();
  }

  /**
   * Entry from Products' end-state: Boho grid with an active "shorts"
   * search. Header shows Back + search field (not hamburger), so drawer
   * navigation isn't available — but the grid cart icon is. Tap it directly.
   * Returns true if cart loaded with ≥1 line, false if empty.
   */
  async function enterCartFromCurrent(driver) {
    const cartIcon = await driver.$(gridPage.cartBtn);
    await cartIcon.click();
    await cartPage.waitForPageLoad();
    return (await cartPage.getLineCount()) > 0;
  }

  // ─── Per-S-TC actions (run on the Cart screen) ───
  async function actionsS01() {
    entryLines = await cartPage.collectAllLines();
    entryLineCount = entryLines.length;
    entryCartTotal = await cartPage.getCartTotal();
  }

  async function actionsS02(driver) {
    stepperBaseline = await cartPage.getLine(STEPPER_TARGET_INDEX);
    const perTap = [];
    for (let q = stepperBaseline.qty + 1; q <= STEPPER_MAX_QTY; q++) {
      await cartPage.tapPlus(STEPPER_TARGET_INDEX);
      const after = await cartPage.getLine(STEPPER_TARGET_INDEX);
      const cartTotal = await cartPage.getCartTotal();
      // Scroll-collect every line so the in-code sum matches the bottom-bar
      // total even when items are virtualised off-screen.
      const allLines = await cartPage.collectAllLines();
      const computedSum = allLines.reduce((s, l) => s + l.total, 0);
      perTap.push({ targetQty: q, after, cartTotal, allLines, computedSum });
    }
    return perTap;
  }

  async function actionsS03(driver) {
    const current = await cartPage.getLine(STEPPER_TARGET_INDEX);
    const perTap = [];
    for (let q = current.qty - 1; q >= 1; q--) {
      await cartPage.tapMinus(STEPPER_TARGET_INDEX);
      const after = await cartPage.getLine(STEPPER_TARGET_INDEX);
      const cartTotal = await cartPage.getCartTotal();
      const allLines = await cartPage.collectAllLines();
      const computedSum = allLines.reduce((s, l) => s + l.total, 0);
      perTap.push({ targetQty: q, after, cartTotal, allLines, computedSum });
    }
    const minusState = await cartPage.getMinusState(STEPPER_TARGET_INDEX);
    return { perTap, minusState };
  }

  async function actionsS04() {
    const beforeLines = await cartPage.collectAllLines();
    const beforeCartTotal = await cartPage.getCartTotal();
    const deletedLine = beforeLines[DELETE_TARGET_INDEX];
    await cartPage.tapDelete(DELETE_TARGET_INDEX);
    const afterLines = await cartPage.collectAllLines();
    const afterCartTotal = await cartPage.getCartTotal();
    const afterSum = afterLines.reduce((s, l) => s + l.total, 0);
    return { beforeLines, afterLines, beforeCartTotal, afterCartTotal, deletedLine, afterSum };
  }

  async function actionsS05() {
    let safety = 20;
    while ((await cartPage.getLineCount()) > 0 && safety-- > 0) {
      await cartPage.tapDelete(0);
    }
    const emptyVisible = await cartPage.isVisible(cartPage.emptyCartMsg);
    const continueVisible = await cartPage.isVisible(cartPage.continueShoppingBtn);
    return { emptyVisible, continueVisible };
  }

  const S_ACTIONS = {
    S01: actionsS01,
    S02: actionsS02,
    S03: actionsS03,
    S04: actionsS04,
    S05: actionsS05,
  };

  /**
   * Replay path on retry: full reset → full PD cascade → enter Cart →
   * replay every S* TC's actions up to (but not including) the failing one.
   */
  async function replayCascadeUpTo(driver, targetTC) {
    const idx = S_SEQUENCE.indexOf(targetTC);
    if (idx < 0) throw new Error(`Unknown TC for replay: ${targetTC}`);
    await fullResetAndLogin(driver);
    await buildCartAndEnter(driver);
    for (let i = 0; i < idx; i++) {
      const tc = S_SEQUENCE[i];
      console.log(`[replay] running actions${tc} to restore state for ${targetTC}`);
      await S_ACTIONS[tc](driver);
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

    // Probe: are we already logged in and somewhere inside the app?
    // (i.e. Products spec just ran in this worker.)
    const onLogin = await loginPage.isVisible(loginPage.loginButton);

    if (onLogin) {
      // Standalone-run path: cold session, login + seed cart from scratch.
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
          console.log(`[beforeAll] orientation lock failed: ${e?.message || e}`);
        }
      }

      await buildCartAndEnter(driver);
      return;
    }

    // Chained-after-Products path: Products' afterAll reverts the tablet
    // to landscape. Cart line layout was authored for portrait — re-apply
    // the lock here before tapping into Cart.
    const { width } = await driver.getWindowRect();
    if (width > 1200) {
      try {
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '0'] });
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '1'] });
        await driver.pause(2500);
      } catch (e) {
        console.log(`[beforeAll] chained portrait lock failed: ${e?.message || e}`);
      }
    }

    const ok = await enterCartFromCurrent(driver);
    if (!ok) {
      // Defensive — cart unexpectedly empty (afterAll wiped state?).
      // Fall back to full seed.
      console.log('[beforeAll] cart empty after drawer entry; falling back to cascade');
      await driver.back();
      await landingPage.waitForPageLoad().catch(() => {});
      await buildCartAndEnter(driver);
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

  test('TC-S01: should land on Cart with 7 lines, Total = Σ line totals, Proceed to Checkout enabled', async () => {
    await actionsS01();

    expect(entryLineCount).toBe(7);
    expect(entryLines).toHaveLength(7);
    for (const line of entryLines) {
      expect(line.name).toBeTruthy();
      expect(line.total).toBeGreaterThan(0);
      expect(line.qty).toBeGreaterThanOrEqual(1);
    }
    const sumLineTotals = entryLines.reduce((s, l) => s + l.total, 0);
    expect(entryCartTotal).toBeCloseTo(sumLineTotals, 2);

    expect(await cartPage.isVisible(cartPage.proceedToCheckoutBtn)).toBe(true);
    const checkoutBtn = await cartPage.driver.$(cartPage.proceedToCheckoutBtn);
    expect(await checkoutBtn.getAttribute('clickable')).toBe('true');
  });

  test('TC-S02: should drive Plus on line 0 from qty=1 up to qty=5, line total + Σ line totals = cart total per tap', async ({ driver }) => {
    const perTap = await actionsS02(driver);

    expect(perTap).toHaveLength(STEPPER_MAX_QTY - stepperBaseline.qty);
    const unitPrice = stepperBaseline.total / stepperBaseline.qty;
    for (const { targetQty, after, cartTotal, computedSum } of perTap) {
      expect(after.qty).toBe(targetQty);
      expect(after.total).toBeCloseTo(unitPrice * targetQty, 2);
      // Bottom-bar cart total must equal the in-code sum of every line
      // we walked the ScrollView to read.
      expect(cartTotal).toBeCloseTo(computedSum, 2);
    }
  });

  test('TC-S03: should drive Minus back down to qty=1; at qty=1 Minus is disabled; Σ line totals = cart total per tap', async ({ driver }) => {
    const { perTap, minusState } = await actionsS03(driver);

    const unitPrice = stepperBaseline.total / stepperBaseline.qty;
    for (const { targetQty, after, cartTotal, computedSum } of perTap) {
      expect(after.qty).toBe(targetQty);
      expect(after.total).toBeCloseTo(unitPrice * targetQty, 2);
      expect(cartTotal).toBeCloseTo(computedSum, 2);
    }
    expect(minusState.clickable).toBe(false);
    expect(minusState.enabled).toBe(false);
  });

  test('TC-S04: should delete one line; line count -1; Σ remaining line totals = cart total = beforeTotal - deletedTotal', async () => {
    const { beforeLines, afterLines, beforeCartTotal, afterCartTotal, deletedLine, afterSum } = await actionsS04();

    expect(afterLines.length).toBe(beforeLines.length - 1);
    expect(afterCartTotal).toBeCloseTo(beforeCartTotal - deletedLine.total, 2);
    // Walked the ScrollView after delete — bottom-bar total must match.
    expect(afterCartTotal).toBeCloseTo(afterSum, 2);
  });

  test('TC-S05: should delete remaining lines until empty; empty-state + Continue Shopping shown', async () => {
    const { emptyVisible, continueVisible } = await actionsS05();

    expect(await cartPage.getLineCount()).toBe(0);
    expect(emptyVisible).toBe(true);
    expect(continueVisible).toBe(true);
  });

  // Restore tablet to natural landscape so downstream specs aren't locked.
  test.afterAll(async ({ driver }) => {
    const { width } = await driver.getWindowRect();
    if (width > 1200) {
      try {
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '0'] });
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '1'] });
        await driver.pause(2000);
      } catch (e) {
        console.log(`[afterAll] orientation revert failed: ${e?.message || e}`);
      }
    }
  });
});
