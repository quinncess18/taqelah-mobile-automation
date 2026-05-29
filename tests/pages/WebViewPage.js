// @ts-check
const { BasePage } = require('./BasePage');

/**
 * WebViewPage — POM for the in-app WebView browser screen.
 * The WebView loads an external website (https://www.taqelah.sg) inside the app
 * using an embedded android.webkit.WebView widget with a native URL bar and controls.
 */
class WebViewPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    // iOS: Flutter Key()-style ids do NOT reach iOS accessibilityIdentifier, so
    // `~url-input`/`~go-button`/`~webview-container` never resolve. Use the
    // visible-text name-fallback (header "WebView", "Go") and XCUIElement type
    // predicates (the lone TextField; the WKWebView container) instead — same
    // approach as the green Nav/Gestures iOS bring-ups. Verify against the
    // _iosFailureDiagnostic XML before flipping the TEST_PLAN row to ✅.

    // Header
    this.title = this.isAndroid
      ? 'android=new UiSelector().description("WebView")'
      : '~WebView';

    // URL Bar — the only text field on the screen.
    this.urlInput = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.EditText")'
      : '-ios predicate string:type == "XCUIElementTypeTextField"';

    // Go — scope to Button so the soft keyboard's own "Go" return key (also
    // name="Go", surfaces while typing) can't shadow the app's URL-bar button.
    this.goBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").description("Go")'
      : '-ios predicate string:name == "Go" AND type == "XCUIElementTypeButton"';

    // WebView Container — WKWebView surfaces as XCUIElementTypeWebView; its DOM
    // paints into the native tree as static text (see waitForPageContent).
    this.webViewContainer = this.isAndroid
      ? 'android=new UiSelector().className("android.webkit.WebView")'
      : '-ios predicate string:type == "XCUIElementTypeWebView"';

    // Bottom Navigation Bar (browser controls)
    // Note: Bottom buttons are NAF (Not Accessibility Friendly) in the XML dump,
    // so they lack content-desc attributes. Using className + bounds-based
    // instance indexing as a fallback. These are informational only — the spec
    // does not interact with them directly.
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.title);
    await this.driver.pause(this.settlePause);
  }

  /**
   * Returns the current URL text from the URL input field.
   * @returns {Promise<string>}
   */
  async getCurrentUrl() {
    const el = await this.driver.$(this.urlInput);
    if (this.isIOS) {
      // iOS TextField surfaces its content as `value`, not as descendant text;
      // getText() can come back empty. Prefer value, fall back to getText().
      const val = await el.getAttribute('value');
      if (val) return val;
    }
    return await el.getText();
  }

  /**
   * Checks if the WebView container is present and visible on screen.
   * @returns {Promise<boolean>}
   */
  async isWebViewDisplayed() {
    return await this.isVisible(this.webViewContainer);
  }

  /**
   * Navigate back to the previous app screen using the header Back button.
   */
  async goBack() {
    const btn = await this.driver.$(this.backBtn);
    await btn.click();
    await this.driver.pause(this.settlePause);
  }

  /**
   * Clears the URL input field and types a new URL, then presses Go.
   * Caller is responsible for waiting on a page-content signal afterwards
   * (see waitForPageContent) — there is no trailing settle here because
   * the URL bar updates instantly on Go and is not a load-complete signal.
   * @param {string} url - The URL to navigate to (e.g. "https://www.google.com")
   */
  async navigateToUrl(url) {
    await this.clearField(this.urlInput);
    const input = await this.driver.$(this.urlInput);
    // iOS: setValue only sets the a11y value and bypasses the Flutter
    // TextEditingController, so the navigate handler reads an empty URL — use
    // addValue (types through the soft keyboard). Mirrors the Auth/Form path.
    if (this.isIOS) {
      await input.addValue(url);
    } else {
      await input.setValue(url);
    }
    const go = await this.driver.$(this.goBtn);
    await go.click();
  }

  /**
   * Wait for a known piece of rendered page text to appear inside the
   * WebView accessibility tree. This is the only robust native signal
   * that the page has actually painted — pages without a11y nodes
   * (e.g. heavy SPAs) cannot be verified this way without enabling
   * WEBVIEW context (requires app-side WebContentsDebuggingEnabled).
   * @param {string} text - Page text expected after load (e.g. "Example Domain")
   * @param {number} timeout - ms to wait. Default 25s: this gates on a real
   *   network fetch (example.com over the emulator NAT) + WebView paint + the
   *   text landing in the a11y tree, not a local render. The inherited 10s
   *   default was too tight — TC-W02 flaked at 12.8s on a cold/slow run.
   */
  async waitForPageContent(text, timeout = 25000) {
    const selector = this.isAndroid
      ? `android=new UiSelector().text("${text}")`
      : `~${text}`;
    await this.waitForDisplayed(selector, timeout);
  }
}

module.exports = { WebViewPage };
