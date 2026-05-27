// @ts-check
const { BasePage } = require('./BasePage');

/**
 * ReviewOrderPage — POM for the Review Order screen (Checkout step 2).
 *
 * Layout (per TEST_PLAN's selector notes):
 *   - Shipping Address card: content-desc joins fields with `\n`. 4 lines
 *     without Address 2, 5 lines with Address 2. Format:
 *       Full Name\nAddress 1[\nAddress 2]\nCity, State Zip\nCountry
 *   - Order Summary line items: ImageView with content-desc
 *       "<Product>\nQty: <N>\n$<line subtotal>"
 *     Note the field order differs from Cart's "<Product>\n$<total>\n<qty>".
 *   - Total: View with content-desc starting `$` (bottom bar).
 *   - Place Order: Button with desc "Place Order". On long carts the
 *     whole screen wraps in a ScrollView and Place Order falls below the
 *     fold — use UiScrollable.scrollIntoView before tapping.
 */
class ReviewOrderPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    this.title = this.isAndroid
      ? 'android=new UiSelector().description("Review Order")'
      : '~Review Order';

    // Shipping Address card: ImageView whose desc contains the customer's
    // full name's signature (\n-joined). Identified by being a View/ImageView
    // node whose desc has ≥3 `\n` (4-line or 5-line address card).
    // Concrete selector: any View with descriptionContains(",") to match
    // "City, State Zip" line — simpler than over-anchoring.
    // iOS: name-fallback exact-match isn't usable for a multi-line dynamic
    // label; predicate substring against "City, State Zip" comma line.
    this.shippingAddressCard = this.isAndroid
      ? 'android=new UiSelector().descriptionContains(", ")'
      : '-ios predicate string:name CONTAINS ", "';

    // Order Summary line items: View (not ImageView like Cart) with
    // content-desc containing "Qty:". Confirmed against review_dump.xml.
    this.reviewLineItem = this.isAndroid
      ? 'android=new UiSelector().className("android.view.View").descriptionContains("Qty:")'
      : '-ios predicate string:name CONTAINS "Qty:"';

    // Bottom-bar Total — same shape as Cart (View, desc starts with $).
    this.totalValue = this.isAndroid
      ? 'android=new UiSelector().className("android.view.View").descriptionStartsWith("$")'
      : '-ios predicate string:name BEGINSWITH "$"';

    // Place Order — wrap in UiScrollable so it works on long carts where
    // the button falls below the fold.
    this.placeOrderBtn = this.isAndroid
      ? 'android=new UiScrollable(new UiSelector().scrollable(true))' +
        '.scrollIntoView(new UiSelector().className("android.widget.Button").description("Place Order"))'
      : '~Place Order';
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.title);
  }

  /**
   * Read the Shipping Address card's content-desc and split on `\n`.
   * Returns array of address lines (length 4 without Address 2, 5 with).
   */
  async getShippingAddressLines() {
    const el = await this.driver.$(this.shippingAddressCard);
    const desc = await el.getAttribute(this.attrName);
    return (desc || '').split('\n').filter((l) => l.length > 0);
  }

  /**
   * Read all Order Summary line items, parsing each into
   * `{ name, qty, total, raw }`. Format: "<Product>\nQty: <N>\n$<subtotal>"
   */
  async getOrderSummaryLines() {
    const els = await this.driver.$$(this.reviewLineItem);
    const out = [];
    for (const el of els) {
      const desc = await el.getAttribute(this.attrName);
      const parts = (desc || '').split('\n');
      if (parts.length < 3) continue;
      const name = parts[0];
      const qtyMatch = parts[1].match(/(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;
      const total = parseFloat(parts[2].replace(/[^0-9.]/g, ''));
      out.push({ name, qty, total, raw: desc });
    }
    return out;
  }

  /** Review screen's bottom-bar Total. */
  async getTotal() {
    const el = await this.driver.$(this.totalValue);
    const desc = await el.getAttribute(this.attrName);
    return parseFloat((desc || '').replace(/[^0-9.]/g, ''));
  }

  /** Tap Place Order (scrolls into view first on long carts). */
  async tapPlaceOrder() {
    const btn = await this.driver.$(this.placeOrderBtn);
    await btn.click();
  }
}

module.exports = { ReviewOrderPage };
