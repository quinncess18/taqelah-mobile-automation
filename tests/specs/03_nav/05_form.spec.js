// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');
const { FormValidationPage } = require('../../pages/FormValidationPage');
const testData = require('../../data/form-validation');

// CI diagnostic: wrap a toast/element wait so a failure dumps the
// screenshot + the offending UI tree to test-results/diagnostics/
// (uploaded as CI artifact). Local runs are unaffected.
async function waitForToastOrDump(driver, selector, label) {
  try {
    await (await driver.$(selector)).waitForDisplayed({ timeout: 10000 });
  } catch (err) {
    if (process.env.CI) {
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(process.cwd(), 'test-results', 'diagnostics');
      fs.mkdirSync(dir, { recursive: true });
      const stamp = `${label}-${Date.now()}`;
      try {
        const base64 = await driver.takeScreenshot();
        fs.writeFileSync(path.join(dir, `${stamp}.png`), Buffer.from(base64, 'base64'));
      } catch {}
      try {
        const pageSource = await driver.getPageSource();
        fs.writeFileSync(path.join(dir, `${stamp}.xml`), pageSource);
      } catch {}
    }
    throw err;
  }
}

// An open soft keyboard shrinks the scrollable viewport and can hide the
// bottom-fold (Submit/Reset) from both tap and the a11y tree.
// Android-only: iOS WebDriverAgent has no generic keyboard dismiss
// ("Did not know how to dismiss the keyboard" 400) and the swipe/scroll
// gestures dismiss the iOS keyboard naturally, so the call is pure noise.
async function hideKeyboard(driver) {
  if (!driver.isAndroid) return;
  try {
    await driver.execute('mobile: hideKeyboard');
  } catch {
    // Keyboard not shown — no-op.
  }
}

// Single upward swipe to surface the bottom fold.
async function scrollToBottom(driver, formPage) {
  const { width, height } = await driver.getWindowRect();
  const safeX = Math.round(width * 0.3);
  await formPage.swipe(safeX, Math.round(height * 0.7), safeX, Math.round(height * 0.3), 800);
}

// Reset's selector wraps UiScrollable.scrollIntoView, so no pre-scroll
// needed. Hide the keyboard on both sides — an open keyboard breaks the
// Reset tap region and the resetToTop swipe distance.
async function resetForm(driver, formPage) {
  await hideKeyboard(driver);
  await formPage.reset();
  await hideKeyboard(driver);
  await formPage.resetToTop();
}

