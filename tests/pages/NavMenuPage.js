// @ts-check
const { BasePage } = require('./BasePage');

/**
 * NavMenuPage — Dedicated POM for the Global Navigation Drawer.
 * Handles routing, settings toggles, and user context.
 */
class NavMenuPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    // Structural Selectors
    this.menuDrawer = this.isAndroid 
      ? 'android=new UiSelector().className("android.widget.ScrollView")' 
      : '~nav-drawer';

    // iOS: drawer items are Flutter Key()-less — Appium's `~` finder falls back
    // to the visible-text `name`, so each `~<text>` mirrors the Android
    // description (proven by LoginPage.logout()'s `~Logout` on iOS smoke).
    // Account Section
    this.userProfile = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.ImageView").descriptionContains("@")'
      : '-ios predicate string:name CONTAINS "@"';

    this.logoutBtn = this.isAndroid
      ? 'android=new UiSelector().description("Logout")'
      : '~Logout';

    // Main Navigation
    this.navHome = this.isAndroid ? 'android=new UiSelector().description("Home")' : '~Home';
    this.navCart = this.isAndroid ? 'android=new UiSelector().description("Cart")' : '~Cart';
    this.navAbout = this.isAndroid ? 'android=new UiSelector().description("About")' : '~About';

    // Settings — iOS Flutter Switch surfaces as the only XCUIElementTypeSwitch
    // on the drawer; isDarkModeActive() reads its `value` ("0"/"1").
    this.darkModeToggle = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Switch").description("Dark Mode")'
      : '-ios predicate string:type == "XCUIElementTypeSwitch"';

    // Test Suite (Test Screens)
    this.navGestures = this.isAndroid ? 'android=new UiSelector().description("Gestures")' : '~Gestures';
    this.navWebView = this.isAndroid ? 'android=new UiSelector().description("WebView")' : '~WebView';
    this.navDialogs = this.isAndroid ? 'android=new UiSelector().description("Dialogs & Alerts")' : '~Dialogs & Alerts';
    this.navForm = this.isAndroid ? 'android=new UiSelector().description("Form Validation")' : '~Form Validation';
    this.navPermissions = this.isAndroid ? 'android=new UiSelector().description("Permissions")' : '~Permissions';
    this.navNotifications = this.isAndroid ? 'android=new UiSelector().description("Notifications")' : '~Notifications';
    this.navTabs = this.isAndroid ? 'android=new UiSelector().description("Tabs & Navigation")' : '~Tabs & Navigation';
    this.navCamera = this.isAndroid ? 'android=new UiSelector().description("Camera")' : '~Camera';
    this.navLocation = this.isAndroid ? 'android=new UiSelector().description("Location")' : '~Location';

    // Headers / Non-clickable
    this.testScreensHeader = this.isAndroid
      ? 'android=new UiSelector().description("TEST SCREENS")'
      : '~TEST SCREENS';

  }

  async open() {
    const btn = await this.waitForDisplayed(this.navMenuBtn, 15000);
    await btn.click();
    await this.waitForPageLoad();
  }

  /**
   * Helper to wait for the drawer to be fully animated and visible.
   */
  async waitForPageLoad() {
    await this.driver.pause(800); // Standard drawer animation time
    await this.waitForDisplayed(this.navHome);
  }

  /**
   * Universal scroll within the drawer to find a specific link.
   * Uses a smaller swipe depth to avoid overshooting in the narrow drawer.
   */
  async scrollToItem(selector) {
    const el = await this.driver.$(selector);
    let scrollCount = 0;
    while (!(await el.isDisplayed()) && scrollCount < 5) {
      const { width, height } = await this.driver.getWindowRect();
      // Tablet sidebar is narrower relative to screen — use a smaller fraction to stay inside the drawer
      const isTablet = width > 1200;
      const safeX = Math.round(width * (isTablet ? 0.15 : 0.3));
      await this.swipe(safeX, Math.round(height * 0.7), safeX, Math.round(height * 0.3), 800);
      scrollCount++;
    }
  }

  /**
   * Perform navigation to a specific module.
   * Auto-scrolls if the item is below the fold (e.g. Logout, Location).
   */
  async navigateTo(selector) {
    await this.scrollToItem(selector);
    const btn = await this.driver.$(selector);
    await btn.click();
  }

  /**
   * Returns the current theme status (checked/unchecked).
   * Ternary-safe for both Android and iOS attributes.
   */
  async isDarkModeActive() {
    const toggle = await this.driver.$(this.darkModeToggle);
    const attr = this.isAndroid ? 'checked' : 'value';
    const state = await toggle.getAttribute(attr);
    return state === 'true' || state === '1';
  }
}

module.exports = { NavMenuPage };
