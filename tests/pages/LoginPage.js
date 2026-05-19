// @ts-check
const { BasePage } = require('./BasePage');

/**
 * LoginPage — POM for the Taqelah Demo App login screen.
 * Universally safe for Phone, Tablet, and iPad.
 */
class LoginPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);
    
    // Core Selectors (Cross-Platform Flutter TestKeys)
    // iOS: Flutter Key('login_username_field') doesn't propagate to
    // accessibilityIdentifier, so we match by `name` (which Appium's `~`
    // finder uses as fallback). Verified via diagnostic XML from run
    // 26080218853 — both TextFields surface as XCUIElementTypeTextField
    // with name="Username"/"Password" from the InputDecoration labelText.
    this.usernameField = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.EditText").instance(0)'
      : '~Username';

    this.passwordField = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.EditText").instance(1)'
      : '~Password';
    
    this.loginButton = this.isAndroid 
      ? 'android=new UiSelector().className("android.widget.Button").description("Login")' 
      : '~Login';
    
    // Error Message Selectors
    // iOS: Flutter exposes form-validator errors as XCUIElementTypeStaticText
    // siblings of the field, with the message string as both name and label.
    // Verified via diagnostic XML from run 26083703919 (TC-N01).
    // iOS renders mainError as a multi-line node:
    //   "Invalid username or password.\nHint: emma@demoapp.com / 10203040"
    // The `~` finder is exact-match on name/identifier, so it can't catch
    // this. NSPredicate BEGINSWITH mirrors Android's descriptionStartsWith.
    this.mainError = this.isAndroid
      ? 'android=new UiSelector().descriptionStartsWith("Invalid username or password")'
      : '-ios predicate string:name BEGINSWITH "Invalid username or password"';

    this.usernameFieldError = this.isAndroid
      ? 'android=new UiSelector().description("Please enter your username")'
      : '~Please enter your username';

    this.passwordFieldError = this.isAndroid
      ? 'android=new UiSelector().description("Please enter your password")'
      : '~Please enter your password';

    // iOS: the suffix-icon toggle is an unnamed XCUIElementTypeButton sibling
    // of the SecureTextField. The element has no `name`, `label`, or `value`
    // attributes at all — they're absent, not empty-string. NSPredicate treats
    // missing string attributes as `nil`, so we match `name == nil`. The
    // Login button has name="Login" and every keyboard button has a name
    // (shift / Done / dictation / a-z), so this is unambiguous.
    this.passwordToggle = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.EditText").instance(1).childSelector(new UiSelector().className("android.widget.Button"))'
      : '-ios predicate string:type == "XCUIElementTypeButton" AND name == nil AND visible == 1';
    
    this.logoutBtn = this.isAndroid 
      ? 'android=new UiSelector().className("android.widget.Button").description("Logout")' 
      : '~Logout';

    this.demoCredentials = this.isAndroid
      ? 'android=new UiSelector().description("Demo Credentials")'
      : '~Demo Credentials';

    // Universal Truths (Demo Credentials)
    this.defaultUser = 'emma@demoapp.com';
    this.defaultPass = '10203040';

    // Error message strings (match app accessibility descriptions)
    this.errUsernameRequired = 'Please enter your username';
    this.errPasswordRequired = 'Please enter your password';
    this.errInvalidCreds = 'Invalid username or password';
  }

  async waitForPageLoad() {
    const t0 = Date.now();
    const { width } = await this.driver.getWindowRect();
    if (width > 1200) await this.resetToTop();
    await this.waitForDisplayed(this.title);
    console.log(`[L01] login title visible at +${Date.now() - t0}ms (width=${width})`);
    await this.driver.pause(1000);
  }

  /**
   * Perform logout from the app using adaptive gestures.
   */
  async logout() {
    // SYNC: Wait for UI to settle after potential relaunch (handles splash screen lag)
    const menuBtn = await this.waitForDisplayed(this.navMenuBtn, 20000);
    await menuBtn.click();
    await this.driver.pause(1000);
    
    const { width, height } = await this.driver.getWindowRect();
    const safeDrawerX = Math.round(width * 0.2); 
    
    await this.swipe(safeDrawerX, Math.round(height * 0.8), safeDrawerX, Math.round(height * 0.2), 1000);
    await this.driver.pause(500);

    const logoutEl = await this.driver.$(this.logoutBtn);
    await logoutEl.click();
    await this.waitForDisplayed(this.usernameField);
  }

  async togglePasswordVisibility() {
    const toggle = await this.driver.$(this.passwordToggle);
    await toggle.click();
  }

  /**
   * Universally verifies that the password field is correctly masked.
   * Checks for the bullet character (•) and ensures the item count matches.
   */
  async verifyPasswordMasked(expectedCount) {
    const el = await this.driver.$(this.passwordField);
    const text = this.isAndroid ? await el.getText() : await el.getAttribute('value');
    
    // Verify count and symbol
    const bulletsOnly = text.split('').every(char => char === '•');
    if (text.length !== expectedCount || (expectedCount > 0 && !bulletsOnly)) {
      throw new Error(`Masking verification failed. Expected ${expectedCount} bullets, got "${text}"`);
    }
    return true;
  }

  /**
   * Universally verifies the plaintext content of the password field.
   */
  async verifyPasswordPlaintext(expectedText) {
    const el = await this.driver.$(this.passwordField);
    const text = this.isAndroid ? await el.getText() : await el.getAttribute('value');
    if (text !== expectedText) {
      throw new Error(`Plaintext verification failed. Expected "${expectedText}", got "${text}"`);
    }
    return true;
  }

  /**
   * Universally verifies the content of the username field.
   * Android exposes typed text via getText(); iOS XCUIElementTypeTextField
   * exposes it via the `value` attribute (same pattern used in
   * verifyPasswordMasked / verifyPasswordPlaintext).
   */
  async verifyUsername(expectedText) {
    const el = await this.driver.$(this.usernameField);
    const text = this.isAndroid ? await el.getText() : await el.getAttribute('value');
    if (text !== expectedText) {
      throw new Error(`Username verification failed. Expected "${expectedText}", got "${text}"`);
    }
    return true;
  }

  /**
   * Universal helper to fill out the login form without submitting.
   * Hardened for Keyboard, Toolbar, and Stylus input methods.
   */
  async fillCredentials(username, password) {
    // iOS: setValue() writes directly to the field's accessibility `value`
    // attribute without routing through the keystroke pipeline, so Flutter's
    // TextEditingController never sees the text and Form.validate() reports
    // both fields empty (TC-N02/N03 dumps from run 26088525706 confirm).
    // addValue() types char-by-char through EditableText's keyboard listener,
    // which DOES update the controller. Android uses UiAutomator2's IME
    // injection so setValue is fine there.
    const typeInto = async (el, text) => {
      if (this.isAndroid) {
        await el.setValue(text);
      } else {
        await el.addValue(text);
      }
    };

    if (username !== null) {
      await this.clearField(this.usernameField);
      const userEl = await this.driver.$(this.usernameField);
      await userEl.click(); // Force focus for Stylus/Toolbar
      await typeInto(userEl, username);
    }

    if (password !== null) {
      await this.clearField(this.passwordField);
      const passEl = await this.driver.$(this.passwordField);
      await passEl.click(); // Force focus
      await typeInto(passEl, password);
    }

    const { width } = await this.driver.getWindowRect();
    if (width > 1200) {
      if (username !== null || password !== null) {
        if (this.isAndroid) {
          // Back keyevent routes through Android IME framework — dismisses any
          // input method (keyboard, panel, handwriting) before app navigation.
          await this.driver.execute('mobile: shell', { command: 'input', args: ['keyevent', '4'] });
        } else {
          // iOS iPad: XCUITest keyboard dismiss path. Verify when iPad testing starts.
          try { await this.driver.hideKeyboard(); } catch {}
        }
        await this.driver.pause(1500);
      }
    } else {
      // NEUTRAL CLICK: Click the app title to unfocus and dismiss keyboard universally
      const titleEl = await this.driver.$(this.title);
      await titleEl.click();
      await this.driver.pause(1000);
    }
  }

  /**
   * Fill ONLY the password field while preserving the username.
   */
  async fillPasswordOnly(password) {
    await this.clearField(this.passwordField);
    const passEl = await this.driver.$(this.passwordField);
    await passEl.addValue(password);
    
    // NEUTRAL CLICK: Click the app title to unfocus and dismiss keyboard universally
    const titleEl = await this.driver.$(this.title);
    await titleEl.click();
    await this.driver.pause(1000); 
  }

  /**
   * Powerful cross-platform login engine.
   */
  async submitLogin() {
    const btn = await this.driver.$(this.loginButton);
    await btn.waitForDisplayed({ timeout: 5000 });
    await btn.click();
  }

  async login(username, password) {
    await this.fillCredentials(username, password);
    await this.submitLogin();
  }

  /**
   * Intelligently reveals the Demo Credentials section.
   */
  async revealDemoCredentials() {
    // SMART CHECK: Only scroll if it's actually outside the viewport
    if (!(await this.isInsideViewport(this.demoCredentials))) {
      const { width, height } = await this.driver.getWindowRect();
      const safeX = Math.round(width * 0.3);
      await this.swipe(safeX, Math.round(height * 0.45), safeX, Math.round(height * 0.15), 1500);
      await this.driver.pause(1000);
    }
  }

  async getErrorMessage(type) {
    const selector = type === 'main' ? this.mainError : 
                     type === 'username' ? this.usernameFieldError : 
                     this.passwordFieldError;
    try {
      const el = await this.driver.$(selector);
      await el.waitForDisplayed({ timeout: 8000 });
      return this.isAndroid
        ? await el.getAttribute('content-desc')
        : await el.getAttribute('label');
    } catch (err) {
      return null;
    }
  }
}

module.exports = { LoginPage };
