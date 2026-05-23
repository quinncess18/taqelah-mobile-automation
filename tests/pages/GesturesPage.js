// @ts-check
const { BasePage } = require('./BasePage');

/**
 * GesturesPage — Intelligent POM for the Gesture interaction screen.
 * Handles all complex physical interactions (Swipe, Drag, Zoom, Long Press).
 * Encapsulates all pointer math and W3C actions for universal Android/iOS support.
 */
class GesturesPage extends BasePage {
  constructor(driver) {
    super(driver);

    // Page Title
    this.title = this.isAndroid ? 'android=new UiSelector().description("Gesture Demo")' : '~Gesture Demo';

    // iOS: Flutter Key()-less — `~<visible text>` name-fallback mirrors the
    // Android description; CONTAINS predicates for partial/positional matches.
    // Swipe Cards Section
    this.sectionSwipeCards = this.isAndroid ? 'android=new UiSelector().description("Swipe Cards")' : '~Swipe Cards';
    this.instructionSwipe = this.isAndroid ? 'android=new UiSelector().description("Swipe right to favorite, left to delete")' : '~Swipe right to favorite, left to delete';
    this.swipeCard = (index) => this.isAndroid
      ? `android=new UiSelector().description("Swipe Card ${index}")`
      : `~Swipe Card ${index}`;

    // Drag & Drop Section
    this.sectionDragDrop = this.isAndroid ? 'android=new UiSelector().description("Drag & Drop Reorder")' : '~Drag & Drop Reorder';
    this.instructionDragDrop = this.isAndroid ? 'android=new UiSelector().description("Long press and drag to reorder")' : '~Long press and drag to reorder';
    this.dragItem = (id) => this.isAndroid
      ? `android=new UiSelector().descriptionContains("Drag Item ${id}")`
      : `-ios predicate string:name CONTAINS "Drag Item ${id}"`;
    // iOS item name is "<position>\nDrag Item <id>" — the slot number is the
    // LEADING char, so BEGINSWITH the position digit disambiguates it from the
    // same digit appearing inside "Drag Item N" after the list is reshuffled
    // (a plain CONTAINS collides, e.g. "4\nDrag Item 1" contains both 4 and 1).
    this.dragItemExact = (position, id) => this.isAndroid
      ? `android=new UiSelector().descriptionContains("${position}\nDrag Item ${id}")`
      : `-ios predicate string:name BEGINSWITH "${position}" AND name CONTAINS "Drag Item ${id}"`;
    // Finds whatever card is currently occupying a given position slot
    this.dragSlot = (position) => this.isAndroid
      ? `android=new UiSelector().descriptionContains("${position}\nDrag Item")`
      : `-ios predicate string:name BEGINSWITH "${position}" AND name CONTAINS "Drag Item"`;

    // Long Press Section
    this.sectionLongPress = this.isAndroid ? 'android=new UiSelector().description("Long Press")' : '~Long Press';
    this.instructionLongPress = this.isAndroid ? 'android=new UiSelector().description("Long press the card below")' : '~Long press the card below';
    this.longPressBtn = this.isAndroid
      ? 'android=new UiSelector().description("Long press me for options")'
      : '~Long press me for options';

    // Double Tap Section
    this.doubleTapArea = this.isAndroid
      ? 'android=new UiSelector().description("Double Tap to Zoom")'
      : '~Double Tap to Zoom';

    // Pinch to Zoom Section
    this.pinchArea = this.isAndroid
      ? 'android=new UiSelector().description("Pinch to Zoom")'
      : '~Pinch to Zoom';

    // Toast & Long Press Options
    this.toastMsg = (text) => this.isAndroid
      ? `android=new UiSelector().descriptionContains("${text}")`
      : `-ios predicate string:name CONTAINS "${text}"`;
    this.optionCopy = this.isAndroid ? 'android=new UiSelector().description("Copy")' : '~Copy';
    this.optionShare = this.isAndroid ? 'android=new UiSelector().description("Share")' : '~Share';
    this.optionDelete = this.isAndroid ? 'android=new UiSelector().description("Delete")' : '~Delete';
    this.optionDismiss = this.isAndroid ? 'android=new UiSelector().description("Dismiss menu")' : '~Dismiss menu';
  }

