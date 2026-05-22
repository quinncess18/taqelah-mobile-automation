// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');

// ─────────────────────────────────────────────────────────────────────────────
// §0 Smoke — foundation check. Runs FIRST in the suite. If this fails the
// app is fundamentally broken and there's no point running the 30+ minute
// unit suite below. Deliberately narrow: login + first-render + logout.
// No cart, no checkout — those belong to regression (§16).
//
// Ends on the Login screen so 01_auth's TC-L01 inherits a clean state.
// ─────────────────────────────────────────────────────────────────────────────

// Cold-start warm-up gate. On a freshly-booted CI emulator the app's first
// Flutter frame + the UIA2 a11y bridge can take well past the 10s
// waitForPageLoad budget to surface the Login screen — the #1 Android flake:
// SM01 times out at line 27 on description("DemoApp"). Confirmed Mode A (not a
// dead session) across runs 26265465033 / 26264799926 — every error was a
// "still not displayed" find-timeout, session always alive; the element simply
// hadn't rendered. Smoke runs FIRST, so we absorb that cold cost here in a
// tolerant poll (early misses swallowed) instead of failing the test body, and
// this also warms the bridge for every downstream module. Polling isVisible
// issues real findElements, which pump the a11y bridge. Returns as soon as the
// screen is ready (≈free on a warm boot) and NEVER throws — a pathologically
// slow AVD still falls through to the test body's own waitForPageLoad + the
// _failureDiagnostic dump, so the canonical failure/artifact is preserved.
//
// Confirmed SM01 root cause (run 26279266560 dump): the resource-starved
// cold-boot CI emulator ANRs the Pixel Launcher, and its "<App> isn't responding
// / Wait / Close app" SYSTEM dialog overlays our app — the login screen renders
// fine *behind* it, but the dialog hides the fields and intercepts taps. CI now
// prevents this suite-wide via `hide_error_dialogs 1`; this warm-up dismisses it
// defensively each iteration (covers any that slip through, and local boots).

// Dismiss an Android system ANR ("isn't responding") dialog if present by
// tapping "Wait" (least disruptive; "Close app" as fallback). Android-only —
// iOS has no ANR. Best-effort, never throws.
async function dismissSystemAnr(driver) {
  for (const label of ['Wait', 'Close app']) {
    try {
      const btn = await driver.$(`android=new UiSelector().text("${label}")`);
      if (await btn.isDisplayed()) {
        await btn.click();
        await driver.pause(500);
        return true;
      }
    } catch { /* not present */ }
  }
  return false;
}

async function warmUpLoginScreen(loginPage, driver, budgetMs = 60000) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    // Clear a launcher-ANR overlay (covers the login fields on cold CI boots).
    if (driver.isAndroid) await dismissSystemAnr(driver);
    if ((await loginPage.isVisible(loginPage.title)) &&
        (await loginPage.isVisible(loginPage.usernameField))) {
      return;
    }
    await driver.pause(1500);
  }
  console.warn(`[smoke-warmup] Login screen not ready within ${budgetMs}ms; deferring to test body`);
}

test.describe('Smoke (§0) — foundation', () => {
  /** @type {LoginPage} */ let loginPage;
  /** @type {CatalogLandingPage} */ let landingPage;

  test.beforeAll(async ({ driver }) => {
    try { await driver.updateSettings({ waitForIdleTimeout: 0 }); } catch {}
    loginPage = new LoginPage(driver);
    landingPage = new CatalogLandingPage(driver);
    await warmUpLoginScreen(loginPage, driver);
  });

  test('TC-SM01: app launches → login works → Catalog Landing renders → logout returns to Login', async () => {
    // 1. App launches → Login screen is the entry point.
    await loginPage.waitForPageLoad();
    expect(await loginPage.isVisible(loginPage.usernameField)).toBe(true);
    expect(await loginPage.isVisible(loginPage.passwordField)).toBe(true);
    expect(await loginPage.isVisible(loginPage.loginButton)).toBe(true);

    // 2. Login with default credentials → Catalog Landing renders.
    await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
    await landingPage.waitForPageLoad();
    expect(await landingPage.isVisible(landingPage.shopAllBtn)).toBe(true);

    // 3. Logout via drawer → app returns to Login. This also leaves a clean
    //    state for 01_auth's TC-L01 which expects to start on Login.
    await loginPage.logout();
    expect(await loginPage.isVisible(loginPage.usernameField)).toBe(true);
    expect(await loginPage.isVisible(loginPage.loginButton)).toBe(true);
  });
});
