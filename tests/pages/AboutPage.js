// @ts-check
const { BasePage } = require('./BasePage');

/**
 * AboutPage — POM for the information/about screen.
 */
class AboutPage extends BasePage {
  constructor(driver) {
    super(driver);
    // Header
    this.title = this.isAndroid ? 'android=new UiSelector().description("About")' : '~About';

    // iOS: name-fallback on visible text for exact strings; CONTAINS predicate
    // for partial matches (the `~` finder is exact-match only).
    // Above-fold Content
    this.subtitle = this.isAndroid ? 'android=new UiSelector().description("by taqelah! community")' : '~by taqelah! community';
    this.version = this.isAndroid ? 'android=new UiSelector().descriptionContains("Version")' : '-ios predicate string:name CONTAINS "Version"';
    this.description = this.isAndroid ? 'android=new UiSelector().descriptionContains("Master Mobile UI Automation")' : '-ios predicate string:name CONTAINS "Master Mobile UI Automation"';
    this.featureList = this.isAndroid ? 'android=new UiSelector().descriptionContains("What You Can Practice")' : '-ios predicate string:name CONTAINS "What You Can Practice"';

    // Below-fold Content
    this.footerUrl = this.isAndroid ? 'android=new UiSelector().description("www.taqelah.sg")' : '~www.taqelah.sg';
    this.footerFlutter = this.isAndroid ? 'android=new UiSelector().description("Built with Flutter")' : '~Built with Flutter';

    // Settings — iOS Flutter Switch is the only XCUIElementTypeSwitch on About.
    this.darkModeSwitch = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Switch").description("Dark Mode")'
      : '-ios predicate string:type == "XCUIElementTypeSwitch"';
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.title);
  }

  async scrollToBottom() {
    const { width, height } = await this.driver.getWindowRect();
    const safeX = Math.round(width * 0.3);
    await this.swipe(safeX, Math.round(height * 0.7), safeX, Math.round(height * 0.15), 1200);
    await this.driver.pause(1000);
  }

  async toggleDarkMode() {
    const sw = await this.driver.$(this.darkModeSwitch);
    await sw.click();
    await this.driver.pause(500);
  }

  async isDarkModeActive() {
    const sw = await this.driver.$(this.darkModeSwitch);
    // Android Switch exposes `checked`; iOS exposes `value` ("0"/"1").
    const attr = this.isAndroid ? 'checked' : 'value';
    const state = await sw.getAttribute(attr);
    return state === 'true' || state === '1';
  }

  /**
   * Samples a background pixel anchored to the title element's runtime bounds.
   * Samples to the right of the title text within the header bar — reliably background.
   * @returns {{ r: number, g: number, b: number }}
   */
  async sampleThemeColor() {
    const titleEl = await this.driver.$(this.title);
    const loc = await titleEl.getLocation();
    const sz = await titleEl.getSize();
    const { width } = await this.driver.getWindowRect();
    const sampleX = Math.round(loc.x + sz.width + (width - loc.x - sz.width) * 0.5);
    const sampleY = Math.round(loc.y + sz.height * 0.5);
    return await this.samplePixel(sampleX, sampleY);
  }
}

module.exports = { AboutPage };
