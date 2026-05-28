// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { ProductGridPage } = require('../../pages/ProductGridPage');
const { ProductDetailPage } = require('../../pages/ProductDetailPage');
const { CartPage } = require('../../pages/CartPage');
const { ShippingInfoPage } = require('../../pages/ShippingInfoPage');
const { ReviewOrderPage } = require('../../pages/ReviewOrderPage');
const { ThankYouPage } = require('../../pages/ThankYouPage');
const checkoutData = require('../../data/checkout-scenarios.json');

// ─────────────────────────────────────────────────────────────────────────────
// §16 Regression — full cross-module E2E. Runs LAST in the suite as a final
// integration check. Has its own pm clear + relaunch so it never inherits
// state from earlier specs (it's the regression layer, not a chained spec).
//
// TC-E01: a single user's full purchase funnel, from cold launch to
// completed order — touches Auth, Catalog, Products, Cart, Checkout in
// one serial journey. Fails meaningfully only when a cross-module
// integration breaks (every unit spec passed but the joints did not).
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Regression (§16) — full E2E', () => {
  /** @type {LoginPage} */ let loginPage;
  /** @type {CatalogLandingPage} */ let landingPage;
  /** @type {ProductGridPage} */ let gridPage;
  /** @type {ProductDetailPage} */ let detailPage;
  /** @type {CartPage} */ let cartPage;
  /** @type {ShippingInfoPage} */ let shippingPage;
  /** @type {ReviewOrderPage} */ let reviewPage;
  /** @type {ThankYouPage} */ let thankYouPage;

  test.beforeAll(async ({ driver }) => {
    loginPage = new LoginPage(driver);
    landingPage = new CatalogLandingPage(driver);
    gridPage = new ProductGridPage(driver);
    detailPage = new ProductDetailPage(driver);
    cartPage = new CartPage(driver);
    shippingPage = new ShippingInfoPage(driver);
    reviewPage = new ReviewOrderPage(driver);
    thankYouPage = new ThankYouPage(driver);

    // Hard reset — regression starts from a cold app, ignoring whatever
    // earlier specs left behind. Android: pm clear + am start. iOS:
    // terminateApp + launchApp (no mobile:shell on XCUITest). Matches
    // §15 Checkout's fullResetAndLogin platform branching.
    if (loginPage.isAndroid) {
      await driver.execute('mobile: shell', { command: 'pm', args: ['clear', loginPage.appPackage] });
      await driver.pause(2500);
      await driver.execute('mobile: shell', { command: 'am', args: ['start', '-W', '-n', `${loginPage.appPackage}/.MainActivity`] });
      await driver.pause(1500);
    } else {
      // iOS: terminateApp + launchApp alone does NOT wipe Flutter's
      // persisted cart on Simulator (run 26559889300 E01 dump showed
      // badge="3" leftover from earlier specs). `mobile: clearApp`
      // wipes app data + sandbox → true cold-launch parity with
      // Android's pm clear.
      try { await driver.execute('mobile: terminateApp', { bundleId: loginPage.appPackage }); } catch {}
      await driver.pause(1000);
      try { await driver.execute('mobile: clearApp', { bundleId: loginPage.appPackage }); } catch (e) {
        console.log(`[E01/iOS-reset] clearApp failed: ${e?.message || e}`);
      }
      await driver.pause(1500);
      await driver.execute('mobile: launchApp', { bundleId: loginPage.appPackage });
      await driver.pause(2500);
    }
    try { await driver.updateSettings({ waitForIdleTimeout: 0 }); } catch {}

    // Defensive: wait for the Login UI to actually be usable before the
    // TC body runs. Without this the first login() can fire while the
    // username field isn't yet bound in the a11y tree → setValue silently
    // targets nothing → submit happens with empty fields → app stays on
    // Login → landing.waitForPageLoad() times out (observed first run).
    // iOS noReset preserves session — terminateApp/launchApp may restore
    // straight to Landing (TC-L06 pattern); only wait for Login if we're
    // actually on Login.
    if (loginPage.isAndroid || (await loginPage.isVisible(loginPage.loginButton))) {
      await loginPage.waitForDisplayed(loginPage.usernameField, 20000);
      await loginPage.waitForDisplayed(loginPage.passwordField, 5000);
      await loginPage.waitForDisplayed(loginPage.loginButton, 5000);
    }
  });

  test('TC-E01: full single-product purchase journey — cold launch to badge cleared', async ({ driver }) => {
    // ── Login (iOS noReset may have restored to Landing — probe first) ──
    if (loginPage.isIOS && !(await loginPage.isVisible(loginPage.loginButton))) {
      await landingPage.waitForPageLoad();
    } else {
      await loginPage.waitForPageLoad();
      await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
      await landingPage.waitForPageLoad();
    }

    // Tablet portrait lock (post-login per §12 pattern — landscape makes
    // product cards taller than viewport, breaking the a11y tree).
    const { width } = await driver.getWindowRect();
    if (width > 1200) {
      try {
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '0'] });
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '1'] });
        await driver.pause(2500);
        await landingPage.waitForPageLoad();
      } catch (e) {
        console.log(`[E01] portrait lock failed: ${e?.message || e}`);
      }
    }

    // ── Catalog → Shop All → random product → Detail ──
    await landingPage.navigateToShopAll();
    await gridPage.waitForPageLoad();
    let pick = await gridPage.pickRandomProduct();
    // Cold-render tap-swallow guard (same fix as K04 seed / openDetailFromPick):
    // on a slow CI emulator the first card tap is consumed before the gesture
    // handler wires, so the route never pushes and a single 60s waitForPageLoad
    // just burns the clock (run 26425928045, E01:88 — Add to Cart not displayed
    // after 60s). Re-tap up to 3× with shorter per-attempt waits, re-picking the
    // (possibly stale) card, but only while still on the grid so we never re-tap
    // a slow-but-loading Detail.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await pick.el.click();
      try {
        await detailPage.waitForDisplayed(detailPage.addToCartBtn, attempt === 1 ? 30000 : 20000);
        break;
      } catch (err) {
        const stillOnGrid = await gridPage.isVisible(gridPage.firstProductCard);
        if (attempt === 3 || !stillOnGrid) throw err;
        console.log(`[E01] card tap swallowed (attempt ${attempt}); re-picking`);
        pick = await gridPage.pickRandomProduct();
      }
    }
    console.log(`[E01] picked: "${pick.name}" ${pick.price}`);
    expect(await detailPage.isVisible(detailPage.byContentDesc(pick.name))).toBe(true);

    // ── Add to Cart ──
    await detailPage.addToCart();
    await detailPage.waitForSnackbarDismissed();

    // ── Back to grid → assert badge=1 → open Cart ──
    // deviceBack() platform-branches: Android KEYCODE_BACK, iOS app-bar
    // Back tap (raw driver.back() is a no-op on iOS Flutter routes).
    await gridPage.deviceBack();
    await gridPage.waitForPageLoad();
    expect(await gridPage.getCartBadgeCount()).toBe(1);
    // navigateToCart() platform-branches: Android taps cartBtn directly,
    // iOS finds the app-bar cart button by visible coords (raw cartBtn
    // selector is Android-only).
    await gridPage.navigateToCart();
    await cartPage.waitForPageLoad();

    // ── Verify cart contents ──
    const cartLines = await cartPage.collectAllLines();
    expect(cartLines).toHaveLength(1);
    expect(cartLines[0].name).toBe(pick.name);
    expect(cartLines[0].qty).toBe(1);
    const cartTotal = await cartPage.getCartTotal();
    expect(cartTotal).toBeCloseTo(cartLines[0].total, 2);

    // ── Proceed to Checkout → fill Shipping ──
    await cartPage.tapProceedToCheckout();
    await shippingPage.waitForPageLoad();
    const customer = checkoutData.valid[0].customer;
    await shippingPage.fillForm(customer);

    // ── To Payment → Review matches Cart ──
    await shippingPage.tapToPayment();
    await reviewPage.waitForPageLoad();

    const reviewLines = await reviewPage.getOrderSummaryLines();
    expect(reviewLines).toHaveLength(1);
    expect(reviewLines[0].name).toBe(pick.name);
    expect(reviewLines[0].qty).toBe(1);
    expect(reviewLines[0].total).toBeCloseTo(cartLines[0].total, 2);
    const reviewTotal = await reviewPage.getTotal();
    expect(reviewTotal).toBeCloseTo(cartTotal, 2);

    // ── Place Order → Thank You ──
    await reviewPage.tapPlaceOrder();
    await thankYouPage.waitForPageLoad();
    expect(await thankYouPage.isVisible(thankYouPage.title)).toBe(true);
    expect(await thankYouPage.isVisible(thankYouPage.continueShoppingBtn)).toBe(true);

    // ── Continue Shopping → Landing + badge cleared ──
    await thankYouPage.tapContinueShopping();
    await landingPage.waitForPageLoad();
    expect(await landingPage.isVisible(landingPage.shopAllBtn)).toBe(true);
    expect(await gridPage.isVisible(gridPage.cartBadge)).toBe(false);
  });

  // Revert tablet to landscape so nothing downstream inherits the lock.
  test.afterAll(async ({ driver }) => {
    const { width } = await driver.getWindowRect();
    if (width > 1200) {
      try {
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'user_rotation', '0'] });
        await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'system', 'accelerometer_rotation', '1'] });
        await driver.pause(2000);
      } catch (e) {
        console.log(`[E01/afterAll] orientation revert failed: ${e?.message || e}`);
      }
    }
  });
});