  async waitForPageLoad() {
    await this.waitForDisplayed(this.title);
  }

  async goBack() {
    const btn = await this.driver.$(this.backBtn);
    await btn.click();
  }

  /**
   * Performs a long-press swipe (Favorite/Delete).
   * Encapsulates all coordinate math.
   */
  async swipeCardSide(index, direction) {
    const card = await this.driver.$(this.swipeCard(index));
    const loc = await card.getLocation();
    const sz = await card.getSize();

    const centerY = Math.round(loc.y + sz.height * 0.5);
    const startX = direction === 'right' ? Math.round(loc.x + sz.width * 0.2) : Math.round(loc.x + sz.width * 0.8);
    const endX = direction === 'right' ? Math.round(loc.x + sz.width * 0.9) : Math.round(loc.x + sz.width * 0.1);

    await this.driver.performActions([{
      type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: startX, y: centerY },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 600 },
        { type: 'pointerMove', duration: 500, origin: 'viewport', x: endX, y: centerY },
        { type: 'pointerUp', button: 0 }
      ]
    }]);
  }

  /**
   * Returns the first DISPLAYED element matching the selector, or null if none
   * report displayed. After a reorder the card in the TOP slot reports
   * visible="false" at (0,0) in the iOS a11y tree, so only the genuinely
   * on-screen rows (slots 2..5) resolve here — used to read the visible layout.
   */
  async firstDisplayedEl(selector) {
    const els = await this.driver.$$(selector);
    for (const el of els) {
      try { if (await el.isDisplayed()) return el; } catch { /* stale, skip */ }
    }
    return null;
  }

  async reorderItem(sourceSelector, targetSelector) {
     const source = await this.driver.$(sourceSelector);
     const target = await this.driver.$(targetSelector);

     const sLoc = await source.getLocation();
     const sSz = await source.getSize();
     const tLoc = await target.getLocation();
     const tSz = await target.getSize();

     const startX = Math.round(sLoc.x + sSz.width * 0.5);
     const startY = Math.round(sLoc.y + sSz.height * 0.5);
     const rawEndY = Math.round(tLoc.y + tSz.height * 0.5);

     await this.driver.performActions([{
       type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
       actions: [
         { type: 'pointerMove', duration: 0, x: startX, y: startY },
         { type: 'pointerDown', button: 0 },
         { type: 'pause', duration: 1500 },
         { type: 'pointerMove', duration: 50, origin: 'viewport', x: startX, y: startY - 20 },
         { type: 'pointerMove', duration: 700, origin: 'viewport', x: startX, y: rawEndY },
         { type: 'pause', duration: 200 },
         { type: 'pointerUp', button: 0 }
       ]
     }]);
   }

  /**
   * iOS: read the drag-row layout. After a reorder the JUST-DISPLACED card (at
   * whatever slot it lands, not only slot 1) reports visible="false" at (0,0) in
   * the a11y tree (confirmed via diagnostic XML), so exactly one slot reads empty.
   * We scan all five slots, take the four that resolve, then place the single
   * missing card in the one empty slot by elimination and extrapolate its centre
   * from the visible rows' even pitch — never reading the broken node's own coords.
   * Polls until at most one slot is missing (>1 missing = still mid-render).
   * @returns {Promise<{order:number[], cx:number, slotY:(s:number)=>number}>}
   *   order: cardId at each slot [slot1..slot5], 0 only if it never settled
   *   cx:    shared row centre x
   *   slotY: centre-y for any slot 1..5
   */
  async iosDragLayout(maxTries = 6) {
    let slotCard = {}; // slot(1..5) -> cardId   (visible only)
    let slotCy = {};   // slot(1..5) -> centre y (visible only)
    let cx = null;
    for (let t = 0; t < maxTries; t++) {
      slotCard = {}; slotCy = {}; cx = null;
      for (let s = 1; s <= 5; s++) {
        for (let c = 1; c <= 5; c++) {
          const el = await this.firstDisplayedEl(this.dragItemExact(s, c));
          if (el) {
            const l = await el.getLocation();
            const z = await el.getSize();
            slotCard[s] = c;
            slotCy[s] = Math.round(l.y + z.height / 2);
            cx = Math.round(l.x + z.width / 2);
            break;
          }
        }
      }
      // Clean read = resolved slots are all DISTINCT cards (no duplicate) AND at
      // most one slot empty (the displaced card's (0,0) node). A duplicate means
      // a card is mid-animation showing in two slots — still settling, so re-scan.
      const resolved = Object.keys(slotCard).length;
      const distinct = new Set(Object.values(slotCard)).size;
      if (resolved >= 4 && resolved === distinct) break;
      await this.driver.pause(this.settlePause);
    }
    // Fill the single empty slot (if any) with the one missing card by elimination.
    const present = Object.values(slotCard);
    const missingCard = [1, 2, 3, 4, 5].find(c => !present.includes(c)) || 0;
    const order = [1, 2, 3, 4, 5].map(s => slotCard[s] || missingCard);

    // Even pitch + shared x from the visible rows; extrapolate any slot's centre.
    const ref = Object.keys(slotCy).map(Number).sort((a, b) => a - b);
    const pitch = ref.length >= 2 ? (slotCy[ref[1]] - slotCy[ref[0]]) / (ref[1] - ref[0]) : 64;
    const slotY = (slot) => Math.round(slotCy[ref[0]] + (slot - ref[0]) * pitch);
    return { order, cx, slotY };
  }

  /**
   * iOS: long-press-drag from one slot-centre y to another at the shared row x,
   * via the iOS-native gesture. Coordinates come from iosDragLayout (sibling-
   * derived), bypassing the broken top-slot a11y frame.
   */
  async iosReorder(cx, fromY, toY) {
    await this.driver.execute('mobile: dragFromToForDuration', {
      duration: 1.6,
      fromX: cx, fromY,
      toX: cx,   toY,
    });
    await this.driver.pause(this.settlePause);
  }

  /**
   * Encapsulated Long Press
   */
  async longPress(selector) {
    const el = await this.driver.$(selector);
    const loc = await el.getLocation();
    const sz = await el.getSize();
    const cX = Math.round(loc.x + sz.width * 0.5);
    const cY = Math.round(loc.y + sz.height * 0.5);

    await this.driver.performActions([{
      type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: cX, y: cY },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 2000 },
        { type: 'pointerUp', button: 0 }
      ]
    }]);
  }

  async verifyToast(text, timeout = 5000) {
    const toast = await this.driver.$(this.toastMsg(text));
    await toast.waitForDisplayed({ timeout });
    return await toast.isDisplayed();
  }

  async tapOption(label) {
    const selector = label === 'Copy' ? this.optionCopy :
                     label === 'Share' ? this.optionShare :
                     this.optionDelete;
    const btn = await this.driver.$(selector);
    await btn.waitForDisplayed({ timeout: 5000 });
    await btn.click();
  }

  // Samples a cross-pattern at canvas center after pan and returns true if the hanger is present.
  // Canvas bounds are computed dynamically from label bottom to Pinch section top.
  async verifyCanvasHasContent() {
    const { PNG } = require('pngjs');

    // Wait for pan animation to fully settle before sampling pixels
    await this.driver.pause(this.settlePause);

    const label = await this.driver.$(this.doubleTapArea);
    const labelLoc = await label.getLocation();
    const labelSz = await label.getSize();
    // Clamp canvasTop: label may be off-screen on tablet after scrolling to pinchArea
    const canvasTop = Math.max(labelLoc.y + labelSz.height, 50);

    const pinch = await this.driver.$(this.pinchArea);
    const pinchLoc = await pinch.getLocation();
    const canvasBottom = pinchLoc.y - 20;

    const cx = Math.round(labelLoc.x + labelSz.width * 0.5);
    const cy = Math.round((canvasTop + canvasBottom) / 2);
    const { width: screenWidth } = await this.driver.getWindowRect();
    const isTablet = screenWidth > 1200;

    const base64 = await this.driver.takeScreenshot();
    const png = PNG.sync.read(Buffer.from(base64, 'base64'));
    // Element bounds are logical points; the screenshot PNG is device pixels
    // (1× on the Android emulator, 2×/3× on iOS Retina). Scale logical coords
    // into PNG space before indexing, or iOS samples the wrong region.
    const scale = png.width / screenWidth;
    const bright = (x, y) => {
      const i = (png.width * Math.round(y * scale) + Math.round(x * scale)) * 4;
      return Math.round((png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3);
    };

    let minBrightness = 255;
    if (isTablet) {
      // Tablet: panCanvas moves the icon by ~2*0.35*sz.width (~1748px), pushing it well
      // outside a small cross at canvas center. Scan a dense grid across the whole canvas
      // so we catch the icon wherever pan has placed it.
      const stepX = Math.max(40, Math.round(labelSz.width / 30));
      const stepY = Math.max(40, Math.round((canvasBottom - canvasTop) / 10));
      for (let y = canvasTop + 10; y < canvasBottom - 10; y += stepY) {
        for (let x = labelLoc.x + 10; x < labelLoc.x + labelSz.width - 10; x += stepX) {
          minBrightness = Math.min(minBrightness, bright(x, y));
        }
      }
    } else {
      // Phone: small cross at canvas center (proven working).
      const r = 50;
      for (const [x, y] of [[cx, cy], [cx - r, cy], [cx + r, cy], [cx, cy - r], [cx, cy + r]]) {
        minBrightness = Math.min(minBrightness, bright(x, y));
      }
    }

    return minBrightness < 180;
  }

  // Pans NW across the double-tap canvas. Only moves content when zoomed in.
  // Tablet runs twice (larger canvas, image drifts further); mobile runs once.
  async panCanvas() {
    const label = await this.driver.$(this.doubleTapArea);
    const loc = await label.getLocation();
    const sz = await label.getSize();
    const pinch = await this.driver.$(this.pinchArea);
    const pinchLoc = await pinch.getLocation();
    const { width } = await this.driver.getWindowRect();
    const isTablet = width > 1200;

    // On tablet, doubleTapArea may scroll off-screen after doubleTapZoomCanvas centers pinchArea.
    // Clamp canvasTop to 50px so pan always lands inside the visible canvas area.
    const canvasTop = Math.max(loc.y + sz.height, 50);
    const canvasY = Math.round(canvasTop + (pinchLoc.y - canvasTop) * 0.5);
    const hDist = Math.round(sz.width * (isTablet ? 0.35 : 0.4));
    const vDist = Math.round(sz.width * (isTablet ? 0.05 : 0.2));

    await this.swipe(
      Math.round(loc.x + sz.width * 0.5 + hDist), Math.round(canvasY + vDist),
      Math.round(loc.x + sz.width * 0.5 - hDist), Math.round(canvasY - vDist),
      400
    );
  }

  // Returns a metric (universal across phone/tablet) that reliably differs before/after pinch.
  // Phone: average brightness across a 3×3 grid in the canvas (proven working).
  // Tablet: count of "dark" pixels (likely icon pixels, brightness < 180) across a dense
  //   scan of the entire canvas region. The tablet canvas is much wider than the phone's,
  //   so the icon occupies a tiny fraction of any sparse grid — averaging hides changes.
  //   Counting dark pixels across the full canvas catches icon-area growth from the zoom.
  async getPinchCenterBrightness() {
    await this.driver.pause(this.settlePause);
    const { PNG } = require('pngjs');
    const { width: screenWidth, height: screenHeight } = await this.driver.getWindowRect();
    const isTablet = screenWidth > 1200;

    const label = await this.driver.$(this.pinchArea);
    const loc = await label.getLocation();
    const sz = await label.getSize();
    const canvasTop = loc.y + sz.height;
    const canvasBottom = screenHeight - 50;
    const canvasHeight = canvasBottom - canvasTop;

    const base64 = await this.driver.takeScreenshot();
    const png = PNG.sync.read(Buffer.from(base64, 'base64'));
    // Logical points → PNG device pixels (1× Android, 2×/3× iOS Retina).
    const scale = png.width / screenWidth;

    // Dense scan: count dark pixels every 10px across the full canvas
    // (label.y+label.h → canvasBottom, full screen width). Robust to icon
    // shape, position, and lens transparency — the magnifying glass icon
    // has a dark border + handle but a mint-colored interior, so a sparse
    // 3×3 brightness average can miss the zoom change entirely (verified
    // via CI diagnostic dumps: brightness=227 before AND after even though
    // the icon visibly enlarged). Counting dark pixels naturally registers
    // "more icon area" after the zoom.
    //
    // Unified path for phone + tablet — the previous tablet-specific branch
    // was added for a wide-canvas issue; the underlying brittleness it
    // worked around (sparse-icon-misses-3×3-grid) is the same problem the
    // phone exhibits on CI's Pixel 6 emulator. Density 10px works on both.
    let darkCount = 0;
    for (let y = canvasTop; y < canvasBottom; y += 10) {
      for (let x = 0; x < screenWidth; x += 10) {
        const i = (png.width * Math.round(y * scale) + Math.round(x * scale)) * 4;
        const brightness = Math.round((png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3);
        if (brightness < 180) darkCount++;
      }
    }
    void isTablet; // retained for diagnostic JSON only
    return darkCount;
  }

  /**
   * Double taps the zoom canvas anchored below the "Double Tap to Zoom" label.
   * The label is clickable="false" — Flutter handles gestures at its own layer.
   * Uses W3C pointer actions with tight inter-tap timing to reach Flutter's recognizer.
   */
  async doubleTapZoomCanvas() {
    const { width } = await this.driver.getWindowRect();

    // Scroll until the Pinch header appears, which guarantees the full canvas
    // above it is in view AND that pinchArea reports an on-screen y (the tap
    // coordinate below is the midpoint between the label and pinchArea).
    //   Tablet — label visible but canvas cropped.
    //   iOS — the Double Tap canvas lands at the bottom fold (label ~93% of
    //     height) with pinchArea off-screen (visible=false, y≈0); without this
    //     scroll tapY collapses to mid-screen and the double-tap misses the
    //     canvas entirely (run 26331896225 M07 first-attempt flake). Android
    //     phone keeps the canvas top-fold, so it stays exempt.
    if (width > 1200 || this.isIOS) {
      await this.scrollToSection(this.pinchArea);
    }

    // Read location AFTER any scroll so tap coordinates reflect the current screen position
    const label = await this.driver.$(this.doubleTapArea);
    const loc = await label.getLocation();
    const sz = await label.getSize();
    const pinch = await this.driver.$(this.pinchArea);
    const pinchLoc = await pinch.getLocation();

    const tapX = Math.round(loc.x + sz.width * 0.5);
    // Canvas centre: midpoint between label bottom and pinch section top
    const tapY = Math.round((loc.y + sz.height + pinchLoc.y) / 2);

    // Single sequence — UiAutomator2 handles the inter-tap pause internally,
    // keeping both taps within Flutter's 300ms double-tap window regardless of round-trip latency.
    await this.driver.performActions([{
      type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x: tapX, y: tapY },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerUp', button: 0 },
        { type: 'pause', duration: 100 },
        { type: 'pointerMove', duration: 0, x: tapX, y: tapY },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerUp', button: 0 },
      ]
    }]);
    await this.driver.releaseActions();
    await this.driver.pause(this.settlePause);
  }

  async pinch(selector) {
    const label = await this.driver.$(selector);
    const loc = await label.getLocation();
    const sz = await label.getSize();
    const { width: screenWidth, height: screenHeight } = await this.driver.getWindowRect();
    const isTablet = screenWidth > 1200;

    const canvasTop = loc.y + sz.height;
    const canvasHeight = screenHeight - canvasTop - 50;
    const cX = Math.round(loc.x + sz.width * 0.5);
    const cY = Math.round(canvasTop + canvasHeight * 0.5);
    const offset = Math.round(sz.width * (isTablet ? 0.40 : 0.30));

    await this.driver.performActions([
      {
        type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: cX - offset, y: cY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 800, origin: 'viewport', x: cX - offset * 2, y: cY },
          { type: 'pointerUp', button: 0 },
        ]
      },
      {
        type: 'pointer', id: 'finger2', parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: cX + offset, y: cY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration: 800, origin: 'viewport', x: cX + offset * 2, y: cY },
          { type: 'pointerUp', button: 0 },
        ]
      }
    ]);
    await this.driver.pause(this.settlePause);
  }

  /**
   * Scrolls down until the target section header is visible.
   * Uses mobile: scrollGesture constrained to a 20px strip at the far left edge,
   * avoiding the Drag & Drop canvas which spans x=32..2528 on tablet (nearly full width).
   */
  async scrollToSection(selector) {
    let centered = await this.isInsideViewport(selector);
    let attempts = 0;
    while (!centered && attempts < 8) {
      const { width, height } = await this.driver.getWindowRect();
      const isTablet = width > 1200;
      if (this.isAndroid) {
        await this.driver.execute('mobile: scrollGesture', {
          left: 0, top: Math.round(height * 0.25),
          width: 20, height: Math.round(height * 0.5),
          direction: 'down', percent: isTablet ? 2.0 : 3.0,
        });
      } else {
        // iOS: a drag without a brief touch-hold after pointerDown is NOT
        // registered as a scroll by Flutter — BasePage.swipe moves immediately,
        // so the page never scrolled (run 26333525886: Double Tap canvas stuck
        // at y=783/852). Mirror LocationPage._swipeUp: center-x, 100ms hold,
        // then move. Start the swipe at mid-screen (0.5h) NOT 0.7h: the lower
        // band can sit on the nested ReorderableListView (drag items), which
        // captures the gesture and scrolls its own short list instead of the
        // page (run 26334076492 M08 reset: scroll-to-longpress no-op'd because
        // the swipe landed on the drag list). Mid-screen lands on headers /
        // swipe-cards (which only capture horizontal), so the page scrolls.
        const x = Math.round(width / 2);
        await this.driver.performActions([{
          type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x, y: Math.round(height * 0.5) },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 100 },
            { type: 'pointerMove', duration: 400, x, y: Math.round(height * 0.12) },
            { type: 'pointerUp', button: 0 },
          ],
        }]);
        await this.driver.releaseActions();
      }
      await this.driver.pause(500);
      centered = await this.isInsideViewport(selector);
      attempts++;
    }
  }

  /**
   * Scrolls to the Drag & Drop section only if the items are not already in view.
   * After TC-M04 swipes all cards, the section floats up naturally — scrolling would overshoot.
   * Tablet: after re-navigation the wider layout pushes drag items 4-5 below the fold.
   * Bump the page down once by swiping in the white space gap between the Swipe section
   * and Drag section — anchored to the bottom of swipeCard(5) so the gesture lands on
   * empty space, not on any draggable card or canvas.
   */
  async scrollToDragSection() {
    const { width, height } = await this.driver.getWindowRect();
    const isTablet = width > 1200;

    if (isTablet) {
      const lastVisible = await this.isInsideViewport(this.dragItem(5));
      if (!lastVisible) {
        const lastSwipeCard = await this.driver.$(this.swipeCard(5));
        const swipeLoc = await lastSwipeCard.getLocation();
        const swipeSz = await lastSwipeCard.getSize();
        const gapY = swipeLoc.y + swipeSz.height + 30;
        const centerX = Math.round(width * 0.5);
        await this.swipe(centerX, gapY, centerX, Math.round(height * 0.15), 800);
        await this.driver.pause(800);
      }
    } else {
      const alreadyVisible = await this.isInsideViewport(this.dragItem(1));
      if (!alreadyVisible) {
        await this.scrollToSection(this.dragItem(1));
        await this.driver.pause(500);
      }
    }
  }
}

module.exports = { GesturesPage };
