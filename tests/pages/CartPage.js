// @ts-check
const { BasePage } = require('./BasePage');

/**
 * CartPage — POM for the Shopping Cart screen.
 *
 * Line item structure (verified from test-results/cart_dump.xml, 2026-05-18):
 *   ImageView with content-desc = "<Product>\n$<line total>\n<qty>".
 *   Within each line: 3 Button children, left-to-right [Minus, Plus, Delete].
 *   Minus is enabled=false, clickable=false at qty=1.
 *   Plus/Delete are NAF (no content-desc) — positional only.
 *
 * Color-variant lines from §12 PD02 share IDENTICAL content-desc. Per-line
 * buttons therefore can't be addressed via UiSelector childSelector alone
 * (instance disambiguation gets tangled with disabled-Minus indexing). We
 * resolve via the line ImageView's bounds: each button sits at fixed
 * relative offsets within the line (29% / 52% / 89% across, 67% down).
 * Bounds are read from the live element — no hardcoded screen coords.
 *
 * The cart body is wrapped in an android.widget.ScrollView. Compose
 * virtualises off-screen rows, so on a phone-height viewport only ~6 of 7
 * lines are in the a11y tree at scroll-top. `collectAllLines()` swipes the
 * ScrollView and stitches snapshots so Σ(line.total) can be verified
 * against the bottom-bar cart Total.
 */
class CartPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    this.cartTitle = this.isAndroid
      ? 'android=new UiSelector().description("My Cart")'
      : '~My Cart';

    // iOS: Flutter Key() ('empty-cart-message') doesn't reach
    // accessibilityIdentifier; fall back to the visible text (same label
    // Android matches via content-desc).
    this.emptyCartMsg = this.isAndroid
      ? 'android=new UiSelector().description("Your cart is empty")'
      : '~Your cart is empty';

    this.continueShoppingBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").description("Continue Shopping")'
      : '~Continue Shopping';

    // Line items: ImageView with content-desc containing `$` (the total label
    // is a View, not an ImageView, so this isolates lines cleanly). iOS mirrors
    // this: each line is an XCUIElementTypeImage named "<product>\n$<total>\n<qty>"
    // (Flutter Key 'cart-line-item' doesn't reach accessibilityIdentifier;
    // confirmed in the §4 cart diagnostic XML). Line totals live in the Images;
    // the page Total is a StaticText, so the Image+"$" filter isolates lines.
    this.lineItem = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.ImageView").descriptionContains("$")'
      : '-ios predicate string:type == "XCUIElementTypeImage" AND name CONTAINS "$"';

    // Total value: View with content-desc like "$914.93". Line totals live
    // inside ImageView nodes, so className=View + descriptionStartsWith("$")
    // resolves uniquely. (descriptionMatches with regex anchors flaked under
    // the UiSelector → Java regex bridge — startsWith avoids the escape
    // hazard entirely.)
    // iOS: the page Total is the only StaticText beginning with "$" (line totals
    // surface inside Images, not StaticTexts); confirmed in the cart XML.
    this.totalValue = this.isAndroid
      ? 'android=new UiSelector().className("android.view.View").descriptionStartsWith("$")'
      : '-ios predicate string:type == "XCUIElementTypeStaticText" AND name BEGINSWITH "$"';

    this.proceedToCheckoutBtn = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.Button").description("Proceed to Checkout")'
      : '~Proceed to Checkout';

    // ScrollView bounds — phone Pixel 8: [0,279][1080,2085]. Used as a
    // safety window for swipe coordinates so we don't accidentally swipe
    // the status bar or bottom bar.
    this._cartScroll = this.isAndroid
      ? 'android=new UiSelector().className("android.widget.ScrollView").scrollable(true)'
      : '~cart-scroll';
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.cartTitle);
  }

  async clickContinueShopping() {
    const btn = await this.driver.$(this.continueShoppingBtn);
    await btn.click();
  }

  // ─── Line readers ────────────────────────────────────────────────

  /**
   * Cart-line elements in TOP-TO-BOTTOM screen order, with iOS virtualization
   * ghosts (zero-size XCUIElementTypeImage nodes that Compose leaves in the
   * tree for off-screen rows) filtered out.
   *
   * Without this projection, iOS `getLine(N)` (raw tree) and `_lineButtons(N)`
   * (visible-only) targeted different lines: the raw tree lists ghosts FIRST
   * in DOM order, so `getLine(0)` returned a virtualized-off-screen ghost
   * while `_lineButtons(0)` returned buttons for the topmost visible line.
   * `tapPlus(0)` then clicked one line and polled qty on another (run
   * 26436020137 TC-S02 — Plus tapped Denim 1→2, waitUntil polled a Boho ghost
   * stuck at 1).
   */
  async _orderedLineElements() {
    const raw = await this.driver.$$(this.lineItem);
    if (this.isAndroid) return raw;
    const withY = [];
    for (const el of raw) {
      const sz = await el.getSize();
      if (sz.width === 0 || sz.height === 0) continue; // virtualized ghost
      const loc = await el.getLocation();
      withY.push({ el, y: loc.y });
    }
    withY.sort((a, b) => a.y - b.y);
    return withY.map(v => v.el);
  }

  /** Count of line items currently visible in the cart viewport. */
  async getLineCount() {
    const lines = await this._orderedLineElements();
    return lines.length;
  }

  _parseDesc(desc) {
    const parts = (desc || '').split('\n');
    if (parts.length < 3) {
      throw new Error(`malformed line desc "${desc}"`);
    }
    const total = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
    const qty = parseInt(parts[2], 10);
    return { name: parts[0], totalText: parts[1], total, qty, raw: desc };
  }

  _parseBounds(bounds) {
    // Format: "[x1,y1][x2,y2]"
    const m = (bounds || '').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!m) throw new Error(`malformed bounds "${bounds}"`);
    return {
      x1: parseInt(m[1], 10),
      y1: parseInt(m[2], 10),
      x2: parseInt(m[3], 10),
      y2: parseInt(m[4], 10),
    };
  }

  async getLine(index) {
    const lines = await this._orderedLineElements();
    if (index >= lines.length) {
      throw new Error(`getLine(${index}) — only ${lines.length} lines present`);
    }
    const desc = await lines[index].getAttribute(this.attrName);
    return this._parseDesc(desc);
  }

  // ─── Scroll + collect ────────────────────────────────────────────

  /** Vertical [y1, y2] screen span of a line element, cross-platform. */
  async _lineYRange(el) {
    if (this.isAndroid) {
      const b = this._parseBounds(await el.getAttribute('bounds'));
      return [b.y1, b.y2];
    }
    const loc = await el.getLocation();
    const size = await el.getSize();
    return [Math.round(loc.y), Math.round(loc.y + size.height)];
  }

  /**
   * Read the currently-visible cart lines, ordered by SCREEN POSITION.
   *
   * Identifying lines by their text desc alone is unsafe: two color variants of
   * the same product render an identical desc ("<Name>\n$<price>\n<qty>" — color
   * is not in the a11y text), and under CI render-lag the a11y tree can return
   * line nodes out of visual order or with a virtualization ghost (a stale copy
   * of a row at an overlapping position). Either corrupts the in-order stitch and
   * doubles the collected total (TC-S03, run 26402569742: a cart with 2×Burgundy
   * + 2×Copper summed to exactly 2×). So anchor on geometry instead:
   *   1. sort by y → restores true top-to-bottom order regardless of tree order;
   *   2. de-ghost → drop any row whose y-range overlaps the previous kept row's
   *      (a ghost lands on top of a real row; genuine stacked lines only abut, so
   *      they survive — that's how two same-text variant lines stay distinct).
   */
  async _readVisibleSnapshot() {
    // Route through _orderedLineElements so collectAllLines indexes the same
    // lines as tap*/getLine. Otherwise iOS ghost rows (y=0, w=h=0 — e.g. a
    // line virtualized off the bottom after scroll-to-top) sort to the front
    // of this snapshot but are filtered out by _lineButtons, so beforeLines[0]
    // and tapDelete(0) point at different lines (run 26443672057 TC-S04).
    const lines = await this._orderedLineElements();
    const rows = [];
    for (const el of lines) {
      const desc = await el.getAttribute(this.attrName);
      const [y1, y2] = await this._lineYRange(el);
      rows.push({ ...this._parseDesc(desc), y1, y2 });
    }
    rows.sort((a, b) => a.y1 - b.y1);
    const OVERLAP_TOL = 5; // px; abutting lines share an edge, ghosts overlap deeper
    const out = [];
    for (const r of rows) {
      const prev = out[out.length - 1];
      if (prev && r.y1 < prev.y2 - OVERLAP_TOL) continue; // overlaps prev → ghost
      out.push(r);
    }
    return out;
  }

  async _swipeCart(fromY, toY) {
    const { width, height } = await this.driver.getWindowRect();

    // iOS: coordinates are point-based (iPhone 15 ≈ 852pt tall), so the Android
    // phone Y (1800↔800) is off-screen and the swipe errors / no-ops. Derive
    // viewport-relative coords, preserving caller intent (fromY > toY ⇒ scroll
    // down / reveal more below).
    if (this.isIOS) {
      const centerX = Math.round(width / 2);
      const down = fromY > toY;
      const iosFrom = Math.round(height * (down ? 0.72 : 0.40));
      const iosTo = Math.round(height * (down ? 0.40 : 0.72));
      await this.swipe(centerX, iosFrom, centerX, iosTo, 500);
      await this.driver.pause(this.settlePause);
      return;
    }

    // Tablet branch (width > 1200): derive Y from the live ScrollView
    // bounds. Hardcoded phone Y (1800↔800) sits outside tablet's taller
    // viewport and the swipe is a no-op there. Phone path is unchanged.
    // If the cart fits in one viewport (no scrollable container), tablet
    // doesn't need any swipe — silently no-op.
    if (width > 1200) {
      const sv = await this.driver.$(this._cartScroll);
      if (!(await sv.isExisting())) return;
      const b = this._parseBounds(await sv.getAttribute('bounds'));
      const span = b.y2 - b.y1;
      const tabletTop = b.y1 + Math.round(span * 0.20);
      const tabletBottom = b.y1 + Math.round(span * 0.80);
      // Preserve caller intent: fromY > toY ⇒ "scroll down" (reveal more).
      const tabletFrom = fromY > toY ? tabletBottom : tabletTop;
      const tabletTo   = fromY > toY ? tabletTop    : tabletBottom;
      const centerX = Math.round((b.x1 + b.x2) / 2);
      await this.swipe(centerX, tabletFrom, centerX, tabletTo, 500);
      await this.driver.pause(this.settlePause);
      return;
    }

    const centerX = Math.round(width / 2);
    await this.swipe(centerX, fromY, centerX, toY, 500);
    await this.driver.pause(this.settlePause);
  }

  async _scrollCartToTop() {
    if (this.isIOS) {
      // No UiScrollable on iOS, and the `~cart-scroll` Flutter Key doesn't
      // reach accessibilityIdentifier — so we can't address the ScrollView
      // directly. Repeatedly swipe content downward (revealing rows above)
      // until the topmost visible line's Y stops moving (= already at top).
      let prevTopY = -1;
      for (let i = 0; i < 6; i++) {
        const lines = await this._orderedLineElements();
        const topY = lines.length ? (await lines[0].getLocation()).y : -1;
        if (topY === prevTopY) break;
        prevTopY = topY;
        await this._swipeCart(800, 1800); // fromY < toY ⇒ "scroll up" / reveal above
      }
      return;
    }
    // No-op if nothing's scrollable (cart fits in viewport — typical on
    // tablet portrait with 7 lines).
    const sv = await this.driver.$(this._cartScroll);
    if (!(await sv.isExisting())) return;
    // Single fluid fling — no stacked-bounce visual on entry/exit.
    try {
      await this.driver.$('android=new UiScrollable(new UiSelector().scrollable(true).className("android.widget.ScrollView")).flingToBeginning(10)');
    } catch {
      // Fallback if no scroll occurred (already at top): UiScrollable throws.
    }
    await this.driver.pause(this.settlePause);
  }

  /**
   * Bring line `index` into the live viewport before reading or clicking it.
   * Scrolls to top first (the typical TC-S02/S03/S04 target is line 0, which
   * a prior `collectAllLines` swipe-walk leaves scrolled past on iOS), then
   * swipes down if `index` is past the visible window.
   */
  async _ensureLineVisible(index) {
    await this._scrollCartToTop();
    for (let attempt = 0; attempt < 6; attempt++) {
      const lines = await this._orderedLineElements();
      if (index < lines.length) return;
      await this._swipeCart(1800, 800);
    }
  }

  /**
   * Longest k where A's last-k descs equal B's first-k descs (in order).
   * Used to append only B's genuinely-new tail. Matched in-order, not as a
   * set, so duplicate variant lines stitch correctly.
   */
  _overlapK(A, B) {
    let k = Math.min(A.length, B.length);
    while (k > 0) {
      let match = true;
      for (let i = 0; i < k; i++) {
        if (A[A.length - k + i].raw !== B[i].raw) { match = false; break; }
      }
      if (match) break;
      k--;
    }
    return k;
  }

  /** True if A and B hold the same multiset of line descs (order-agnostic). */
  _sameMultiset(A, B) {
    if (A.length !== B.length) return false;
    const count = new Map();
    for (const x of A) count.set(x.raw, (count.get(x.raw) || 0) + 1);
    for (const x of B) {
      const c = count.get(x.raw);
      if (!c) return false;
      count.set(x.raw, c - 1);
    }
    return true;
  }

  /**
   * Collect every cart line, self-validated against the bottom-bar total.
   *
   * The multi-snapshot stitch (`_stitchOnce`) is render-lag-fragile: under CI lag
   * Compose hands the a11y tree back reordered / ghosted / partial, which the
   * stitch can either DOUBLE (re-append a window — TC-S03 Σ = exactly 2×) or
   * UNDER-COUNT (de-ghost drops a real abutting line, or the no-progress guard
   * stops early — TC-S04 read 5 of 7 lines). Both directions surfaced in a single
   * run (26423583629), so sort + de-ghost + guard alone can't tame it.
   *
   * The bottom-bar cart total IS reliable (TC-S02 green across runs), so use it as
   * ground truth: re-stitch until Σ line totals reconciles with it (one check that
   * catches over- AND under-count, since a doubled set sums high and a dropped line
   * sums low). A clean re-read almost always lands within 1-2 tries because the lag
   * is intermittent, not structural. Falls back to the closest attempt if none
   * reconcile, so behaviour is never worse than the old single-pass stitch.
   */
  async collectAllLines() {
    const expectedTotal = await this.getCartTotal();
    let best = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const lines = await this._stitchOnce();
      const sum = lines.reduce((s, l) => s + l.total, 0);
      if (Math.abs(sum - expectedTotal) < 0.01) return lines; // reconciled with truth
      if (!best || Math.abs(sum - expectedTotal) < Math.abs(best.sum - expectedTotal)) {
        best = { lines, sum };
      }
      await this.driver.pause(this.settlePause); // let render settle before re-reading
    }
    return best.lines;
  }

  /**
   * One top-to-bottom walk of the cart ScrollView, stitching snapshots into a
   * contiguous list. Scrolls to top first so each retry starts from a known
   * position (no-op if nothing's scrollable).
   */
  async _stitchOnce() {
    await this._scrollCartToTop();
    let collected = await this._readVisibleSnapshot();
    let prevVisible = collected;

    // Walk down in half-viewport steps, appending each snapshot's new tail.
    // Cap at 4 passes — even a long cart fits in 4 viewport-halves.
    for (let pass = 0; pass < 4; pass++) {
      await this._swipeCart(1800, 800);
      const snap = await this._readVisibleSnapshot();
      if (snap.length === 0) break;
      // No-progress guard: if the swipe surfaced the SAME multiset of lines
      // (cart fits one viewport, or we're already at the bottom), it didn't
      // scroll — never append a snapshot that revealed nothing genuinely new.
      if (this._sameMultiset(prevVisible, snap)) break;
      const k = this._overlapK(collected, snap);
      // Zero-overlap guard: a half-viewport swipe ALWAYS keeps some lines
      // visible from the previous snapshot, so k=0 means snap is a transient
      // mid-render read (e.g. line 0 captured mid-qty-tap → different `raw`
      // than the same line in `collected`). Appending it would double every
      // line — the exact failure signature of S02/S03/S04 hard-fails where
      // computedSum = 2× cartTotal. Skip this snapshot, retain prevVisible
      // so the next pass's `_sameMultiset` check still anchors on a real read.
      if (k === 0) continue;
      collected = [...collected, ...snap.slice(k)];
      prevVisible = snap;
    }
    // Single fluid fling back to top so subsequent S* tests operate on
    // line 0 from a known viewport position.
    await this._scrollCartToTop();
    return collected;
  }

  /** Cart Total numeric value from the bottom bar. */
  async getCartTotal() {
    const el = await this.driver.$(this.totalValue);
    const desc = await el.getAttribute(this.attrName);
    return parseFloat((desc || '').replace(/[^0-9.]/g, ''));
  }

  // ─── Per-line buttons via direct child click ──────────────────────
  // Each line ImageView has 3 NAF Button children in DOM order
  // [Minus, Plus, Delete]. Direct .click() on the child element works
  // regardless of layout (phone portrait, tablet portrait, etc.) and
  // sidesteps the per-device coordinate-offset problem.

  async _lineButtons(index) {
    const lines = await this._orderedLineElements();
    if (index >= lines.length) {
      throw new Error(`line button: only ${lines.length} lines, requested ${index}`);
    }
    if (this.isAndroid) {
      const buttons = await lines[index].$$('android.widget.Button');
      if (buttons.length < 3) {
        throw new Error(`line ${index} has ${buttons.length} buttons, expected 3`);
      }
      return { minus: buttons[0], plus: buttons[1], delete: buttons[2] };
    }
    // iOS: per cart-line XML, the stepper buttons are SIBLINGS of the line
    // Image (not descendants), all 3 at the same Y, x=100/188/317 → Minus,
    // Plus, Delete. Filter all visible XCUIElementTypeButtons by the line's
    // Y-band and sort by x. Bounds-derived, no hardcoded coords.
    const loc = await lines[index].getLocation();
    const size = await lines[index].getSize();
    const yTop = loc.y, yBot = loc.y + size.height;
    // Don't filter on `visible == 1` in the predicate: WDA evaluates that
    // strictly (ANDs in accessibility), so the DISABLED Minus button at
    // qty=1 — visible=true but accessible=false in the XML — is dropped,
    // collapsing the band to 2 buttons. Query all buttons then filter
    // client-side on rendered size + Y-band, which captures on-screen
    // buttons regardless of accessibility flags.
    const all = await this.driver.$$('-ios predicate string:type == "XCUIElementTypeButton"');
    const inLine = [];
    for (const b of all) {
      const bs = await b.getSize();
      if (bs.width === 0 || bs.height === 0) continue;
      const bl = await b.getLocation();
      if (bl.y >= yTop && bl.y < yBot) inLine.push({ el: b, x: bl.x });
    }
    inLine.sort((a, b) => a.x - b.x);
    if (inLine.length < 3) {
      throw new Error(`iOS line ${index} has ${inLine.length} stepper buttons in y-band [${yTop},${yBot}), expected 3`);
    }
    return { minus: inLine[0].el, plus: inLine[1].el, delete: inLine[2].el };
  }

  // Each tap waits for its effect to land in the a11y tree before returning,
  // rather than relying on a fixed pause. The Compose bridge can stale-read
  // for hundreds of ms under CI render-lag, which caused `collectAllLines()`
  // to stitch a pre-tap + post-tap snapshot (exactly 2× sum mismatch in run
  // 26010878162 TC-S02 attempt 1). Verifying the action eliminates the race.

  async tapPlus(index) {
    await this._ensureLineVisible(index);
    const before = await this.getLine(index);
    const { plus } = await this._lineButtons(index);
    await plus.click();
    await this.driver.waitUntil(async () => {
      const now = await this.getLine(index);
      return now.qty > before.qty;
    }, { timeout: 5000, interval: 200, timeoutMsg: `tapPlus(${index}): qty did not increment from ${before.qty} within 5s` });
  }

  async tapMinus(index) {
    await this._ensureLineVisible(index);
    const before = await this.getLine(index);
    const { minus } = await this._lineButtons(index);
    await minus.click();
    await this.driver.waitUntil(async () => {
      const now = await this.getLine(index);
      return now.qty < before.qty;
    }, { timeout: 5000, interval: 200, timeoutMsg: `tapMinus(${index}): qty did not decrement from ${before.qty} within 5s` });
  }

  async tapDelete(index) {
    // Don't use getLineCount() as the signal — Compose virtualisation
    // backfills the freed row with an off-screen item, so visible count
    // can stay flat even though the cart genuinely shrunk. Use bottom-bar
    // cart total: it always changes on a real delete and disappears into
    // the empty-state message when the last line goes.
    await this._ensureLineVisible(index);
    const beforeTotal = await this.getCartTotal();
    const { delete: del } = await this._lineButtons(index);
    await del.click();
    await this.driver.waitUntil(async () => {
      if (await this.isVisible(this.emptyCartMsg)) return true;
      try {
        const nowTotal = await this.getCartTotal();
        return Math.abs(nowTotal - beforeTotal) > 0.001;
      } catch {
        return false;
      }
    }, { timeout: 5000, interval: 200, timeoutMsg: `tapDelete(${index}): cart total did not change from ${beforeTotal} within 5s` });
  }

  /**
   * Read clickable/enabled flags on the Minus button at `index`. Locates
   * it as the first Button child of the line ImageView's bounds via a
   * narrow point-elements query — bounds-derived, no hardcoded coords.
   */
  async getMinusState(index) {
    await this._ensureLineVisible(index);
    const lines = await this._orderedLineElements();
    if (index >= lines.length) throw new Error(`minus state: bad index ${index}`);
    if (this.isAndroid) {
      // First Button descendant within the line subtree (DOM order ⇒ Minus).
      const minusBtn = await lines[index].$('android.widget.Button');
      const clickable = await minusBtn.getAttribute('clickable');
      const enabled = await minusBtn.getAttribute('enabled');
      return { clickable: clickable === 'true', enabled: enabled === 'true' };
    }
    // iOS: reuse the bounds-derived sibling-button lookup. XCUITest has no
    // `clickable`; the disabled Minus at qty=1 flips both `enabled` and
    // `accessible` to false (per cart XML), so accessible is the right
    // proxy for "has a working gesture handler" — preserves the S03
    // assertion semantics (both flags false when disabled).
    const { minus } = await this._lineButtons(index);
    const enabled = await minus.getAttribute('enabled');
    const accessible = await minus.getAttribute('accessible');
    return { clickable: accessible === 'true', enabled: enabled === 'true' };
  }

  async tapProceedToCheckout() {
    const btn = await this.driver.$(this.proceedToCheckoutBtn);
    await btn.click();
  }
}

module.exports = { CartPage };
