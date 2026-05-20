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

    // Header
    this.title = this.isAndroid
      ? 'android=new UiSelector().description("WebView")'
      : '~WebView';

    // URL Bar
    this.urlInput = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.EditText")'
      : '~url-input';

    this.goBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").description("Go")'
      : '~go-button';

    // WebView Container
    this.webViewContainer = this.isAndroid
      ? 'android=new UiSelector().className("android.webkit.WebView")'
      : '~webview-container';

    // Bottom Navigation Bar (browser controls)
    // Note: Bottom buttons are NAF (Not Accessibility Friendly) in the XML dump,
    // so they lack content-desc attributes. Using className + bounds-based
    // instance indexing as a fallback. These are informational only — the spec
    // does not interact with them directly.
    // Button instance order across the full hierarchy:
    //   instance(0) = Back (header), instance(1) = Go (URL bar),
    //   instance(2) = bottom btn 1, instance(3) = bottom btn 2,
    //   instance(4) = bottom btn 3
    this.bottomNavBack = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").instance(2)'
      : '~browser-back';

    this.bottomNavForward = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").instance(3)'
      : '~browser-forward';

    this.bottomNavRefresh = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").instance(4)'
      : '~browser-refresh';
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
    await input.setValue(url);
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
