// @ts-check
const { BasePage } = require('./BasePage');

/**
 * ThankYouPage — POM for the post-Place Order confirmation screen.
 *
 * Per TEST_PLAN's selector notes:
 *   - Title: description "Thank You!"
 *   - Body: description "Your order has been placed successfully.\nYou will
 *     receive a confirmation shortly." (newline-joined two-line desc)
 *   - Continue Shopping: Button — only forward path (no app bar, no Back).
 */
class ThankYouPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    this.title = this.isAndroid
      ? 'android=new UiSelector().description("Thank You!")'
      : '~Thank You!';

    // iOS: body is a multi-line label; `~` is exact-match so use predicate
    // CONTAINS against the first-line phrase.
    this.body = this.isAndroid
      ? 'android=new UiSelector().descriptionContains("order has been placed successfully")'
      : '-ios predicate string:name CONTAINS "order has been placed successfully"';

    this.continueShoppingBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").description("Continue Shopping")'
      : '~Continue Shopping';
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.title, 15000);
  }

  async tapContinueShopping() {
    const btn = await this.driver.$(this.continueShoppingBtn);
    await btn.click();
  }
}

module.exports = { ThankYouPage };
