// @ts-check
const { BasePage } = require('./BasePage');

/**
 * ShippingInfoPage — POM for the Shipping Info screen (Checkout step 1).
 *
 * Form layout: 7 NAF EditText fields in DOM order, no hint/resource-id.
 * Address 2 (index 2) is the only optional field; the other 6 are required
 * and surface a child View `description="This field is required"` after an
 * empty submit. Mirrors FormValidationPage's a11y model — same
 * UiScrollable + instance(N) pattern, same `hideKeyboard()` discipline.
 *
 * Field index map:
 *   0 = Full Name      4 = State
 *   1 = Address 1      5 = Zip
 *   2 = Address 2 (opt) 6 = Country
 *   3 = City
 */
class ShippingInfoPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    this.title = this.isAndroid
      ? 'android=new UiSelector().description("Shipping Info")'
      : '~Shipping Info';

    // EditText fields — UiScrollable.scrollIntoView keeps instance(N) stable
    // regardless of current scroll position (same rationale as Form Validation).
    const scrollEditText = (n) =>
      `android=new UiScrollable(new UiSelector().scrollable(true).instance(0))` +
      `.scrollIntoView(new UiSelector().className("android.widget.EditText").instance(${n}))`;

    // iOS: Flutter TextFields surface with name = the field's visible label
    // (mirrors FormValidationPage's name-fallback contract — Key() does not
    // reach accessibilityIdentifier). Labels confirmed against the K02
    // failure-source.xml from run 26500171944 (Address 1 → "Address Line 1",
    // Address 2 → "Address Line 2 (Optional)", Zip → "Zip Code").
    this.fullNameInput  = this.isAndroid ? scrollEditText(0) : '~Full Name';
    this.address1Input  = this.isAndroid ? scrollEditText(1) : '~Address Line 1';
    this.address2Input  = this.isAndroid ? scrollEditText(2) : '~Address Line 2 (Optional)';
    this.cityInput      = this.isAndroid ? scrollEditText(3) : '~City';
    this.stateInput     = this.isAndroid ? scrollEditText(4) : '~State';
    this.zipInput       = this.isAndroid ? scrollEditText(5) : '~Zip Code';
    this.countryInput   = this.isAndroid ? scrollEditText(6) : '~Country';

    // To Payment button — leaves Shipping → Review Order.
    this.toPaymentBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").description("To Payment")'
      : '~To Payment';

    // Required-field error label (one per missing required field after empty
    // submit). Address 2 stays clean — never gets this child.
    this.requiredFieldError = this.isAndroid
      ? 'android=new UiSelector().description("This field is required")'
      : '~This field is required';
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.title);
  }

  /**
   * Type into a field. Mirrors FormValidationPage.typeIntoField:
   *   click → clearValue → addValue → hideKeyboard → settle
   * The keyboard-dismiss between fields is mandatory — while the keyboard
   * is up, Flutter's a11y tree collapses unfocused EditTexts AND the
   * scrollable container, so the next field's `instance(N)` selector can
   * resolve against a near-empty tree and land on the wrong field.
   * @param {string} fieldSelector
   * @param {string} value
   */
  async typeInto(fieldSelector, value) {
    const el = await this.waitForDisplayed(fieldSelector, 10000);
    await el.click();
    // Intra-action pauses mirror FormValidationPage.typeIntoField — without
    // them, on iOS CI Flutter under render-lag, addValue commits to the
    // a11y `value` before the TextEditingController can bind. Validators
    // then read empty controller.text on submit and fire "required field"
    // errors despite a11y showing the field as populated (see
    // [[feedback_ios_validator_coupling]] + run 26509598351 K02 XML dump:
    // all 7 fields had value="..." AND "This field is required" labels).
    await this.driver.pause(200);
    await el.clearValue();
    await this.driver.pause(200);
    if (value && value.length > 0) {
      await el.addValue(value);
    }
    await this.driver.pause(200);
    if (this.isAndroid) {
      try { await this.driver.hideKeyboard(); } catch {}
    }
    await this.driver.pause(this.settlePause);
  }

  /**
   * Fill all 7 Shipping fields from a `checkout-scenarios.json` customer
   * fixture (`{ fullName, address1, address2, city, state, zip, country }`).
   * Address 2 may be empty string — typeInto handles that as a no-op type.
   */
  async fillForm(customer) {
    await this.typeInto(this.fullNameInput, customer.fullName);
    await this.typeInto(this.address1Input, customer.address1);
    await this.typeInto(this.address2Input, customer.address2);
    await this.typeInto(this.cityInput, customer.city);
    await this.typeInto(this.stateInput, customer.state);
    await this.typeInto(this.zipInput, customer.zip);
    await this.typeInto(this.countryInput, customer.country);
  }

  /**
   * Read an EditText field's current text — used for state-preservation
   * assertions (K04: re-renders form after Back must preserve all 7 values).
   * NAF EditText nodes expose text via `.getText()`; the UiScrollable
   * wrapper resolves the underlying element correctly.
   * @param {string} fieldSelector
   * @returns {Promise<string>}
   */
  async getFieldValue(fieldSelector) {
    const el = await this.waitForDisplayed(fieldSelector, 10000);
    return el.getText();
  }

  /**
   * Read all 7 field values in fixture-key order. Returns
   * `{ fullName, address1, address2, city, state, zip, country }` —
   * shape-compatible with the `checkout-scenarios.json` customer object
   * so K04 can diff verbatim.
   */
  async readForm() {
    return {
      fullName: await this.getFieldValue(this.fullNameInput),
      address1: await this.getFieldValue(this.address1Input),
      address2: await this.getFieldValue(this.address2Input),
      city:     await this.getFieldValue(this.cityInput),
      state:    await this.getFieldValue(this.stateInput),
      zip:      await this.getFieldValue(this.zipInput),
      country:  await this.getFieldValue(this.countryInput),
    };
  }

  /** Tap "To Payment". Caller is responsible for waiting on next screen. */
  async tapToPayment() {
    const btn = await this.driver.$(this.toPaymentBtn);
    await btn.click();
  }

  /** Count of "This field is required" labels currently in the a11y tree. */
  async getRequiredFieldErrorCount() {
    const errors = await this.driver.$$(this.requiredFieldError);
    return errors.length;
  }
}

module.exports = { ShippingInfoPage };
