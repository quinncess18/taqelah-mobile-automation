// @ts-check
const { BasePage } = require('./BasePage');
const { DialogsPage } = require('./DialogsPage');

/**
 * FormValidationPage — POM for the Form Validation module.
 * Covers: Name, Email, Phone, Number, Password, Category dropdown,
 * Terms checkbox, Size radio group, Subscribe switch, Rating seek bar,
 * Date picker, Time picker, Submit and Reset buttons.
 *
 * Date and Time pickers reuse the same dialog popups from Dialogs & Alerts.
 * Use DialogsPage methods for Date/Time interactions.
 */
class FormValidationPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    // Date/Time pickers open the same dialogs the Dialogs & Alerts module uses,
    // so picker interaction is delegated to a DialogsPage instance to keep one
    // source of truth for calendar/dial mechanics (selectYear, selectDate(day),
    // setHours, setMinutes, selectPeriod, _dialGeometry, etc.).
    this._dialogs = new DialogsPage(driver);

    // ── Page Title ──
    this.title = this.isAndroid
      ? 'android=new UiSelector().description("Form Validation")'
      : '~Form Validation';

    // ── Text Input Fields ──
    // Anchored via UiScrollable.scrollIntoView so each field is reliably
    // resolved regardless of current scroll position. Bare instance(N)
    // selectors are fragile: when the soft keyboard pops up and Flutter's a11y bridge
    // auto-scrolls, the previous field can drop from the a11y tree,
    // shifting instance numbering — CI run 25709947969 hit this on
    // TC-F02, where between enterEmail and enterPhone the tree narrowed
    // such that instance(2) resolved to the Number field instead of
    // Phone, and the Phone value got typed into Number. UiScrollable
    // scans the whole scrollable container so instance(N) refers to the
    // N-th EditText in DOM order, not the N-th currently visible.
    const scrollEditText = (n) =>
      `android=new UiScrollable(new UiSelector().scrollable(true).instance(0))` +
      `.scrollIntoView(new UiSelector().className("android.widget.EditText").instance(${n}))`;

    // iOS: Flutter TextFields surface with name/label = the field's visible
    // label (verified vs run 26322345538 F01 dump: name="Name", "Email",
    // "Phone", "Number (1-100)", "Password"). Key() does NOT reach
    // accessibilityIdentifier, so `~<label>` name-fallback is the contract.
    this.nameInput     = this.isAndroid ? scrollEditText(0) : '~Name';
    this.emailInput    = this.isAndroid ? scrollEditText(1) : '~Email';
    this.phoneInput    = this.isAndroid ? scrollEditText(2) : '~Phone';
    this.numberInput   = this.isAndroid ? scrollEditText(3) : '~Number (1-100)';
    this.passwordInput = this.isAndroid ? scrollEditText(4) : '~Password';

    // ── Category Dropdown ──
    this.categoryBtn = this.isAndroid
      ? 'android=new UiSelector().descriptionStartsWith("Category")'
      : '~Category';

    // ── Terms Checkbox ──
    this.termsCheckbox = this.isAndroid
      ? 'android=new UiSelector().description("I accept the terms and conditions")'
      : '~I accept the terms and conditions';

    // ── Size Radio Group ──
    this.sizeLabel = this.isAndroid
      ? 'android=new UiSelector().description("Size")'
      : '~Size';

    this.sizeSmall = this.isAndroid
      ? 'android=new UiSelector().description("Small")'
      : '~Small';

    this.sizeMedium = this.isAndroid
      ? 'android=new UiSelector().description("Medium")'
      : '~Medium';

    this.sizeLarge = this.isAndroid
      ? 'android=new UiSelector().description("Large")'
      : '~Large';

    // ── Subscribe Switch ──
    this.subscribeSwitch = this.isAndroid
      ? 'android=new UiSelector().description("Subscribe to newsletter")'
      : '~Subscribe to newsletter';

    // ── Rating SeekBar ──
    this.ratingLabel = this.isAndroid
      ? 'android=new UiSelector().description("Rating")'
      : '~Rating';

    // iOS: no XCUIElementTypeSlider — the Flutter slider surfaces as an
    // adjustable Other whose `value` is the percentage (e.g. "50%"); the
    // "N/5" label is a separate StaticText. Match by attribute shape
    // (F01 dump, run 26322345538) since neither has a stable name/id.
    this.ratingSeekBar = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.SeekBar")'
      : '-ios predicate string:value ENDSWITH "%"';

    this.ratingValue = this.isAndroid
      ? 'android=new UiSelector().descriptionContains("/5")'
      : '-ios predicate string:name ENDSWITH "/5"';

    // ── Date Picker (reuses Dialogs & Alerts popup) ──
    // iOS: input row exposes name="Date" (F01 dump). `~Date` name-fallback.
    this.dateInput = this.isAndroid
      ? '//android.view.View[@hint="Date"]'
      : '~Date';

    // ── Time Picker (reuses Dialogs & Alerts popup) ──
    this.timeInput = this.isAndroid
      ? '//android.view.View[@hint="Time"]'
      : '~Time';

    // Date/Time picker dialog selectors (OK, year dropdown, dial geometry, etc.)
    // are owned by DialogsPage and accessed via this._dialogs.

    // ── Action Buttons ──
    this.submitBtn = this.isAndroid
      ? 'android=new UiSelector().description("Submit")'
      : '~Submit';

    // Reset sits at the very bottom fold below Submit. The form's height grows
    // when fields are populated and error messages render, so a fixed-distance
    // swipe can't reliably surface Reset. Wrap in UiScrollable so the driver
    // scrolls the scrollable container until Reset enters the layout tree.
    this.resetBtn = this.isAndroid
      ? 'android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().description("Reset"))'
      : '~Reset';

    // ── Error Message Selectors ──
    // Individual field-level errors (appear below each input)
    this.errorName = this.isAndroid
      ? 'android=new UiSelector().description("Name is required")'
      : '~Name is required';

    this.errorEmailRequired = this.isAndroid
      ? 'android=new UiSelector().description("Email is required")'
      : '~Email is required';

    this.errorEmailInvalid = this.isAndroid
      ? 'android=new UiSelector().description("Enter a valid email")'
      : '~Enter a valid email';

    this.errorPhoneRequired = this.isAndroid
      ? 'android=new UiSelector().description("Phone is required")'
      : '~Phone is required';

    this.errorPhoneInvalid = this.isAndroid
      ? 'android=new UiSelector().description("At least 10 digits")'
      : '~At least 10 digits';

    this.errorNumberRequired = this.isAndroid
      ? 'android=new UiSelector().description("Required")'
      : '~Required';

    this.errorNumberRange = this.isAndroid
      ? 'android=new UiSelector().description("Enter 1-100")'
      : '~Enter 1-100';

    this.errorPasswordRequired = this.isAndroid
      ? 'android=new UiSelector().description("Password is required")'
      : '~Password is required';

    this.errorPasswordMin = this.isAndroid
      ? 'android=new UiSelector().description("Min 6 characters")'
      : '~Min 6 characters';

    this.errorCategoryRequired = this.isAndroid
      ? 'android=new UiSelector().description("Please select a category")'
      : '~Please select a category';

    // ── Toast / Snackbar Messages ──
    this.toastTermsRequired = this.isAndroid
      ? 'android=new UiSelector().description("Please accept the terms")'
      : '~Please accept the terms';

    this.toastSuccess = this.isAndroid
      ? 'android=new UiSelector().description("Form submitted successfully!")'
      : '~Form submitted successfully!';
  }

  /**
   * Wait for the Form Validation page to load.
   */
  async waitForPageLoad() {
    await this.waitForDisplayed(this.title);
  }

  /**
   * Type text into a form input field.
   * Uses click → clearValue → addValue for reliable input.
   * @param {string} selector
   * @param {string} value
   */
  async typeIntoField(selector, value) {
    const el = await this.driver.$(selector);
    // Wait for the field to enter the a11y tree before clicking. On slower
    // CI Flutter, the previous field's focus can transiently narrow the
    // tree (instance(N) selectors stale momentarily — see
    // feedback_compose_tree_narrowing). CI run 25708179594 hit this on
    // TC-F02 first attempt: EditText.instance(1) (Email) was missing
    // right after Name was typed. waitForDisplayed gives it time to land.
    await el.waitForDisplayed({ timeout: 5000 });
    await el.click();
    await this.driver.pause(200);
    await el.clearValue();
    await this.driver.pause(200);
    await el.addValue(value);
    await this.driver.pause(200);
    // Dismiss the soft keyboard before returning. While the keyboard is
    // up Flutter's semantic tree collapses unfocused fields and the
    // scrollable container from the a11y bridge (verified via CI run
    // 25711364179 dump: 0 EditText
    // nodes despite the form being visually intact). Without this, the
    // NEXT typeIntoField's instance(N) selector resolves against a
    // narrowed tree and can land on the wrong field — e.g. Phone value
    // ending up in the Number field on CI's slower Flutter rendering.
    // Android-only: iOS WDA has no generic keyboard dismiss (400 "Did not
    // know how to dismiss the keyboard") and iOS uses stable ~label
    // selectors immune to tree narrowing, so the call is unneeded noise.
    if (this.isAndroid) {
      try { await this.driver.hideKeyboard(); } catch { /* keyboard not up */ }
    }
    await this.driver.pause(300);
  }

  /**
   * Fill in the Name field.
   * @param {string} name
   */
  async enterName(name) {
    await this.typeIntoField(this.nameInput, name);
  }

  /**
   * Fill in the Email field.
   * @param {string} email
   */
  async enterEmail(email) {
    await this.typeIntoField(this.emailInput, email);
  }

  /**
   * Fill in the Phone field.
   * @param {string} phone
   */
  async enterPhone(phone) {
    await this.typeIntoField(this.phoneInput, phone);
  }

  /**
   * Fill in the Number field.
   * @param {string|number} number
   */
  async enterNumber(number) {
    await this.typeIntoField(this.numberInput, String(number));
  }

  /**
   * Fill in the Password field. Pre-scrolls via UiScrollable so the
   * Password EditText (instance 4) lands in the a11y tree even when prior
   * field interactions auto-scrolled the form to a state where Password
   * fell off the visible area.
   *
   * Tablet-only branch (F04→F05 cascade, diagnosed via
   * `form-validation-password-focused.xml`): after click, the tablet a11y
   * tree narrows (Name pushed off-screen and dropped), so instance(4)
   * becomes unresolvable on WDIO's stale-retry inside typeIntoField.
   * Workaround: click via instance(4) (still valid pre-click), then
   * refetch via `focused(true)` for clearValue/addValue — this resolves
   * to whichever EditText currently has focus, which is Password right
   * after the click. Phone path stays on instance(4) end-to-end.
   * @param {string} password
   */
  async enterPassword(password) {
    if (this.isAndroid) {
      const { width } = await this.driver.getWindowRect();
      const isTablet = width > 1200;

      if (isTablet) {
        // Tablet branch — pre-scroll + click via instance(4), then refetch
        // via focused(true) for the typing actions.
        try {
          const initialEl = await this.driver.$(
            'android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().className("android.widget.EditText").instance(4))'
          );
          await initialEl.click();
        } catch {
          // No scroll needed — direct click on Password.
          const fallbackEl = await this.driver.$(this.passwordInput);
          await fallbackEl.click();
        }
        await this.driver.pause(400); // settle keyboard + Flutter widget rebuild
        const focusedEl = await this.driver.$(
          'android=new UiSelector().className("android.widget.EditText").focused(true)'
        );
        await focusedEl.clearValue();
        await this.driver.pause(200);
        await focusedEl.addValue(password);
        await this.driver.pause(200);
        return;
      }

      // Phone path (unchanged): pre-scroll, then standard typeIntoField.
      try {
        await this.driver.$(
          'android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().className("android.widget.EditText").instance(4))'
        );
      } catch {
        // Already in view or no scrollable container — fall through.
      }
    }
    await this.typeIntoField(this.passwordInput, password);
  }

  /**
   * Assert a post-submit validation error is present, resilient to the two ways
   * TC-F05 flaked deterministically on CI (per-run, all retries):
   *   1. Render lag — on slow CI Flutter the validation labels land a few
   *      hundred ms after submit; a single-shot isVisible probes too early.
   *   2. Clipping — F05's filled-in error-state form is taller than F04's, and
   *      submit auto-scrolls to the FIRST invalid field, leaving the TOP labels
   *      (Email/Phone) tucked under the app bar; the gentle resetToTop swipe
   *      doesn't clear them, so isVisible returns false for the top errors while
   *      the lower ones (Number/Password) pass — the exact observed signature.
   * Android scrolls the label into the scrollable container's view first
   * (UiScrollable), then waits for it to display. If the error genuinely never
   * fires (e.g. an invalid value didn't land → the *required* error shows
   * instead), this returns false and the _failureDiagnostic dump shows why.
   * @param {string} text - exact error label text (e.g. "Enter a valid email")
   * @param {number} timeout
   * @returns {Promise<boolean>}
   */
  async hasValidationError(text, timeout = 6000) {
    if (this.isAndroid) {
      try {
        await this.driver.$(
          `android=new UiScrollable(new UiSelector().scrollable(true).instance(0))` +
          `.scrollIntoView(new UiSelector().description("${text}"))`
        );
      } catch {
        // Not yet in the tree, or no scrollable container — fall through to the
        // wait, which gives a lagging label time to render.
      }
      // HARDFIX (run 26425928045, F05 hard-failed all retries): assert PRESENCE
      // in the a11y tree, not visual display. scrollIntoView only guarantees the
      // label is inside the scroll container — NOT clear of the FIXED app bar
      // overlay, so the top errors (Email/Phone) stay visible=false at scroll-top
      // and waitForDisplayed times out (the exact positional signature: top-2
      // errors missing, bottom-2 present). Presence is what F05 actually checks —
      // "did this format error fire?" — and a fired-but-clipped label exists in
      // the tree while a genuinely-unfired one (invalid value never landed →
      // required error instead) is absent, so this stays correct. waitForExist
      // also rides out the post-submit render lag.
      try {
        await this.driver.$(`android=new UiSelector().description("${text}")`).waitForExist({ timeout });
        return true;
      } catch {
        return false;
      }
    }
    // iOS (module not yet wired here) — name-fallback wait. Future-proof.
    try {
      await this.waitForDisplayed(`~${text}`, timeout);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Open the Category dropdown.
   */
  async openCategory() {
    const el = await this.driver.$(this.categoryBtn);
    await el.click();
    await this.driver.pause(500);
  }

  /**
   * Select a category from the dropdown.
   * @param {'Casual' | 'Formal' | 'Party' | 'Bridal'} category
   */
  async selectCategory(category) {
    await this.openCategory();
    const selector = this.isAndroid
      ? `android=new UiSelector().description("${category}")`
      : `~${category}`;
    const el = await this.driver.$(selector);
    await el.click();
    await this.driver.pause(500);
  }

  /**
   * Select a size from the radio group.
   * @param {'Small' | 'Medium' | 'Large'} size
   */
  async selectSize(size) {
    const selector = this.isAndroid
      ? `android=new UiSelector().description("${size}")`
      : `~${size}`;
    const el = await this.driver.$(selector);
    await el.click();
    await this.driver.pause(300);
  }

  /**
   * Toggle the terms checkbox.
   */
  async toggleTerms() {
    const el = await this.driver.$(this.termsCheckbox);
    await el.click();
    await this.driver.pause(300);
  }

  /**
   * Toggle the subscribe switch.
   */
  async toggleSubscribe() {
    const el = await this.driver.$(this.subscribeSwitch);
    await el.click();
    await this.driver.pause(300);
  }

  /**
   * Set the rating via the SeekBar's underlying Material 3 Slider.
   *
   * Uses `mobile: dragGesture` (UIAutomator2 driver's native gesture API)
   * because W3C `performActions` and `mobile: shell input swipe` don't
   * generate dense-enough MotionEvents for Flutter's gesture-arena drag detector to
   * recognize as a drag — the thumb stays put. `mobile: dragGesture`
   * synthesizes a proper Android drag with intermediate move events.
   *
   * The demo app maps percent to a 1..5 scale (NOT 0..5):
   *   0%  → "0%, 1"  / label "1/5"
   *   50% → "50%, 3" / label "3/5" (default)
   *   100% → "100%, 5" / label "5/5"
   *
   * @param {number} percent - 0 to 100 (0 = far left, 100 = far right)
   */
  async setRating(percent) {
    // Tablet pushes the SeekBar into the bottom fold so it isn't in the a11y
    // tree from a top-fold viewport. Scroll-into-view via UiScrollable as a
    // side effect — keeps `ratingSeekBar` selector simple for F01's
    // visibility assertion (which intentionally tests fold position).
    await this._scrollRatingIntoView();
    const el = await this.driver.$(this.ratingSeekBar);
    const size = await el.getSize();
    const loc = await el.getLocation();
    // Read current thumb position: Android content-desc "50%, 3"; iOS value
    // "50%". Fall back to 50% if the format ever changes — non-fatal, drag
    // still works.
    const currentDesc = this.isAndroid
      ? await el.getAttribute('content-desc')
      : await el.getAttribute('value');
    const currentPct = parseInt(String(currentDesc).match(/(\d+)%/)?.[1] || '50', 10);
    // Inset by a few px so we never tap exactly on the bar's edge.
    const inset = 4;
    const trackX = (pct) => Math.round(
      loc.x + inset + ((size.width - 2 * inset) * pct / 100)
    );
    const startX = trackX(currentPct);
    const endX = trackX(percent);
    const y = Math.round(loc.y + size.height / 2);
    if (this.isAndroid) {
      await this.driver.execute('mobile: dragGesture', {
        startX,
        startY: y,
        endX,
        endY: y,
        speed: 700,
      });
    } else {
      // iOS: XCUITest equivalent. Duration in seconds.
      await this.driver.execute('mobile: dragFromToForDuration', {
        fromX: startX,
        fromY: y,
        toX: endX,
        toY: y,
        duration: 1.2,
      });
    }
    await this.driver.pause(400);
  }

  /**
   * Click the Submit button. Waits up to 8s for it to enter the a11y tree
   * — on slower CI emulators (post-hideKeyboard + scrollToBottom), Flutter
   * may not have settled the Submit button into the tree yet by the time
   * the spec calls submit(), which previously failed with "element wasn't
   * found" (CI run 25705508677 TC-F03 first-attempt).
   */
  async submit() {
    const el = await this.driver.$(this.submitBtn);
    await el.waitForDisplayed({ timeout: 8000 });
    await el.click();
    await this.driver.pause(500);
  }

  /**
   * Click the Reset button.
   */
  async reset() {
    const el = await this.driver.$(this.resetBtn);
    await el.click();
    await this.driver.pause(500);
  }

  /**
   * Open the date picker in calendar view, pick a year, tap a day, and confirm with OK.
   * Mirrors 04_dialogs.spec.js TC-D05 Part 1 (calendar happy path) — no input mode.
   * The calendar stays on the year's currently-displayed month, so the resulting
   * date will be `YYYY-<currentMonth>-<day>`.
   * Caller must scroll the Date input into viewport first.
   *
   * @param {number} year - Full year (e.g. 2027). Must be visible in the year scroller.
   * @param {number} day - Day of month (1-31)
   */
  async selectDate(year, day) {
    const el = await this.driver.$(this.dateInput);
    await el.click();
    await this.driver.pause(600);
    await this.waitForDisplayed(this._dialogs.datePickerTitle);

    // Open the year dropdown and select the target year
    await (await this.driver.$(this._dialogs.datePickerYear)).click();
    await this.driver.pause(500);
    await this._dialogs.selectYear(year);

    // Tap the day in the (now-active) month grid
    await this._dialogs.selectDate(day);

    // Confirm
    await (await this.driver.$(this._dialogs.datePickerOk)).click();
    await this.driver.pause(500);
  }

  /**
   * Open the time picker in analog dial mode, set hour and minute via dial taps,
   * select AM/PM, and confirm with OK.
   * Mirrors 04_dialogs.spec.js TC-D06 Part 1 (analog dial happy path) — no input mode.
   * Caller must scroll the Time input into viewport first.
   *
   * @param {number} hour - Hour (1-12)
   * @param {number} minute - Minute (0-59)
   * @param {'AM' | 'PM'} period
   */
  async selectTime(hour, minute, period) {
    const el = await this.driver.$(this.timeInput);
    await el.click();
    await this.driver.pause(600);
    await this.waitForDisplayed(this._dialogs.timePickerTitle);

    await this._dialogs.setHours(hour);
    await this._dialogs.setMinutes(minute);
    await this._dialogs.selectPeriod(period);

    await (await this.driver.$(this._dialogs.timePickerOk)).click();
    await this.driver.pause(500);
  }

  /**
   * Check if a radio option is selected.
   * @param {'Small' | 'Medium' | 'Large'} size
   * @returns {Promise<boolean>}
   */
  async isSizeSelected(size) {
    const selector = this.isAndroid
      ? `android=new UiSelector().description("${size}")`
      : `~${size}`;
    const el = await this.driver.$(selector);
    return this._readCheckedState(el);
  }

  /**
   * Check if the terms checkbox is checked.
   * @returns {Promise<boolean>}
   */
  async isTermsChecked() {
    const el = await this.driver.$(this.termsCheckbox);
    return this._readCheckedState(el);
  }

  /**
   * Check if the subscribe switch is checked.
   * @returns {Promise<boolean>}
   */
  async isSubscribeChecked() {
    const el = await this.driver.$(this.subscribeSwitch);
    return this._readCheckedState(el);
  }

  /**
   * Internal helper: read a checkable element's selected state across platforms.
   *   Android — `checked === 'true'`
   *   iOS     — `value === '1'`
   * @param {WebdriverIO.Element} el
   * @returns {Promise<boolean>}
   */
  async _readCheckedState(el) {
    if (this.isAndroid) {
      return (await el.getAttribute('checked')) === 'true';
    }
    return (await el.getAttribute('value')) === '1';
  }

  /**
   * Get the current rating text (e.g. "3/5"). Scrolls the SeekBar into view
   * first so the value label is in the a11y tree on tablet (bottom-fold).
   * @returns {Promise<string>}
   */
  async getRatingText() {
    await this._scrollRatingIntoView();
    const el = await this.driver.$(this.ratingValue);
    // Android surfaces "N/5" on content-desc; iOS on the StaticText's value/label.
    if (this.isAndroid) return await el.getAttribute('content-desc');
    const value = await el.getAttribute('value');
    if (value && value !== 'null') return value;
    return await el.getAttribute('label');
  }

  /**
   * Scroll the Rating SeekBar into view so setRating/getRatingText work
   * regardless of fold position.
   *   Android — UiScrollable.scrollIntoView (deterministic).
   *   iOS — Rating sits at the bottom fold (F01 dump); the slider has no
   *     XCUIElementTypeSlider and reports zero bounds while off-screen, so
   *     swipe up (bounded) until the value label "N/5" is displayed. Generic
   *     gesture, stops on the element — no hardcoded thumb coordinates.
   */
  async _scrollRatingIntoView() {
    if (this.isAndroid) {
      try {
        await this.driver.$(
          'android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().className("android.widget.SeekBar"))'
        );
      } catch {
        // Already in view or layout doesn't have a scrollable container.
      }
      return;
    }
    // iOS: bounded swipe-to-surface.
    const { width, height } = await this.driver.getWindowRect();
    const safeX = Math.round(width * 0.3);
    for (let i = 0; i < 4; i++) {
      if (await this.isVisible(this.ratingValue)) return;
      await this.swipe(safeX, Math.round(height * 0.7), safeX, Math.round(height * 0.4), 600);
    }
  }

  /**
   * Get the Date input's current value as surfaced via a11y. Reads `text` first
   * (where the form actually surfaces the chosen date as ISO YYYY-MM-DD),
   * falling back to `content-desc`. Returns empty string if neither is set.
   *
   * UiAutomator2 quirk: missing attributes come back as the literal string
   * "null", not JS null — so treat "null" as absent.
   * @returns {Promise<string>}
   */
  async getDateText() {
    return this._readNodeValue(this.dateInput);
  }

  /**
   * Get the Time input's current value (e.g. "10:30 AM"). Same a11y read
   * strategy as getDateText.
   * @returns {Promise<string>}
   */
  async getTimeText() {
    return this._readNodeValue(this.timeInput);
  }

  /**
   * Internal helper: read a Flutter-backed input's value from the `text`
   * attribute first, then `content-desc`, treating UiAutomator2's literal
   * "null" string as absent.
   * @param {string} selector
   * @returns {Promise<string>}
   */
  async _readNodeValue(selector) {
    const el = await this.driver.$(selector);
    if (this.isAndroid) {
      // Form surfaces the chosen date/time on `text`; SeekBar value lives on `content-desc`.
      const text = await el.getAttribute('text');
      if (text && text !== 'null') return text;
      const desc = await el.getAttribute('content-desc');
      if (desc && desc !== 'null') return desc;
    } else {
      // iOS exposes the chosen value via `value`; `label` is a label-only fallback.
      const value = await el.getAttribute('value');
      if (value && value !== 'null') return value;
      const label = await el.getAttribute('label');
      if (label && label !== 'null') return label;
    }
    return '';
  }
}

module.exports = { FormValidationPage };