test.describe('Navigation - Form Validation Suite (TC-F01-F06)', () => {
  let landingPage;
  let navMenu;
  let formPage;

  test.beforeAll(async ({ driver }) => {
    // Bypass the UIA2 "wait for idle" between every command — on cold CI the
    // Compose tree never idles cleanly after submit/reset/terms-toggle, so
    // post-state-change `waitForDisplayed` (on the error toast / "Form
    // submitted!" status) stale-reads and times out. Same lever Cart + Checkout
    // use; mirrors the [[feedback_android_ci_flaky_harden]] flake family.
    try { await driver.updateSettings({ waitForIdleTimeout: 0 }); } catch {}

    landingPage = new CatalogLandingPage(driver);
    navMenu = new NavMenuPage(driver);
    formPage = new FormValidationPage(driver);

    // SELF-HEALING: return to the DemoApp Homepage if deep-linked.
    // deviceBack() (app-bar Back / edge-swipe) — driver.back() no-ops on iOS.
    let onHome = await landingPage.isVisible(landingPage.shopAllBtn);
    let retryCount = 0;
    while (!onHome && retryCount < 3) {
      await landingPage.deviceBack();
      await driver.pause(1000);
      onHome = await landingPage.isVisible(landingPage.shopAllBtn);
      retryCount++;
    }

    await navMenu.open();
    await navMenu.navigateTo(navMenu.navForm);
    await formPage.waitForPageLoad();
  });

  test('TC-F01: should verify Form Validation page default state with all form fields', async ({ driver }) => {
    // Top fold — header, all text inputs, mid-fold widgets
    expect(await formPage.isVisible(formPage.title)).toBe(true);
    expect(await formPage.isVisible(formPage.backBtn)).toBe(true);
    expect(await formPage.isVisible(formPage.nameInput)).toBe(true);
    expect(await formPage.isVisible(formPage.emailInput)).toBe(true);
    expect(await formPage.isVisible(formPage.phoneInput)).toBe(true);
    expect(await formPage.isVisible(formPage.numberInput)).toBe(true);
    expect(await formPage.isVisible(formPage.passwordInput)).toBe(true);
    expect(await formPage.isVisible(formPage.categoryBtn)).toBe(true);
    expect(await formPage.isVisible(formPage.termsCheckbox)).toBe(true);
    expect(await formPage.isVisible(formPage.sizeLabel)).toBe(true);
    expect(await formPage.isVisible(formPage.sizeSmall)).toBe(true);
    expect(await formPage.isVisible(formPage.sizeMedium)).toBe(true);
    expect(await formPage.isVisible(formPage.sizeLarge)).toBe(true);
    expect(await formPage.isVisible(formPage.subscribeSwitch)).toBe(true);

    // Tablet pushes Rating below Subscribe (bottom fold); Android phone keeps
    // it top-fold. iOS (iPhone 15, 393×852) also lands Rating at the very
    // bottom edge (y≈851, seekbar children visible=false) — F01 dump run
    // 26322345538 — so iOS behaves like the tablet bottom-fold layout.
    const { width: vw } = await driver.getWindowRect();
    const isTablet = vw > 1200;
    const ratingBelowFold = isTablet || driver.isIOS;

    if (!ratingBelowFold) {
      expect(await formPage.isVisible(formPage.ratingLabel)).toBe(true);
      expect(await formPage.isVisible(formPage.ratingSeekBar)).toBe(true);
      expect(await formPage.getRatingText()).toBe('3/5');
    }

    await scrollToBottom(driver, formPage);

    if (ratingBelowFold) {
      expect(await formPage.isVisible(formPage.ratingLabel)).toBe(true);
      expect(await formPage.isVisible(formPage.ratingSeekBar)).toBe(true);
      expect(await formPage.getRatingText()).toBe('3/5');
    }

    expect(await formPage.isVisible(formPage.dateInput)).toBe(true);
    expect(await formPage.isVisible(formPage.timeInput)).toBe(true);
    expect(await formPage.isVisible(formPage.submitBtn)).toBe(true);
    expect(await formPage.isVisible(formPage.resetBtn)).toBe(true);

    // Default selections
    expect(await formPage.isSizeSelected('Medium')).toBe(true);
    expect(await formPage.isSizeSelected('Small')).toBe(false);
    expect(await formPage.isSizeSelected('Large')).toBe(false);
    expect(await formPage.isTermsChecked()).toBe(false);
    expect(await formPage.isSubscribeChecked()).toBe(false);

    // End at top fold for the next test.
    await formPage.resetToTop();
  });

  test('TC-F02: should submit successfully via the full happy path (Bridal/Large/2of5)', async ({ driver }) => {
    await formPage.enterName(testData.valid.name);
    await formPage.enterEmail(testData.valid.email);
    await formPage.enterPhone(testData.valid.phone);
    await formPage.enterNumber(testData.valid.number);
    await formPage.enterPassword(testData.valid.password);
    await formPage.selectCategory('Bridal');
    await formPage.selectSize('Large');
    await formPage.toggleTerms();
    await formPage.toggleSubscribe();

    // 2/5 = 25% on the 1..5 scale (0%→1, 25%→2, 50%→3, 75%→4, 100%→5).
    await formPage.setRating(25);
    expect(await formPage.getRatingText()).toBe('2/5');

    await scrollToBottom(driver, formPage);
    await formPage.selectDate(2027, 15);
    await formPage.selectTime(10, 30, 'PM');
    expect(await formPage.getDateText()).toMatch(/^2027-\d{2}-15$/);
    expect(await formPage.getTimeText()).toMatch(/^10:30\s*PM$/i);

    await formPage.submit();
    await waitForToastOrDump(driver, formPage.toastSuccess, 'F02-toastSuccess');

    // Pause for the success Snackbar to clear (~4s in this app) BEFORE
    // Reset — a visible toast intercepts the Reset tap region and the
    // click silently fails, leaving the form populated for the next test.
    // Fixed pause beats waitForDisplayed-reverse, which trips on stale
    // element refs once the toast View is removed from the hierarchy.
    await driver.pause(4000);
    await resetForm(driver, formPage);
  });

  test('TC-F03: should reject Submit when Terms is OFF, then succeed after ticking Terms (consolidated)', async ({ driver }) => {
    // In-page reset to a clean default form — no page exit. The Reset button
    // clears all fields/selections, so each TC starts clean while staying on
    // the form. Only F06 leaves (its test is reset-on-reentry).
    await resetForm(driver, formPage);

    // Consolidated TC: fill the form with valid data through Category, leave
    // Terms OFF, Submit → Terms-required toast. Then tick Terms and Submit
    // again → success toast. Exercises both the Terms-required validation
    // path AND the happy path on the same filled-in form state.
    // Size stays default Medium; Subscribe stays default OFF; Rating stays default 3/5.
    await formPage.enterName(testData.validAlt.name);
    await formPage.enterEmail(testData.validAlt.email);
    await formPage.enterPhone(testData.validAlt.phone);
    await formPage.enterNumber(testData.validAlt.number);
    await formPage.enterPassword(testData.validAlt.password);
    await formPage.selectCategory('Casual');
    // Intentionally do NOT tick Terms here.

    await hideKeyboard(driver);
    await scrollToBottom(driver, formPage);
    await formPage.submit();
    await waitForToastOrDump(driver, formPage.toastTermsRequired, 'F03-toastTermsRequired');

    // Wait for Terms-required toast to clear before the second submit so it
    // doesn't intercept the Terms tap region.
    await driver.pause(4000);

    // Tick Terms and Submit again → success.
    await formPage.toggleTerms();
    await scrollToBottom(driver, formPage);
    await formPage.submit();
    await waitForToastOrDump(driver, formPage.toastSuccess, 'F03-toastSuccess');

    // Pause for success toast to clear before Reset (see F02 comment).
    await driver.pause(4000);
    await resetForm(driver, formPage);
  });

  test('TC-F04: should show all required-field error messages when submitting an empty form', async ({ driver }) => {
    // In-page reset to a clean (empty) form for the empty-submit checks.
    await resetForm(driver, formPage);

    // Submit with everything empty.
    await scrollToBottom(driver, formPage);
    await formPage.submit();
    await formPage.resetToTop();

    // Gate the isVisible probes on errorName actually rendering — on slow
    // CI Flutter, the required-error labels can lag behind the submit by a
    // few hundred ms, causing the first .toBe(true) to fail against an
    // empty a11y tree. Waiting for one error to land confirms the rest
    // have rendered before we probe them.
    await formPage.waitForDisplayed(formPage.errorName, 5000);

    expect(await formPage.isVisible(formPage.errorName)).toBe(true);
    expect(await formPage.isVisible(formPage.errorEmailRequired)).toBe(true);
    expect(await formPage.isVisible(formPage.errorPhoneRequired)).toBe(true);
    expect(await formPage.isVisible(formPage.errorNumberRequired)).toBe(true);
    expect(await formPage.isVisible(formPage.errorPasswordRequired)).toBe(true);
    expect(await formPage.isVisible(formPage.errorCategoryRequired)).toBe(true);
  });

  test('TC-F05: should show format-error messages for invalid fields (no Reset; Name stays valid)', async ({ driver }) => {
    // In-page reset to a clean default form before filling invalid values.
    await resetForm(driver, formPage);

    // Fill a valid Name (different value to vary coverage) and INVALID values
    // for Email/Phone/Number/Password. Toggle Terms ON so format errors fire
    // (otherwise the Terms toast preempts field validation).
    await formPage.enterName(testData.valid.altName);
    await formPage.enterEmail(testData.invalid.emails[0]);            // "notanemail"
    await formPage.enterPhone(testData.invalid.phones[0]);            // "12345"
    await formPage.enterNumber(testData.invalid.numberOutOfRange[0]); // 0
    await formPage.enterPassword(testData.invalid.passwords[0]);      // "Ab1"
    // Tablet-only nuance: F04's required-error labels add ~32px per field
    // to form height, which pushes Category below the soft keyboard's top
    // edge after Password types — Category drops out of the a11y tree.
    // Hide the keyboard to restore Category to the rendered tree before
    // tapping it. Phone is unaffected (taller proportional viewport).
    await hideKeyboard(driver);
    await formPage.selectCategory('Formal');
    await formPage.selectSize('Large');
    await formPage.toggleTerms();

    // 4/5 = 75%
    await formPage.setRating(75);
    expect(await formPage.getRatingText()).toBe('4/5');

    // Tablet-only: setRating's UiScrollable left viewport at the bottom on
    // tablet. Phone keeps Rating top-fold so no scroll happens.
    const { width: vw5 } = await driver.getWindowRect();
    if (vw5 <= 1200) await scrollToBottom(driver, formPage);

    await hideKeyboard(driver);
    await formPage.submit();
    await formPage.resetToTop();

    // Format errors fire for the four invalid fields. hasValidationError gates
    // on render-lag AND scrolls each label into view — F05 deterministically
    // failed lines 271/272 (the TOP errors, Email/Phone) on slower CI machines
    // because the taller error-state form left them clipped under the app bar
    // after submit auto-scrolled to the first invalid field (run 26265465033).
    // Text mirrors the POM error selectors (errorEmailInvalid, etc.).
    expect(await formPage.hasValidationError('Enter a valid email')).toBe(true);
    expect(await formPage.hasValidationError('At least 10 digits')).toBe(true);
    expect(await formPage.hasValidationError('Enter 1-100')).toBe(true);
    expect(await formPage.hasValidationError('Min 6 characters')).toBe(true);
    // Name has no format check, so its error must NOT be present.
    expect(await formPage.isVisible(formPage.errorName)).toBe(false);
  });

  test('TC-F06: should reset form state after Back navigation and re-entry', async ({ driver }) => {
    // Cascading from F05 — form is in error state with invalid values still
    // populated, Terms ON, Size Large, Rating 4/5. Final state changes
    // before Back-navigation: set Rating 1/5. Then leave the form via Back
    // and re-enter via the nav menu — the form should reload at default
    // state matching TC-F01.
    await formPage.resetToTop();

    // 1/5 = 0%. Scroll the Rating SeekBar into the viewport first — F06
    // inherits F05's tall error-state form, so the SeekBar sits below the
    // fold; without this the drag misses and the thumb stays at F05's 4/5.
    await scrollToBottom(driver, formPage);
    await formPage.setRating(0);
    expect(await formPage.getRatingText()).toBe('1/5');

    // Leave the form and return via the menu.
    // deviceBack() (app-bar Back / edge-swipe) — driver.back() no-ops on iOS.
    await formPage.deviceBack();
    await driver.pause(1000);
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navForm);
    await formPage.waitForPageLoad();

    // Default state must hold (mirrors TC-F01's default-state assertions).
    expect(await formPage.isSizeSelected('Medium')).toBe(true);
    expect(await formPage.isSizeSelected('Small')).toBe(false);
    expect(await formPage.isSizeSelected('Large')).toBe(false);
    expect(await formPage.isTermsChecked()).toBe(false);
    expect(await formPage.isSubscribeChecked()).toBe(false);
    expect(await formPage.getRatingText()).toBe('3/5');
  });
});
