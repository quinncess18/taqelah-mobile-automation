// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { ProductGridPage } = require('../../pages/ProductGridPage');
const { ProductDetailPage } = require('../../pages/ProductDetailPage');
const { CartPage } = require('../../pages/CartPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');
const { ShippingInfoPage } = require('../../pages/ShippingInfoPage');
const { ReviewOrderPage } = require('../../pages/ReviewOrderPage');
const { ThankYouPage } = require('../../pages/ThankYouPage');
const checkoutData = require('../../data/checkout-scenarios.json');
const fs = require('fs');
const path = require('path');

// CI-only diagnostic dump for the K01 seed-cart cold-render flake. When
// `detailPage.waitForPageLoad()` fails after tapping a grid card, capture:
//   1. The grid's currently-visible product names (was the tap on a real card?).
//   2. The post-tap page source XML (did we navigate? did Detail render at all?).
//   3. A screenshot (visual confirmation of where we landed).
// Three K01 hard-fails in 24h with identical "Add to Cart not found after 60s"
// signature — need ground truth before guessing fixes. Gated on CI to avoid
// noise on local runs.
async function dumpK01SeedDiagnostic(driver, label, pickName) {
  if (!process.env.CI) return;
  try {
    const dir = path.join('test-results', 'diagnostics');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now();
    const png = await driver.takeScreenshot();
    fs.writeFileSync(path.join(dir, `k01-seed-${label}-${stamp}.png`), Buffer.from(png, 'base64'));
    const xml = await driver.getPageSource();
    fs.writeFileSync(path.join(dir, `k01-seed-${label}-${stamp}.xml`), xml);
    console.log(`[CK-seed/diag] dumped ${label} for pick="${pickName}" @ ${stamp}`);
  } catch (e) {
    console.log(`[CK-seed/diag] dump failed: ${e?.message || e}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §15 Checkout — chains off §14's empty-cart end-state.
//
// Entry (beforeAll):
//   1. Empty cart screen → tap "Continue Shopping" → lands on the Boho grid
//      with the "shorts" search still active (SR02 leftover).
//   2. Clear the search in place (`gridPage.clearSearch()`) — items reappear.
//      Boho is the only category §12+§13 didn't add items from, so this
//      naturally covers it.
//   3. Add 2–3 random DISTINCT items via direct-add card icons. Each add
//      is verified by waiting for the cart badge to increment (eliminates
//      the snackbar-race that swallowed the second add in earlier runs).
//   4. Open Cart → confirm line count matches what we added + Σ math.
//   5. Ready for K01.
//
// TC-K01 (negative — empty submit):
//   Tap "Proceed to Checkout" on the cart → Shipping Info renders →
//   tap "To Payment" with all fields empty → assert exactly 6 required-field
//   errors (Address 2 is optional); still on Shipping.
//
// TC-K02 (happy path, depends on K01 leaving Shipping Info on-screen):
//   Fill all 7 Shipping fields with `valid[0]` fixture (Jane Doe, Unit
//   04-12) → To Payment → Review Order: assert 5-line Shipping Address
//   card (Address 2 surfaces as its own line), Order Summary line items
//   match Cart by name/qty/total, Review Total == Cart Total → Place
//   Order → Thank You renders with title + body + Continue Shopping.
//
// TC-K03 (depends on K02 leaving Thank You on-screen):
//   Tap Continue Shopping → Catalog Landing → cart badge node absent
//   (Place Order wiped the cart).
//
// TC-K04 (state preservation; depends on K03 leaving Landing on-screen):
//   Has its own pre-step — random non-Boho category → Detail-path add 2
//   items → Cart → Proceed to Checkout → Shipping. Then: fill all 7
//   fields with `valid[0]` → To Payment → Review renders → tap Back →
//   Shipping re-appears with all 7 field values preserved verbatim
//   (including the optional Address 2).
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Products Module — Checkout (§15)', () => {
  /** @type {LoginPage} */ let loginPage;
  /** @type {CatalogLandingPage} */ let landingPage;
  /** @type {ProductGridPage} */ let gridPage;
  /** @type {ProductDetailPage} */ let detailPage;
  /** @type {CartPage} */ let cartPage;
  /** @type {NavMenuPage} */ let navMenu;
  /** @type {ShippingInfoPage} */ let shippingPage;
  /** @type {ReviewOrderPage} */ let reviewPage;
  /** @type {ThankYouPage} */ let thankYouPage;

  // Cart entry state captured for TC-K01's pre-conditions
  /** @type {number} */ let entryLineCount;
  /** @type {number} */ let entryCartTotal;
  /** @type {{ name: string, total: number, qty: number, raw: string }[]} */ let entryLines;

  test.beforeAll(async ({ driver }) => {
    try { await driver.updateSettings({ waitForIdleTimeout: 0 }); } catch {}

    loginPage = new LoginPage(driver);
    landingPage = new CatalogLandingPage(driver);
    gridPage = new ProductGridPage(driver);
    detailPage = new ProductDetailPage(driver);
    cartPage = new CartPage(driver);
    navMenu = new NavMenuPage(driver);
    shippingPage = new ShippingInfoPage(driver);
    reviewPage = new ReviewOrderPage(driver);
    thankYouPage = new ThankYouPage(driver);

    // Defensive tablet portrait re-lock (Cart's afterAll reverts to landscape).
    // Android-only — UIA2 `mobile: shell` is unavailable on iOS XCUITest, and
    // iPhone 15 sim is phone-sized so the tablet branch never applies anyway.
    if (loginPage.isAndroid) {
      const { width } = await driver.getWindowRect();
      if (width > 1200) {
        try {
          await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '0'] });
          await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '1'] });
          await driver.pause(2500);
        } catch (e) {
          console.log(`[beforeAll] portrait lock failed: ${e?.message || e}`);
        }
      }
    }

    // Choose itemCount once for both attempts (consistent across retry).
    const itemCount = 2 + Math.floor(Math.random() * 2); // 2 or 3

    // First attempt: chained-from-§14 path (Continue Shopping → Boho with
    // "shorts" → clearSearch → add). If anything in here fails (cold-render
    // race on CI etc.), the catch falls back to a full pm-clear + relogin
    // + navigate-into-Boho-via-Landing recovery — same parity as the
    // retry-replay pattern in §12/§14 (per feedback-mid-cascade-retry).
    try {
      console.log('[CK-seed] attempt 1: chained path');
      const onEmptyCart = await cartPage.isVisible(cartPage.continueShoppingBtn);
      if (onEmptyCart) {
        console.log('[CK-seed] tapping Continue Shopping from empty cart');
        const continueBtn = await driver.$(cartPage.continueShoppingBtn);
        await continueBtn.click();
        await driver.pause(1500);
      }
      console.log('[CK-seed] waiting for Boho grid (post-Continue-Shopping)');
      await gridPage.waitForPageLoad();
      console.log('[CK-seed] clearing prior "shorts" search');
      await gridPage.clearSearch();
      await seedCartFromCurrentGrid(driver, itemCount);
    } catch (e) {
      console.log(`[CK-seed] chained path failed: ${e?.message || e}`);
      console.log('[CK-seed] recovering via pm clear + relogin + Boho-from-Landing');
      await fullResetAndLogin(driver);
      console.log('[CK-seed] recovery: selecting Boho category');
      await landingPage.selectCategory('Boho');
      await gridPage.waitForPageLoad();
      await seedCartFromCurrentGrid(driver, itemCount);
    }

    // Open Cart and snapshot entry state.
    console.log('[CK-seed] opening Cart');
    const cartIcon = await driver.$(gridPage.cartBtn);
    await cartIcon.click();
    await cartPage.waitForPageLoad();

    entryLines = await cartPage.collectAllLines();
    entryLineCount = entryLines.length;
    entryCartTotal = await cartPage.getCartTotal();

    // Pre-condition assertions — fail fast if the cart isn't in the shape
    // K01 expects (≥ 1 line, math consistent).
    if (entryLineCount < 1) {
      throw new Error(`[CK-seed] expected ≥1 cart line, got ${entryLineCount}`);
    }
    const sumLineTotals = entryLines.reduce((s, l) => s + l.total, 0);
    if (Math.abs(entryCartTotal - sumLineTotals) > 0.01) {
      throw new Error(`[CK-seed] cart total ${entryCartTotal} ≠ Σ line totals ${sumLineTotals}`);
    }
    console.log(`[CK-seed] cart ready: ${entryLineCount} lines, total $${entryCartTotal.toFixed(2)}`);
  });

  // ─── seed-cart helpers (used by beforeAll + its recovery path) ───

  /**
   * Re-find a grid card by its product name. A card's element handle goes
   * stale after a swallowed tap that left us on the grid, so the seed re-tap
   * loop calls this to get a fresh handle before retrying. Returns the element
   * or null if the card isn't currently on the grid.
   */
  async function reResolveCard(driver, name) {
    const cards = await driver.$$(gridPage.clickableItems);
    for (const c of cards) {
      const desc = await c.getAttribute(gridPage.attrName).catch(() => null);
      if (!desc || desc.split('\n')[0] !== name) continue;
      // iOS exposes off-screen cards as ghost nodes at (0,0); skip the unhittable ones.
      if (gridPage.isIOS && !(await c.isDisplayed().catch(() => false))) continue;
      return c;
    }
    return null;
  }

  /**
   * Add N DISTINCT random items via the Detail-page add path (PD04 pattern).
   * Assumes we're already on a grid screen with items visible. The grid-card
   * direct-add icon was vulnerable to Material snackbar overlay collisions
   * on bottom-of-grid cards — Detail-page add has no overlay hazard.
   */
  async function seedCartFromCurrentGrid(driver, itemCount) {
    const pickedNames = [];
    const seen = new Set();
    for (let i = 0; i < itemCount; i++) {
      let pick;
      let attempts = 0;
      do {
        pick = await gridPage.pickRandomProduct();
        attempts++;
      } while (seen.has(pick.name) && attempts < 5);
      seen.add(pick.name);

      const expectedBadge = i + 1;
      console.log(`[CK-seed] add ${i + 1}/${itemCount}: tap "${pick.name}"`);

      if (process.env.CI) {
        try {
          const cards = await driver.$$(gridPage.clickableItems);
          const names = [];
          for (const c of cards) {
            const d = await c.getAttribute(gridPage.attrName).catch(() => null);
            if (d) names.push(d.split('\n')[0]);
          }
          console.log(`[CK-seed/diag] pre-tap grid (${names.length} cards): ${names.join(' | ')}`);
        } catch (e) {
          console.log(`[CK-seed/diag] pre-tap grid scan failed: ${e?.message || e}`);
        }
      }

      // Cold-render race (CI run 26405633023): the card tap is silently
      // swallowed and Detail never binds, so a single 60s waitForPageLoad just
      // burns the clock and throws — all 3 retries hit the same wall. A
      // swallowed tap leaves us on the grid, so re-tap up to 3×, re-resolving
      // the (now-stale) card handle by name between attempts.
      let detailBound = false;
      for (let tap = 1; tap <= 3 && !detailBound; tap++) {
        if (tap > 1) {
          try { await gridPage.waitForPageLoad(); } catch { /* re-tap anyway */ }
          const re = await reResolveCard(driver, pick.name);
          if (re) pick.el = re;
        }
        await pick.el.click();
        try {
          await detailPage.waitForDisplayed(detailPage.addToCartBtn, tap === 1 ? 30000 : 20000);
          detailBound = true;
        } catch (err) {
          console.log(`[CK-seed/diag] Detail didn't bind after tap on "${pick.name}" (attempt ${tap}/3): ${err?.message || err}`);
          if (tap === 3) {
            await dumpK01SeedDiagnostic(driver, `wait-fail-i${i + 1}`, pick.name);
            throw err;
          }
        }
      }
      console.log(`[CK-seed] add ${i + 1}/${itemCount}: Detail ready, tapping Add to Cart`);
      await detailPage.addToCart();
      await detailPage.waitForSnackbarDismissed();
      await driver.back();
      await gridPage.waitForPageLoad();
      await driver.waitUntil(async () => {
        return (await gridPage.getCartBadgeCount()) === expectedBadge;
      }, { timeout: 6000, interval: 300, timeoutMsg: `add of "${pick.name}" did not increment cart badge to ${expectedBadge}` });
      pickedNames.push(pick.name);
    }
    console.log(`[CK-seed] added ${itemCount}: ${pickedNames.join(', ')}`);
  }

  /**
   * pm clear + relaunch + login + tablet portrait re-lock. Matches the
   * same shape as §12/§14's fullResetAndLogin so the recovery path lands
   * on Catalog Landing reliably.
   */
  async function fullResetAndLogin(driver) {
    if (loginPage.isAndroid) {
      await driver.execute('mobile: shell', { command: 'pm', args: ['clear', loginPage.appPackage] });
      await driver.pause(2500);
      await driver.execute('mobile: shell', { command: 'am', args: ['start', '-W', '-n', `${loginPage.appPackage}/.MainActivity`] });
      await driver.pause(1500);
    } else {
      // iOS: no `mobile: shell` on XCUITest. Mirror 02_cart's pattern —
      // terminateApp + launchApp. noReset means session may already be past
      // Login; probe before re-logging in.
      try { await driver.execute('mobile: terminateApp', { bundleId: loginPage.appPackage }); } catch {}
      await driver.pause(1500);
      await driver.execute('mobile: launchApp', { bundleId: loginPage.appPackage });
      await driver.pause(2500);
    }
    try { await driver.updateSettings({ waitForIdleTimeout: 0 }); } catch {}
    if (loginPage.isIOS && !(await loginPage.isVisible(loginPage.loginButton))) {
      await landingPage.waitForPageLoad().catch(() => {});
    } else {
      await loginPage.waitForPageLoad();
      await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
      await landingPage.waitForPageLoad();
    }

    if (loginPage.isAndroid) {
      const { width } = await driver.getWindowRect();
      if (width > 1200) {
        try {
          await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '0'] });
          await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '1'] });
          await driver.pause(2500);
          await landingPage.waitForPageLoad();
        } catch (e) {
          console.log(`[CK-seed/recovery] portrait lock failed: ${e?.message || e}`);
        }
      }
    }
  }

  test('TC-K01: empty submit on Shipping Info shows 6 required-field errors, stays on Shipping', async ({ driver }) => {
    // Sanity: we should be on the cart screen with ≥1 line.
    expect(await cartPage.isVisible(cartPage.cartTitle)).toBe(true);
    expect(entryLineCount).toBeGreaterThanOrEqual(1);

    // Cart → Shipping Info
    await cartPage.tapProceedToCheckout();
    await shippingPage.waitForPageLoad();

    // 7 NAF EditText fields visible (UiScrollable resolves regardless of
    // current scroll position).
    expect(await shippingPage.isVisible(shippingPage.fullNameInput)).toBe(true);
    expect(await shippingPage.isVisible(shippingPage.countryInput)).toBe(true);
    expect(await shippingPage.isVisible(shippingPage.toPaymentBtn)).toBe(true);

    // Empty submit → 6 "This field is required" errors (Address 2 optional).
    await shippingPage.tapToPayment();
    await driver.pause(1000);

    const errorCount = await shippingPage.getRequiredFieldErrorCount();
    expect(errorCount).toBe(6);

    // Still on Shipping Info (didn't advance to Review Order).
    expect(await shippingPage.isVisible(shippingPage.title)).toBe(true);
  });

  test('TC-K02: fill Shipping → Review matches Cart → Place Order → Thank You', async ({ driver }) => {
    // Sanity: K01 left us on Shipping Info with the empty form + 6 errors.
    expect(await shippingPage.isVisible(shippingPage.title)).toBe(true);

    // Fill all 7 fields with the standard happy-path fixture (Jane Doe,
    // Unit 04-12 → exercises the Address-2-renders-its-own-line surface).
    const customer = checkoutData.valid[0].customer;
    await shippingPage.fillForm(customer);

    // → Review Order
    await shippingPage.tapToPayment();
    await reviewPage.waitForPageLoad();

    // Shipping Address card: with Address 2 populated, the desc joins
    // 5 lines (without Address 2 it would be 4).
    const addressLines = await reviewPage.getShippingAddressLines();
    expect(addressLines).toHaveLength(5);
    expect(addressLines).toContain(customer.address2);

    // Order Summary line items must match Cart by name + qty + total.
    const reviewLines = await reviewPage.getOrderSummaryLines();
    expect(reviewLines.length).toBe(entryLineCount);

    // Match per-line — both lists were captured in DOM/scroll order;
    // cross-reference by name for tolerance to ordering.
    const reviewByName = new Map(reviewLines.map((l) => [l.name, l]));
    for (const cartLine of entryLines) {
      const rev = reviewByName.get(cartLine.name);
      expect(rev, `Review missing line "${cartLine.name}"`).toBeTruthy();
      expect(rev.qty).toBe(cartLine.qty);
      expect(rev.total).toBeCloseTo(cartLine.total, 2);
    }

    // Bottom-bar Total = Cart Total = Σ review-line totals.
    const reviewTotal = await reviewPage.getTotal();
    expect(reviewTotal).toBeCloseTo(entryCartTotal, 2);
    const reviewSum = reviewLines.reduce((s, l) => s + l.total, 0);
    expect(reviewTotal).toBeCloseTo(reviewSum, 2);

    // Place Order → Thank You
    await reviewPage.tapPlaceOrder();
    await thankYouPage.waitForPageLoad();
    expect(await thankYouPage.isVisible(thankYouPage.title)).toBe(true);
    expect(await thankYouPage.isVisible(thankYouPage.body)).toBe(true);
    expect(await thankYouPage.isVisible(thankYouPage.continueShoppingBtn)).toBe(true);
  });

  test('TC-K03: Continue Shopping from Thank You returns to Catalog Landing with badge=0', async () => {
    // K02 left us on Thank You.
    expect(await thankYouPage.isVisible(thankYouPage.title)).toBe(true);

    await thankYouPage.tapContinueShopping();
    await landingPage.waitForPageLoad();

    // Cart was wiped by Place Order — badge node should be absent (the
    // cart badge selector matches the numeric overlay that only renders
    // when items > 0).
    const badgeVisible = await gridPage.isVisible(gridPage.cartBadge);
    expect(badgeVisible).toBe(false);
  });

  test('TC-K04: fill 7 Shipping fields → To Payment (Review) → Back → all 7 values preserved', async ({ driver }) => {
    // K03 left us on Catalog Landing with cart empty. K04 needs its own
    // cart to reach Shipping → Review. Pick a random non-Boho category
    // (Boho was K01/K02's; rule: cover variety across §15's TCs) and add
    // 2 distinct items via the Detail-page add path. Wrapped in a
    // try/retry: if the Detail render races on a CI cold-render spike
    // (CI run 26033901841 — Detail page didn't bind in 60s on first
    // K04 attempt), recover via pm clear + relogin + re-seed.
    const k04Categories = ['Casual', 'Evening', 'Party'];
    const chosen = k04Categories[Math.floor(Math.random() * k04Categories.length)];
    console.log(`[K04-seed] attempt 1: adding from "${chosen}"`);

    try {
      expect(await landingPage.isVisible(landingPage.shopAllBtn)).toBe(true);
      await landingPage.selectCategory(chosen);
      await gridPage.waitForPageLoad();
      await seedCartFromCurrentGrid(driver, 2);
    } catch (e) {
      console.log(`[K04-seed] chained path failed: ${e?.message || e}`);
      console.log('[K04-seed] recovering via pm clear + relogin');
      await fullResetAndLogin(driver);
      console.log(`[K04-seed] recovery: selecting "${chosen}" category`);
      await landingPage.selectCategory(chosen);
      await gridPage.waitForPageLoad();
      await seedCartFromCurrentGrid(driver, 2);
    }

    // Cart → Shipping
    const cartIcon = await driver.$(gridPage.cartBtn);
    await cartIcon.click();
    await cartPage.waitForPageLoad();
    await cartPage.tapProceedToCheckout();
    await shippingPage.waitForPageLoad();

    // Fill all 7 fields with valid[0] fixture.
    const customer = checkoutData.valid[0].customer;
    await shippingPage.fillForm(customer);

    // → Review (then immediately Back)
    await shippingPage.tapToPayment();
    await reviewPage.waitForPageLoad();

    await driver.back();
    await shippingPage.waitForPageLoad();

    // All 7 entered values must round-trip verbatim — including the
    // optional Address 2.
    const roundTrip = await shippingPage.readForm();
    expect(roundTrip.fullName).toBe(customer.fullName);
    expect(roundTrip.address1).toBe(customer.address1);
    expect(roundTrip.address2).toBe(customer.address2);
    expect(roundTrip.city).toBe(customer.city);
    expect(roundTrip.state).toBe(customer.state);
    expect(roundTrip.zip).toBe(customer.zip);
    expect(roundTrip.country).toBe(customer.country);
  });

  // End-of-chain hygiene: §15 is the last spec in 04_products/. Navigate
  // back to a known anchor (Catalog Landing) so anything that follows
  // doesn't inherit Shipping Info junk state, and revert tablet to its
  // natural landscape. §16's pm clear would supersede this anyway, but
  // this keeps any other downstream spec safe.
  test.afterAll(async ({ driver }) => {
    for (let i = 0; i < 5; i++) {
      if (await landingPage.isVisible(landingPage.shopAllBtn)) break;
      await driver.back();
      await driver.pause(500);
    }
    if (loginPage.isAndroid) {
      const { width } = await driver.getWindowRect();
      if (width > 1200) {
        try {
          await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '0'] });
          await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '1'] });
          await driver.pause(2000);
        } catch (e) {
          console.log(`[checkout/afterAll] orientation revert failed: ${e?.message || e}`);
        }
      }
    }
  });
});
