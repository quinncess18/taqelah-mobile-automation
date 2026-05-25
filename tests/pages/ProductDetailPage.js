// @ts-check
const { BasePage } = require('./BasePage');

/**
 * ProductDetailPage — POM for a single product's detail screen.
 *
 * Reached via tapping a product card on Shop All ("All Dresses") or any
 * Category grid. Verified against `dumps/product_detail.xml` and
 * `dumps/detail_add_toast.xml`.
 *
 * Key Flutter→a11y observations:
 * - App bar exposes only Back + product-name title. No cart icon — badge
 *   verification requires navigating Back to the originating grid.
 * - Color swatches are NAF clickable Views with empty content-desc;
 *   selectable only by clickable-instance order (0, 1, 2).
 * - Add to Cart triggers a Snackbar (not a transient Toast) with
 *   `description="<Product> added to cart"` + an inline `VIEW CART` action.
 */
class ProductDetailPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    // Generic content-desc selector — used for the app-bar product title,
    // the body price view, and any other static text assertion. Back is
    // inherited from BasePage (this.backBtn).
    this.byContentDesc = (text) => this.isAndroid
      ? `android=new UiSelector().description("${text}")`
      : `~${text}`;

    this.colorLabel = this.byContentDesc('Color');

    // Color swatches — 3 NAF clickable Views, empty content-desc.
    // The Color label View is NOT clickable, so filtering by clickable(true)
    // on android.view.View isolates the swatches. Instances 0..2 are the
    // three swatches in left-to-right order.
    // iOS: swatches are 3 nameless XCUIElementTypeOther siblings of the "Color"
    // StaticText (Flutter Key 'color-swatch-N' doesn't reach accessibilityIdentifier,
    // confirmed in the §4 detail diagnostic XML). Anchor on the stable "Color"
    // label via following-sibling — the only Other siblings after it are the swatches.
    this.colorSwatch = (instance) => this.isAndroid
      ? `android=new UiSelector().className("android.view.View").clickable(true).instance(${instance})`
      : `//XCUIElementTypeStaticText[@name="Color"]/following-sibling::XCUIElementTypeOther[${instance + 1}]`;

    this.addToCartBtn = this.byContentDesc('Add to Cart');

    // Snackbar selector + attrName inherited from BasePage (app-global).
  }

  /**
   * Wait for the Product Detail screen to be interactable.
   * Add to Cart is the universal anchor — present in every state.
   *
   * CI Pixel 6 emulator's Flutter cold render is non-deterministically
   * slow on this screen — PD01 passed in 1.8s on run 25917898235 but
   * timed out at 25s on run 25919870295. Image asset hydration + Flutter
   * a11y bridge contention on a hardware-constrained runner pushes the
   * tail latency past 25s. 60s matches Location's defensive headroom
   * for the same CI emulator pattern.
   */
  async waitForPageLoad() {
    await this.waitForDisplayed(this.addToCartBtn, 60000);
  }

  /**
   * Tap one of the 3 color swatches by instance order (0-indexed).
   *
   * iOS: the add-to-cart snackbar — an actionable one with a VIEW CART button —
   * renders at y≈687-770, directly over the swatch row (swatches at y=725), and
   * its duration outlives the fixed dismiss pause. While it's up the swatch
   * reports visible=false and the tap is swallowed, so the color never changes
   * and the two variant adds merge into a single cart line — PD02 fails 2≠1 (run
   * 26400812414, confirmed via the detail-tree diagnostic XML: snackbar visible,
   * all three swatches visible=false underneath). Waiting it out (reverse-wait /
   * fixed pause) proved unreliable, so actively swipe the snackbar down to dismiss
   * it (Material SnackBar default DismissDirection.down) and then gate the tap on
   * the swatch becoming hittable again — duration-agnostic. No-op on the first
   * select (no snackbar up, swatch already displayed).
   */
  async selectColorByInstance(instance) {
    const el = await this.driver.$(this.colorSwatch(instance));
    if (this.isIOS) {
      try {
        const sb = await this.driver.$(this.addedSnackbar);
        if (await sb.isDisplayed()) {
          // The actionable add-to-cart snackbar (VIEW CART) is a long-lived
          // FIXED bottom overlay at y≈687-770; it doesn't reliably swipe-dismiss
          // (run 26402569742: swatch stayed visible=false after a down-swipe).
          // But the swatches live in the SCROLLABLE detail content, so scroll the
          // content up to lift the swatch row clear of the snackbar band, then
          // tap. Start the drag above the snackbar (y=650) so it scrolls content,
          // not the overlay.
          const { width } = await this.driver.getWindowRect();
          const x = Math.round(width / 2);
          await this.swipe(x, 650, x, 330, 600);
        }
      } catch { /* no snackbar up */ }
      // Wait for the swatch to be hittable (uncovered by the scroll, or after the
      // snackbar finally clears) before tapping.
      try { await el.waitForDisplayed({ timeout: 8000 }); } catch { /* tap anyway */ }
    }
    await el.click();
    await this.driver.pause(300);
  }

  /**
   * Tap Add to Cart and wait for the confirmation snackbar.
   * Returns the snackbar's content-desc for assertion. The snackbar wait
   * itself is `getAddedSnackbarText()` inherited from BasePage.
   */
  async addToCart() {
    const btn = await this.driver.$(this.addToCartBtn);
    await btn.click();
    return this.getAddedSnackbarText();
  }
}

module.exports = { ProductDetailPage };
