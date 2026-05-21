// @ts-check
/**
 * BasePage — Foundational Page Object for Taqelah.
 * Encapsulates common driver interactions, waits, and W3C gestures.
 */
class BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    this.driver = driver;

    // Platform Detection
    this.isAndroid = driver.isAndroid;
    this.isIOS = driver.isIOS;

    // Per-device tuning values injected by appFixture
    this.scrollPercent = driver._deviceProfile?.scrollPercent || 0.10;
    this.settlePause = driver._deviceProfile?.settlePause || 800;

    // Shared Header Selectors
    this.title = this.isAndroid
      ? 'android=new UiSelector().description("DemoApp")'
      : '~DemoApp';

    this.navMenuBtn = this.isAndroid
      ? 'android=new UiSelector().description("Open navigation menu")'
      : '~Open navigation menu';

    this.backBtn = this.isAndroid
      ? 'android=new UiSelector().description("Back")'
      : '~Back';

    // App package identifiers — single source of truth for lifecycle operations
    this.appPackage = this.isAndroid ? 'com.taqelah.demo_app' : 'com.taqelah.demoApp';

    // Platform attribute name for reading element descriptions (content-desc
    // on Android, label on iOS). Single source of truth used by all POMs.
    this.attrName = this.isAndroid ? 'content-desc' : 'label';

    // App-global "added to cart" snackbar — fires from Product Detail's
    // Add to Cart button AND from a grid card's direct-add icon. Owned at
    // BasePage so any POM can wait on it without cross-POM reaching.
    this.addedSnackbar = this.isAndroid
      ? 'android=new UiSelector().descriptionContains("added to cart")'
      : '~added-snackbar';
  }

  /**
   * Clear text from an EditText field.
   * Essential for Flutter stability to ensure clean input.
   * @param {string} selector 
   */
  async clearField(selector) {
    const el = await this.driver.$(selector);
    await el.click();
    await el.clearValue();
    await this.driver.pause(500);
  }

  /**
   * Helper to perform a coordinate-based swipe (W3C Actions).
   * @param {number} startX 
   * @param {number} startY 
   * @param {number} endX 
   * @param {number} endY 
   * @param {number} duration
   */
  async swipe(startX, startY, endX, endY, duration = 1200) {
    await this.driver.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: startX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: duration, origin: 'viewport', x: endX, y: endY },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await this.driver.pause(this.settlePause);
  }

  /**
   * Returns true if the element is currently displayed, false otherwise.
   * Safe: never throws.
   * @param {string} selector
   */
  async isVisible(selector) {
    try {
      const el = await this.driver.$(selector);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Intelligently check if an element is within the visible viewport.
   * More reliable than isDisplayed() for Flutter edge elements.
   * @param {string} selector 
   */
  async isInsideViewport(selector) {
    try {
      const el = await this.driver.$(selector);
      if (!(await el.isDisplayed())) return false;

      const { y } = await el.getLocation();
      const { height: elHeight } = await el.getSize();
      const { height: screenHeight } = await this.driver.getWindowRect();

      const elCenterY = y + (elHeight / 2);
      
      // COMFORT ZONE: Center of element must be between 20% and 80% of screen height
      return elCenterY >= (screenHeight * 0.2) && elCenterY <= (screenHeight * 0.8);
    } catch (err) {
      return false;
    }
  }

  /**
   * Wait for an element to be displayed.
   */
  async waitForDisplayed(selector, timeout = 10000) {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout });
    return el;
  }
  /**
   * Universal Reset to Top (Pure Navigation).
   * Returns the screen to the absolute ceiling without nudging.
   */
  async resetToTop(count) {
    const { width, height } = await this.driver.getWindowRect();
    const isTablet = width > 1200;
    const safeX = Math.round(width * 0.3);
    const resetCount = count || (isTablet ? 2 : 1);

    if (!isTablet) {
      for (let i = 0; i < resetCount; i++) {
        await this.driver.performActions([
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: safeX, y: Math.round(height * 0.45) },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration: 400, origin: 'viewport', x: safeX, y: Math.round(height * 0.65) },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ]);
        await this.driver.pause(150);
      }
    } else {
      // TABLET: Hit the absolute ceiling (Power Swipes UP)
      for (let i = 0; i < resetCount; i++) {
        await this.driver.performActions([
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: safeX, y: Math.round(height * 0.25) },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration: 600, origin: 'viewport', x: safeX, y: Math.round(height * 0.9) },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ]);
        await this.driver.pause(200);
      }
    }
    await this.driver.pause(500); 
  }

  /**
   * Performs a hardware 'Back' press.
   */
  async deviceBack() {
    if (this.isAndroid) {
      await this.driver.execute('mobile: shell', { command: 'input', args: ['keyevent', '4'] });
    } else {
      // iOS: prefer the app-bar Back button — it's deterministic and avoids the
      // left-edge drawer-open conflict. Pushed detail pages (Cart, About,
      // Gestures, …) expose a "Back" button (run 26210913562 confirmed it on
      // Cart/About); the flaky edge-swipe was leaving those pages off-Home and
      // breaking the next module's entry. Fall back to a left-edge Cupertino
      // back-swipe only on screens with no Back button (e.g. the catalog grid,
      // which shows a hamburger) — driver.back() does NOT pop Flutter on iOS.
      const backBtn = await this.driver.$(this.backBtn);
      const hasBack = await backBtn.isDisplayed().catch(() => false);
      if (hasBack) {
        await backBtn.click();
      } else {
        const { width, height } = await this.driver.getWindowRect();
        const y = Math.round(height * 0.5);
        await this.swipe(3, y, Math.round(width * 0.6), y, 350);
      }
    }
  }

  /**
   * Performs a hardware 'Home' press (Backgrounds app).
   */
  async deviceHome() {
    if (this.isAndroid) {
      await this.driver.execute('mobile: shell', { command: 'input', args: ['keyevent', '3'] });
    } else {
      // WDIO 8/9 removed the legacy `driver.backgroundApp(n)` method; use the
      // XCUITest mobile extension instead. `seconds: -1` backgrounds the app
      // indefinitely (we re-foreground via `deviceForeground` ourselves).
      await this.driver.execute('mobile: backgroundApp', { seconds: -1 });
    }
  }

  /**
   * Re-activates/Foregrounds the app.
   * @param {boolean} [isDestructive=false] - If true, forces a fresh launch with cleared state.
   */
  async deviceForeground(isDestructive = false) {
    if (this.isAndroid) {
      const intent = `${this.appPackage}/${this.appPackage}.MainActivity`;
      await this.driver.execute('mobile: startActivity', { intent, stop: isDestructive });
      const { width } = await this.driver.getWindowRect();
      if (width > 1200) await this.resetToTop();
    } else {
      await this.driver.activateApp(this.appPackage);
    }
  }

  async killAndRelaunchApp() {
    await this.driver.terminateApp(this.appPackage);
    await this.driver.pause(2000);
    await this.driver.activateApp(this.appPackage);
  }

  /**
   * Wait for the "added to cart" snackbar and return its content-desc text.
   * Caller is responsible for triggering the add (tapping a Detail's Add to
   * Cart button or a grid card's direct-add icon) before calling this.
   */
  async getAddedSnackbarText() {
    const snackbar = await this.waitForDisplayed(this.addedSnackbar, 5000);
    return snackbar.getAttribute(this.attrName);
  }

  /**
   * Pause long enough for the add-to-cart snackbar's auto-dismiss timer to
   * elapse before triggering the next interaction. A fixed pause is used
   * instead of `waitForDisplayed({reverse:true})` because the selector
   * `descriptionContains("added to cart")` matches both an old snackbar AND
   * a replacement one, so the inverse-wait never resolves on back-to-back
   * adds of the same product. Flutter's default SnackBar duration is a
   * wall-clock 4s; the device's `settlePause` is added as a render-lag
   * buffer (800ms locally, 1500ms on CI per workflow env override).
   */
  async waitForSnackbarDismissed() {
    await this.driver.pause(4000 + this.settlePause);
  }

  async samplePixel(x, y) {
    const { PNG } = require('pngjs');
    const base64 = await this.driver.takeScreenshot();
    const png = PNG.sync.read(Buffer.from(base64, 'base64'));
    const idx = (png.width * y + x) * 4;
    return { r: png.data[idx], g: png.data[idx + 1], b: png.data[idx + 2] };
  }
}

module.exports = { BasePage };
