// @ts-check
const { BasePage } = require('./BasePage');

/**
 * CatalogLandingPage — POM for the marketing-focused Homepage.
 * Universally safe for Phone, Tablet, and iPad.
 */
class CatalogLandingPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);
    
    // Header Selectors
    // The cart icon is an icon-only button with NO name/label on either
    // platform (Flutter Key() reaches Android content-desc but not iOS
    // accessibilityIdentifier, and there's no visible text to fall back to).
    // Both platforms therefore anchor on it positionally: Android = the 2nd
    // header Button; iOS = the only nameless visible button on Landing
    // (verified against TC-C02 diagnostic XML, run 26162857469 — header has
    // "Open navigation menu", the nameless cart, "Shop All", "View All").
    this.cartBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").instance(1)'
      : '-ios predicate string:type == "XCUIElementTypeButton" AND name == nil AND visible == 1';

    // iOS selectors below are verified against diagnostic XML from run
    // 26080595543 — Catalog Landing exposes each element with its visible
    // text as both `name` and `label`. Appium's `~` finder falls back to
    // `name` when accessibilityIdentifier is empty, so multi-line content
    // works the same way it does on Android with `description(...)`.

    // Hero Section (Combined multi-line string from UI dump)
    this.heroBanner = this.isAndroid
      ? 'android=new UiSelector().description("New Collection\nExplore the latest trends in women\'s fashion")'
      : '~New Collection\nExplore the latest trends in women\'s fashion';

    this.shopAllBtn = this.isAndroid
      ? 'android=new UiSelector().description("Shop All")'
      : '~Shop All';

    // Category Headers
    this.sectionHeader = this.isAndroid
      ? 'android=new UiSelector().description("Shop by Category")'
      : '~Shop by Category';

    this.viewAllCategoriesBtn = this.isAndroid
      ? 'android=new UiSelector().description("View All")'
      : '~View All';

    // Category Cards (Exact multi-line strings as buttons)
    this.categoryCasual = this.isAndroid
      ? 'android=new UiSelector().description("Casual\nEveryday comfort & style\n8 items")'
      : '~Casual\nEveryday comfort & style\n8 items';

    this.categoryEvening = this.isAndroid
      ? 'android=new UiSelector().description("Evening\nElegant gowns & formal wear\n8 items")'
      : '~Evening\nElegant gowns & formal wear\n8 items';

    this.categoryParty = this.isAndroid
      ? 'android=new UiSelector().description("Party\nCocktail & party dresses\n8 items")'
      : '~Party\nCocktail & party dresses\n8 items';

    this.categoryBoho = this.isAndroid
      ? 'android=new UiSelector().description("Boho\nFree-spirited & artistic\n8 items")'
      : '~Boho\nFree-spirited & artistic\n8 items';
  }

  async waitForPageLoad() {
    await this.driver.pause(this.settlePause);
    await this.waitForDisplayed(this.shopAllBtn);
  }

  async navigateToShopAll() {
    // Defensive wait before click — on slow CI cold-renders the a11y tree
    // can briefly drop Shop All between waitForPageLoad and this call
    // (observed on run 26009721679 from Cart's buildCartAndEnter replay
    // path: "Shop All not found"). Single-shot $().click() races; explicit
    // waitForDisplayed gives the Flutter bridge time to settle.
    const el = await this.waitForDisplayed(this.shopAllBtn, 15000);
    await el.click();
  }

  async navigateToCart() {
    const el = await this.driver.$(this.cartBtn);
    await el.click();
  }

  async navigateToViewAll() {
    const el = await this.driver.$(this.viewAllCategoriesBtn);
    await el.click();
  }

  /**
   * Select a category by name. 
   * Uses fuzzy matching and robust scroll-to-view logic.
   */
  async selectCategory(name) {
    let selector;
    if (name.includes('Casual')) selector = this.categoryCasual;
    else if (name.includes('Evening')) selector = this.categoryEvening;
    else if (name.includes('Party')) selector = this.categoryParty;
    else selector = this.categoryBoho;
      
    const el = await this.driver.$(selector);
    
    // SMART SCROLL: Only scroll if the card is physically off-screen
    if (!(await el.isDisplayed())) {
        const { width, height } = await this.driver.getWindowRect();
        const safeX = Math.round(width * 0.3);
        await this.swipe(safeX, Math.round(height * 0.8), safeX, Math.round(height * 0.3), 1200);
        await this.driver.pause(this.settlePause);
    }
    
    await el.click();
  }

  /**
   * Intelligently scroll to a specific category banner.
   * Performs a single, fluid 50% swipe if the element is not centered.
   */
  async scrollToCategory(name) {
    let selector;
    if (name.includes('Casual')) selector = this.categoryCasual;
    else if (name.includes('Evening')) selector = this.categoryEvening;
    else if (name.includes('Party')) selector = this.categoryParty;
    else selector = this.categoryBoho;
    
    // SMART FLUID CHECK: If the center of the category is not in the comfort zone, swipe once.
    if (!(await this.isInsideViewport(selector))) {
      const { width, height } = await this.driver.getWindowRect();
      const safeX = Math.round(width * 0.3);
      
      // Fluid 50% Height Swipe (Pulls content UP)
      await this.swipe(safeX, Math.round(height * 0.7), safeX, Math.round(height * 0.2), 1200);
      await this.driver.pause(this.settlePause);
    }
  }
}

module.exports = { CatalogLandingPage };
