// @ts-check
const { BasePage } = require('./BasePage');

/**
 * TabsPage — POM for the "Tabs & Navigation" screen.
 *
 * Surface:
 *  - Top tab strip: Feed (pager), Search (static), Profile (nested bottom nav)
 *  - Feed pager: 3 pages, horizontally swipable, bounded (no overshoot)
 *  - Profile bottom nav: Home / Favorites / Settings, toggles body label
 *
 * Tab + bottom-nav content-descs include an embedded newline
 * (e.g. "Feed\nTab 1 of 3") — preserved verbatim in the UiSelector args.
 */
class TabsPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    // Header
    this.screenTitle = this.isAndroid
      ? 'android=new UiSelector().description("Tabs & Navigation")'
      : '~Tabs & Navigation';

    // Top tab strip
    this.feedTab = this.isAndroid
      ? 'android=new UiSelector().description("Feed\nTab 1 of 3")'
      : '~Feed';
    this.searchTab = this.isAndroid
      ? 'android=new UiSelector().description("Search\nTab 2 of 3")'
      : '~Search';
    this.profileTab = this.isAndroid
      ? 'android=new UiSelector().description("Profile\nTab 3 of 3")'
      : '~Profile';

    // Feed pager content (page hint text)
    this.pageHint = (n) => this.isAndroid
      ? `android=new UiSelector().descriptionContains("Page ${n} of 3")`
      : `~Page ${n} of 3`;

    // Search tab body
    this.searchBody = this.isAndroid
      ? 'android=new UiSelector().descriptionContains("Search Tab Content")'
      : '~search-tab-body';

    // Profile bottom nav buttons
    this.bottomHome = this.isAndroid
      ? 'android=new UiSelector().description("Home\nTab 1 of 3")'
      : '~bottom-home';
    this.bottomFavorites = this.isAndroid
      ? 'android=new UiSelector().description("Favorites\nTab 2 of 3")'
      : '~bottom-favorites';
    this.bottomSettings = this.isAndroid
      ? 'android=new UiSelector().description("Settings\nTab 3 of 3")'
      : '~bottom-settings';

    // Profile body section text — pattern "Bottom navigation bar demo\n<Name> Section"
    this.sectionBody = (name) => this.isAndroid
      ? `android=new UiSelector().descriptionContains("${name} Section")`
      : `~${name.toLowerCase()}-section`;
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.screenTitle, 10000);
    // Title is the universal load anchor. The tab strip is content (T01
    // asserts it). iOS tab selectors are unverified pending the a11y harvest,
    // so gate the strip wait to Android — otherwise iOS beforeAll dies here
    // before any test body runs and the failure-dump fixture never fires.
    if (this.isAndroid) await this.waitForDisplayed(this.feedTab, 5000);
  }

  /**
   * Read the `selected` attribute (true/false) of a selector. Returns a boolean.
   */
  async isSelected(selector) {
    const el = await this.driver.$(selector);
    const v = await el.getAttribute('selected');
    return v === 'true' || v === '1';
  }

  async tapFeedTab() {
    await (await this.driver.$(this.feedTab)).click();
    await this.driver.pause(this.settlePause);
  }

  async tapSearchTab() {
    await (await this.driver.$(this.searchTab)).click();
    await this.driver.pause(this.settlePause);
  }

  async tapProfileTab() {
    await (await this.driver.$(this.profileTab)).click();
    await this.driver.pause(this.settlePause);
  }

  async tapBottomHome() {
    await (await this.driver.$(this.bottomHome)).click();
    await this.driver.pause(this.settlePause);
  }

  async tapBottomFavorites() {
    await (await this.driver.$(this.bottomFavorites)).click();
    await this.driver.pause(this.settlePause);
  }

  async tapBottomSettings() {
    await (await this.driver.$(this.bottomSettings)).click();
    await this.driver.pause(this.settlePause);
  }

  /**
   * Swipe horizontally across the pager content area. dir: 'left' advances
   * to the next page; 'right' returns to the previous page.
   *
   * Vertical band is anchored mid-screen (below the tab strip, above the
   * bottom nav if present) so the gesture lands inside the pager regardless
   * of which tab the swipe is performed on.
   */
  async swipePager(dir) {
    const { width, height } = await this.driver.getWindowRect();
    const y = Math.round(height * 0.55);
    const startX = dir === 'left' ? Math.round(width * 0.85) : Math.round(width * 0.15);
    const endX   = dir === 'left' ? Math.round(width * 0.15) : Math.round(width * 0.85);
    await this.swipe(startX, y, endX, y, 600);
  }
}

module.exports = { TabsPage };
