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

    // Top tab strip.
    // iOS (run 26330708106 T01 dump): tabs surface with the SAME label as the
    // Android content-desc ("Feed\nTab 1 of 3"), but multi-line — the `~`
    // finder is exact-match and can't match a newline, so use a name-prefix
    // predicate. Selection is encoded by element TYPE, not a `selected` attr
    // (selected = XCUIElementTypeOther, unselected = XCUIElementTypeStaticText)
    // so we match by name only (any type) and read state in isSelected().
    this.feedTab = this.isAndroid
      ? 'android=new UiSelector().description("Feed\nTab 1 of 3")'
      : '-ios predicate string:name BEGINSWITH "Feed"';
    this.searchTab = this.isAndroid
      ? 'android=new UiSelector().description("Search\nTab 2 of 3")'
      : '-ios predicate string:name BEGINSWITH "Search"';
    this.profileTab = this.isAndroid
      ? 'android=new UiSelector().description("Profile\nTab 3 of 3")'
      : '-ios predicate string:name BEGINSWITH "Profile"';

    // Feed pager content (page hint text). iOS name = "Page N of 3\nSwipe left
    // or right" (multi-line) → prefix predicate (T01 dump).
    this.pageHint = (n) => this.isAndroid
      ? `android=new UiSelector().descriptionContains("Page ${n} of 3")`
      : `-ios predicate string:name BEGINSWITH "Page ${n} of 3"`;

    // Search tab body. iOS pattern-guess (mirrors Android text; not yet
    // reached — confirm against the next dump once tab-taps work).
    this.searchBody = this.isAndroid
      ? 'android=new UiSelector().descriptionContains("Search Tab Content")'
      : '-ios predicate string:name CONTAINS "Search Tab Content"';

    // Profile bottom nav buttons. iOS pattern-guess: same "<Name>\nTab N of 3"
    // label as Android; distinct leading word per item (Home/Favorites/
    // Settings) keeps the prefix predicate unambiguous against the top tabs.
    this.bottomHome = this.isAndroid
      ? 'android=new UiSelector().description("Home\nTab 1 of 3")'
      : '-ios predicate string:name BEGINSWITH "Home"';
    this.bottomFavorites = this.isAndroid
      ? 'android=new UiSelector().description("Favorites\nTab 2 of 3")'
      : '-ios predicate string:name BEGINSWITH "Favorites"';
    this.bottomSettings = this.isAndroid
      ? 'android=new UiSelector().description("Settings\nTab 3 of 3")'
      : '-ios predicate string:name BEGINSWITH "Settings"';

    // Profile body section text — pattern "Bottom navigation bar demo\n<Name>
    // Section". iOS pattern-guess (not yet reached).
    this.sectionBody = (name) => this.isAndroid
      ? `android=new UiSelector().descriptionContains("${name} Section")`
      : `-ios predicate string:name CONTAINS "${name} Section"`;
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.screenTitle, 10000);
    await this.waitForDisplayed(this.feedTab, 5000);
  }

  /**
   * Whether a tab / bottom-nav item is selected.
   *   Android — reads the `selected` attribute.
   *   iOS — XCUITest exposes no `selected` attr; the live tree encodes
   *     selection two ways depending on the control:
   *       top tabs   — selected node is XCUIElementTypeOther, unselected
   *                    siblings are XCUIElementTypeStaticText (run 26330708106 T01).
   *       bottom nav — every item is a Button; the selected one carries
   *                    value="1", unselected have no value (run 26331284727 T04).
   */
  async isSelected(selector) {
    const el = await this.driver.$(selector);
    if (this.isAndroid) {
      const v = await el.getAttribute('selected');
      return v === 'true' || v === '1';
    }
    const type = await el.getAttribute('type');
    if (type === 'XCUIElementTypeOther') return true;
    const value = await el.getAttribute('value');
    return value === '1';
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
