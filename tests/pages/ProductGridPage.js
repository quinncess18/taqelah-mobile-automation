// @ts-check
const { BasePage } = require('./BasePage');

/**
 * ProductGridPage — POM for the "All Dresses" search and listing screen.
 * Universally safe for Phone, Tablet, and iPad.
 */
class ProductGridPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);
    
    // Header Selectors
    this.gridTitle = (name) => this.isAndroid 
      ? `android=new UiSelector().description("${name}")` 
      : `~${name}`;
    
    // iOS app-bar action icons (Sort, Cart) are nameless buttons — Flutter
    // Key() ('sort-button'/'cart-icon') does not reach accessibilityIdentifier.
    // The Landing "only nameless visible button" predicate fails on the grid
    // because the grid ALSO exposes nameless per-card add-to-cart buttons, so
    // these two are disambiguated positionally in _iosAppBarActionBtn()
    // (leftmost = Sort, rightmost = Cart — matches the Android instance order).
    // This shared predicate is that helper's base query; openSortMenu() /
    // navigateToCart() resolve through the helper, not the raw string.
    // Verified against TC-C05/C06 iOS diagnostic XML, run 26166346519.
    this.iosNamelessBtn =
      '-ios predicate string:type == "XCUIElementTypeButton" AND name == nil AND visible == 1';

    this.sortBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").instance(1)'
      : this.iosNamelessBtn;

    this.cartBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").instance(2)'
      : this.iosNamelessBtn;

    // Cart badge — small View overlaying the cart icon, content-desc = count
    // when items > 0; node is absent when cart is empty. The only numeric-only
    // content-desc on the Shop All / Category grids is the badge, so the regex
    // resolves it uniquely. Verified against `dumps/shop_all_with_badge.xml`.
    this.cartBadge = this.isAndroid
      ? 'android=new UiSelector().className("android.view.View").descriptionMatches("^[0-9]+$")'
      : '~cart-badge';
    
    // Search & Metadata
    this.searchInput = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.EditText")'
      : '~Search dresses...';

    this.resultCount = this.isAndroid
      ? 'android=new UiSelector().descriptionContains("Showing")'
      : '-ios predicate string:type == "XCUIElementTypeStaticText" AND name BEGINSWITH "Showing"';
    
    // Grid Elements — iOS product cards are Images whose name/label is the
    // multi-line "<name>\n$<price>". Match on the name prefix (Key()
    // 'product-<slug>' doesn't reach accessibilityIdentifier). `~` is
    // exact-match, so a BEGINSWITH predicate is required for the prefix.
    this.productCard = (name) => this.isAndroid
      ? `android=new UiSelector().className("android.widget.ImageView").descriptionContains("${name}")`
      : `-ios predicate string:type == "XCUIElementTypeImage" AND name BEGINSWITH "${name}"`;

    // Per-card add-to-cart buttons are nameless on iOS (Key() 'add-to-cart'
    // lost). NOTE: not yet positionally resolved for iOS — §4 (the only
    // consumer) is Android-only today; convert from an item-present iOS dump
    // when §4 is ported to the iOS lane.
    this.addToCartBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button")'
      : this.iosNamelessBtn;

    // Universal Item Selector for Audits — every product card carries a price,
    // so "$" in the name uniquely identifies product Images on iOS.
    this.clickableItems = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.ImageView").clickable(true)'
      : '-ios class chain:**/XCUIElementTypeImage[`name CONTAINS "$"`]';

    // Sort Menu Selectors
    this.sortTitle = this.isAndroid ? 'android=new UiSelector().description("Sort By")' : '~Sort By';
    this.sortOptionAZ = this.isAndroid ? 'android=new UiSelector().description("Name (A-Z)")' : '~Name (A-Z)';
    this.sortOptionZA = this.isAndroid ? 'android=new UiSelector().description("Name (Z-A)")' : '~Name (Z-A)';
    this.sortOptionPriceLowHigh = this.isAndroid ? 'android=new UiSelector().description("Price (Low-High)")' : '~Price (Low-High)';
    this.sortOptionPriceHighLow = this.isAndroid ? 'android=new UiSelector().description("Price (High-Low)")' : '~Price (High-Low)';

    // First visible product card (instance 0) — iOS: first product Image in
    // document order (= top-left card). Recomputed per call so it tracks the
    // current sort order.
    this.firstProductCard = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.ImageView").clickable(true).instance(0)'
      : '-ios class chain:**/XCUIElementTypeImage[`name CONTAINS "$"`][1]';

    // attrName inherited from BasePage.
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.resultCount, 20000);
  }

  /**
   * iOS only: resolve a grid app-bar action button by position. Both the Sort
   * and Cart icons are nameless (Flutter Key() lost), and the Landing
   * single-nameless-button trick fails here because the grid also exposes
   * nameless per-card add-to-cart buttons. Filter the nameless visible buttons
   * to the top app-bar band (the app bar never scrolls, so per-card buttons —
   * which start well below — are excluded), then order by x: leftmost = Sort,
   * rightmost = Cart (matches Android instance(1)=sort, instance(2)=cart).
   * Selector-based discovery + geometric disambiguation; no hardcoded tap
   * coords. Verified against TC-C05/C06 iOS diagnostic XML, run 26166346519.
   * @param {'sort'|'cart'} which
   */
  async _iosAppBarActionBtn(which) {
    const APP_BAR_BAND = 120; // app-bar height; per-card buttons sit far below
    const btns = await this.driver.$$(this.iosNamelessBtn);
    const inBar = [];
    for (const el of btns) {
      const loc = await el.getLocation();
      if (loc.y < APP_BAR_BAND) inBar.push({ el, x: loc.x });
    }
    inBar.sort((a, b) => a.x - b.x);
    if (inBar.length === 0) {
      throw new Error(`iOS grid app-bar ${which} button not found`);
    }
    return which === 'cart' ? inBar[inBar.length - 1].el : inBar[0].el;
  }

  /**
   * Open the sort selection menu
   */
  async openSortMenu() {
    const btn = this.isIOS
      ? await this._iosAppBarActionBtn('sort')
      : await this.driver.$(this.sortBtn);
    await btn.click();
    await this.waitForDisplayed(this.sortTitle);
  }

  /**
   * Select a sorting option. 
   */
  async selectSort(type) {
    const selector = type === 'AZ' ? this.sortOptionAZ :
                     type === 'ZA' ? this.sortOptionZA :
                     type === 'LowHigh' ? this.sortOptionPriceLowHigh :
                     this.sortOptionPriceHighLow;
    
    const option = await this.driver.$(selector);
    await option.click();
    await this.driver.pause(this.settlePause);
  }

  /**
   * Type a keyword into the grid's search bar. The grid filters in-place
   * as the user types (no submit button on the EditText). Keyboard is
   * dismissed after the input to avoid Flutter a11y-tree narrowing — the
   * same defense the Form Validation module applies.
   */
  async searchProducts(keyword) {
    const input = await this.driver.$(this.searchInput);
    await input.click();
    await input.clearValue();
    await input.addValue(keyword);
    if (this.isAndroid) {
      try { await this.driver.hideKeyboard(); } catch {}
    }
    await this.driver.pause(this.settlePause);
  }

  /**
   * Clear the search bar in place — leaves the grid on its current
   * category with all items visible again. Useful when chaining off a
   * prior search state (e.g. §15 starts on Boho with the §13 "shorts"
   * search still active).
   */
  async clearSearch() {
    const input = await this.driver.$(this.searchInput);
    await input.click();
    await input.clearValue();
    if (this.isAndroid) {
      try { await this.driver.hideKeyboard(); } catch {}
    }
    await this.driver.pause(this.settlePause);
  }

  async nudgeToRevealFirstItem() {
    const { width, height } = await this.driver.getWindowRect();
    const isTablet = width > 1200;
    if (!isTablet) return;

    const safeX = Math.round(width * 0.3);
    await this.swipe(safeX, Math.round(height * 0.75), safeX, Math.round(height * 0.1), 600);
    await this.driver.pause(this.settlePause);
  }

  async navigateToCart() {
    const btn = this.isIOS
      ? await this._iosAppBarActionBtn('cart')
      : await this.driver.$(this.cartBtn);
    await btn.click();
  }

  /**
   * Read the cart badge count. Returns 0 if the badge node is absent
   * (cart empty), otherwise the integer parsed from the badge's content-desc.
   */
  async getCartBadgeCount() {
    const badge = await this.driver.$(this.cartBadge);
    if (!(await badge.isDisplayed().catch(() => false))) return 0;
    const text = await badge.getAttribute(this.attrName);
    return parseInt(text, 10);
  }

  /**
   * Get attributes of the first visual product in the grid.
   *
   * iOS: a positional class-chain (`...Image[...]​[1]`) + waitForDisplayed
   * proved unreliable — WDA returns the indexed node but reports it
   * not-displayed even when the source XML has visible="true" (TC-C03/C05/C07,
   * run 26198456906). The same predicate via $$ resolves the cards correctly
   * (C04 passes on it), so iterate the $$ result and return the first visible
   * priced card in document order (= top-left). Android keeps the positional
   * selector path it already passes on.
   */
  async getFirstProductDetails() {
    if (this.isIOS) {
      const cards = await this.driver.$$(this.clickableItems);
      for (const c of cards) {
        if (!(await c.isDisplayed().catch(() => false))) continue;
        const desc = await c.getAttribute(this.attrName);
        if (desc && desc.includes('$')) return desc;
      }
      throw new Error('iOS: no visible priced product card found in grid');
    }
    const firstProduct = await this.driver.$(this.firstProductCard);
    await firstProduct.waitForDisplayed({ timeout: 5000 });
    return await firstProduct.getAttribute(this.attrName);
  }

  /**
   * Pick a random visible product card from the current grid.
   * Returns `{ el, name, price }`. Caller is responsible for the tap.
   * Logs the choice for failure-mode traceability.
   */
  async pickRandomProduct() {
    const cards = await this.driver.$$(this.clickableItems);
    const candidates = [];
    for (const c of cards) {
      const desc = await c.getAttribute(this.attrName);
      if (!desc || !desc.includes('$')) continue;
      // iOS exposes off-screen cards as ghost Images (visible=false at 0,0);
      // clicking one taps (0,0) and never routes to Detail. Keep on-screen only.
      if (this.isIOS && !(await c.isDisplayed().catch(() => false))) continue;
      candidates.push({ el: c, desc });
    }
    if (candidates.length === 0) throw new Error('No product cards found on grid');
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const [name, price] = pick.desc.split('\n');
    return { el: pick.el, name, price };
  }

  /**
   * Pick a random product whose direct-add NAF button is currently rendered.
   *
   * Partial cards at the bottom of the viewport render the card ImageView but
   * NOT the add-to-cart Button child (Flutter only lays out fully-visible
   * children). This helper filters those out so the caller can tap the
   * returned `addBtn` without scroll choreography.
   */
  async pickRandomProductDirectAdd() {
    const cards = await this.driver.$$(this.clickableItems);
    const candidates = [];
    for (const c of cards) {
      const desc = await c.getAttribute(this.attrName);
      if (!desc || !desc.includes('$')) continue;
      const btn = await c.$('android=new UiSelector().className("android.widget.Button")');
      if (!(await btn.isDisplayed().catch(() => false))) continue;
      candidates.push({ el: c, desc, addBtn: btn });
    }
    if (candidates.length === 0) throw new Error('No fully-rendered product cards with add button found');
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const [name, price] = pick.desc.split('\n');
    return { addBtn: pick.addBtn, name, price };
  }

  /**
   * Return the names of every currently-rendered product card whose
   * direct-add button is in the a11y tree. Caller iterates by name and
   * re-resolves each card freshly (refs go stale after each add+snackbar).
   */
  async getVisibleProductNames() {
    const cards = await this.driver.$$(this.clickableItems);
    const names = [];
    for (const c of cards) {
      const desc = await c.getAttribute(this.attrName);
      if (!desc || !desc.includes('$')) continue;
      const btn = await c.$('android=new UiSelector().className("android.widget.Button")');
      if (!(await btn.isDisplayed().catch(() => false))) continue;
      names.push(desc.split('\n')[0]);
    }
    return names;
  }

  /**
   * Tap the direct-add NAF button on a specific product card by name.
   * Resolves the card fresh each call so it survives grid re-renders.
   */
  async tapDirectAddByName(name) {
    const escaped = name.replace(/"/g, '\\"');
    const cardSelector = this.isAndroid
      ? `android=new UiSelector().className("android.widget.ImageView").descriptionContains("${escaped}")`
      : `~card-${name}`;
    const card = await this.driver.$(cardSelector);
    const addBtn = await card.$('android=new UiSelector().className("android.widget.Button")');
    await addBtn.click();
  }

  /**
   * Perform a data-driven integrity audit of a specific category.
   * Matches exactly against the provided product list (Names and Prices).
   * @param {Object} categoryData - From products.js
   */
  async verifyCategoryIntegrity(categoryData) {
    let collectedNames = new Set();
    let scrollCount = 0;
    const maxFlicks = 10;
    const totalGoal = categoryData.count;

    const { width, height } = await this.driver.getWindowRect();
    const isTablet = width > 1200;
    const safeX = Math.round(width * 0.3);

    while (scrollCount < maxFlicks) {
      const items = await this.driver.$$(this.clickableItems);
      
      for (const item of items) {
        const desc = await item.getAttribute(this.attrName);
        if (desc && desc.includes('$')) {
          const [name, price] = desc.split('\n');
          
          const expectedProduct = categoryData.products.find(p => p.name === name);
          if (expectedProduct) {
            if (expectedProduct.price !== price) {
              throw new Error(`Data Mismatch: Product "${name}" expected price ${expectedProduct.price}, got ${price}`);
            }
            collectedNames.add(name);
          }
        }
      }

      if (collectedNames.size >= totalGoal) break;

      // Safe Middle-Slice Flick
      await this.swipe(safeX, Math.round(height * 0.75), safeX, Math.round(height * 0.25), 1000);
      scrollCount++;
      await this.driver.pause(this.settlePause);
    }

    // FINAL ANCHOR TUG: Force the absolute bottom edge into view
    // Tablets need two tugs to clear their tall cards; Mobile only needs one.
    const settleCount = isTablet ? 2 : 1;
    
    for (let i = 0; i < settleCount; i++) {
      await this.driver.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: safeX, y: Math.round(height * 0.8) },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 10, x: safeX, y: Math.round(height * 0.8) - 20 },
            { type: 'pointerMove', duration: 1000, origin: 'viewport', x: safeX, y: Math.round(height * 0.08) },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ]);
      await this.driver.pause(this.settlePause);
    }

    // Final audit pass at the bottom
    const finalItems = await this.driver.$$(this.clickableItems);
    for (const item of finalItems) {
      const desc = await item.getAttribute(this.attrName);
      if (desc && desc.includes('$')) {
        const name = desc.split('\n')[0];
        if (categoryData.products.some(p => p.name === name)) {
          collectedNames.add(name);
        }
      }
    }

    return collectedNames.size === totalGoal;
  }

  /**
   * Perform a high-speed 'Flick & Verify' check of the entire catalog.
   * Mandates visual verification of every card (Image, Name, Price).
   */
  async verifyFullCatalogIntegrity() {
    // Reset to top so Playwright retries don't start mid-scroll (beforeAll
    // doesn't re-run on retry, so a failed attempt leaves the grid scrolled
    // and subsequent attempts can only ever see the bottom rows).
    await this.resetToTop(1);

    let collectedItems = new Set();
    let scrollCount = 0;
    // 2026-05-17: switched from fast full-viewport flicks to slower half-
    // viewport scrolls. CI run 25980717553 showed the previous fast flicks
    // racing the Flutter a11y bridge — rows entered and exited the viewport
    // between scroll and scan, so 4/32 items were never captured (different
    // items each run, confirming non-determinism). With half-viewport scrolls
    // every row stays in the viewport across two scroll positions, so each
    // item gets two chances to enter the a11y tree. Slower swipe duration
    // (1000 → 1500ms) gives the bridge time to update before the next scan.
    const maxFlicks = 80;
    const totalGoal = 32;

    const { width, height } = await this.driver.getWindowRect();
    const isTablet = width > 1200;
    const safeX = Math.round(width * 0.3);
    const swipeDepth = isTablet ? 0.375 : 0.275;
    const swipeDuration = 1500;

    // CI-only diagnostic dump every 5 flicks — TC-C04 keeps regressing on the
    // GHA runner (commit 35c65e8 hit it again with 3 retries). Local doesn't
    // write these.
    const ciDiag = process.env.CI ? require('fs') : null;
    const ciStamp = Date.now();
    const dumpCatalog = (label) => {
      if (!ciDiag) return;
      try {
        const path = require('path');
        const dir = path.join(process.cwd(), 'test-results', 'diagnostics');
        ciDiag.mkdirSync(dir, { recursive: true });
        this.driver.takeScreenshot().then(b64 => {
          ciDiag.writeFileSync(path.join(dir, `catalog-${ciStamp}-${label}.png`), Buffer.from(b64, 'base64'));
        }).catch(() => {});
        ciDiag.writeFileSync(path.join(dir, `catalog-${ciStamp}-${label}.json`), JSON.stringify({
          collectedCount: collectedItems.size,
          totalGoal,
          scrollCount,
          collectedNames: Array.from(collectedItems),
          screenWidth: width, screenHeight: height,
        }, null, 2));
      } catch {}
    };

    while (collectedItems.size < totalGoal && scrollCount < maxFlicks) {
      const items = await this.driver.$$(this.clickableItems);
      for (const item of items) {
        const desc = await item.getAttribute(this.attrName);
        if (desc && desc.includes('$')) {
          collectedItems.add(desc.split('\n')[0]);
        }
      }

      if (scrollCount % 5 === 0) {
        dumpCatalog(`flick${String(scrollCount).padStart(2, '0')}`);
      }

      if (collectedItems.size >= totalGoal) {
        break;
      }

      await this.driver.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: safeX, y: Math.round(height * 0.8) },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 10, x: safeX, y: Math.round(height * 0.8) - 20 },
            { type: 'pointerMove', duration: swipeDuration, origin: 'viewport', x: safeX, y: Math.round(height * (0.8 - swipeDepth)) },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ]);
      scrollCount++;
      // Extended settle (1.5x) so the Flutter a11y bridge can update
      // between the scroll landing and the next scan iteration.
      await this.driver.pause(Math.round(this.settlePause * 1.5));
    }

    // MANDATORY POWER-TUG SETTLE: Force the absolute bottom row into focus
    const settleCount = isTablet ? 2 : 1;
    for (let i = 0; i < settleCount; i++) {
      await this.driver.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: safeX, y: Math.round(height * 0.8) },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerMove', duration: 10, x: safeX, y: Math.round(height * 0.8) - 20 },
            { type: 'pointerMove', duration: 1000, origin: 'viewport', x: safeX, y: Math.round(height * 0.08) },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ]);
      await this.driver.pause(this.settlePause);
    }

    // Extra settle before final scan — on CI's render-lagged emulator the
    // bottom row sometimes isn't queryable on the immediate post-tug frame.
    await this.driver.pause(this.settlePause * 2);

    // Final visual scan at the absolute bottom
    const finalItems = await this.driver.$$(this.clickableItems);
    for (const item of finalItems) {
      const desc = await item.getAttribute(this.attrName);
      if (desc && desc.includes('$')) {
        collectedItems.add(desc.split('\n')[0]);
      }
    }

    dumpCatalog('final');

    if (collectedItems.size < totalGoal) {
      // Failure-path diagnostic: name exactly which catalog items the scan
      // never surfaced (fires only when C04 is about to fail).
      const data = require('../data/products');
      const expected = Object.values(data.categories).flatMap(c => c.products.map(p => p.name));
      const missing = expected.filter(n => !collectedItems.has(n));
      console.log(`[C04] FINAL ${collectedItems.size}/${totalGoal} — missing: [${missing.join(', ')}]`);
    }

    return collectedItems.size >= totalGoal;
  }
}

module.exports = { ProductGridPage };
