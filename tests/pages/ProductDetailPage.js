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
   * is a FIXED bottom overlay at y≈707-770 that outlives any reasonable wait
   * (still displayed at 19s, run 26405633023) and won't swipe-dismiss. The
   * swatch row sits at y≈702 (h=36), so its CENTRE (≈720) lands INSIDE the
   * snackbar band — and `.click()` taps the element centre, so the overlay
   * swallows it, the colour never changes, and the two variant adds merge into a
   * single cart line (PD02 fails 2≠1, confirmed in the detail-tree diagnostic
   * XML: swatches at y=702, snackbar at y=707-770, Add to Cart at y=780).
   * A single scroll under-lifted the row (it stopped at 702, still in-band), so
   * scroll the content up in a loop until the swatch CENTRE clears the snackbar
   * TOP — re-reading both rects each pass (geometry-driven, duration-agnostic).
   * No-op on the first select (no snackbar up, swatch already clear).
   */
  async selectColorByInstance(instance) {
    let el = await this.driver.$(this.colorSwatch(instance));
    if (this.isIOS) {
      try {
        const sb = await this.driver.$(this.addedSnackbar);
        if (await sb.isDisplayed()) {
          const { width } = await this.driver.getWindowRect();
          const x = Math.round(width / 2);
          let prevCenter = null;
          for (let pass = 0; pass < 5; pass++) {
            // Re-resolve both rects each pass — the swatch moves with the scroll;
            // the snackbar stays pinned to the bottom.
            const sbEl = await this.driver.$(this.addedSnackbar);
            const sbTop = (await sbEl.getLocation().catch(() => null))?.y ?? 707;
            el = await this.driver.$(this.colorSwatch(instance));
            const loc = await el.getLocation().catch(() => null);
            const size = await el.getSize().catch(() => null);
            const centerY = loc && size ? loc.y + size.height / 2 : null;
            // Clear once the swatch centre is comfortably above the snackbar.
            if (centerY !== null && centerY < sbTop - 20) break;
            // Stop if scrolling no longer moves the row (hit the scroll limit).
            if (centerY !== null && prevCenter !== null && Math.abs(centerY - prevCenter) < 4) break;
            prevCenter = centerY;
            // Drag from above the snackbar (y=640) so it scrolls content, not the overlay.
            await this.swipe(x, 640, x, 300, 500);
            await this.driver.pause(400);
          }
        }
      } catch { /* no snackbar up */ }
      el = await this.driver.$(this.colorSwatch(instance));
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
