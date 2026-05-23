// @ts-check
const { BasePage } = require('./BasePage');

/**
 * LocationPage — POM for the Location module.
 *
 * Permission flow on entry: single OS dialog (Precise/Approximate +
 * While using / Only this time / Don't allow). No back-to-back dialog
 * sequence (unlike Camera, which prompts Audio after Camera).
 *
 * Location screen states:
 *   - Idle granted: header + Current Location card (Lat/Lng/Altitude/Speed/
 *     Accuracy) + Refresh button + Start Tracking button. No tracking
 *     indicator, no History section yet.
 *   - Tracking: same as idle plus Stop Tracking (replaces Start) +
 *     "Tracking location updates..." indicator + Location History section.
 *     History entries appear as scrollable views with content-desc
 *     "<lat>, <lng>\n<HH:mm:ss>\n±<n>m".
 *   - Denied: header + "Location permission denied" + "Open Settings".
 *
 * History list is a Flutter ListView.builder-style virtualized list — only rendered (~visible)
 * entries appear in the a11y tree. Use collectAllHistoryEntries() to
 * scroll-and-dedupe across the full list.
 *
 * Refresh button is a confirmed no-op (does not produce history entries
 * or change the Current Location card on emulator). Each Start Tracking
 * tap inserts exactly one history entry, provided GPS dwell ≥ ~3s.
 */
class LocationPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    // ── Page header ──
    this.screenTitle = this.isAndroid
      ? 'android=new UiSelector().description("Location")'
      : '~Location';

    // ── Granted state widgets ──
    this.startTrackingBtn = this.isAndroid
      ? 'android=new UiSelector().description("Start Tracking")'
      : '~Start Tracking';

    this.stopTrackingBtn = this.isAndroid
      ? 'android=new UiSelector().description("Stop Tracking")'
      : '~Stop Tracking';

    this.refreshBtn = this.isAndroid
      ? 'android=new UiSelector().description("Refresh")'
      : '~Refresh';

    this.trackingIndicator = this.isAndroid
      ? 'android=new UiSelector().description("Tracking location updates...")'
      : '~tracking-indicator';

    this.locationHistoryHeader = this.isAndroid
      ? 'android=new UiSelector().description("Location History")'
      : '~Location History';

    // Current Location card content-desc concatenates all 5 fields with
    // newlines. We match the prefix so a regex check on the full value
    // can verify field presence.
    // iOS: the card is a StaticText whose name/label is the full field block
    // ("Current Location\nLatitude\n…") — run 26334076492 LO02 dump. `~` can't
    // match the newline, so prefix-predicate on the leading text.
    this.currentLocationCard = this.isAndroid
      ? 'android=new UiSelector().descriptionStartsWith("Current Location")'
      : '-ios predicate string:name BEGINSWITH "Current Location"';

    // ── Denied state ──
    this.permissionDeniedText = this.isAndroid
      ? 'android=new UiSelector().description("Location permission denied")'
      : '~location-permission-denied';

    this.openSettingsBtn = this.isAndroid
      ? 'android=new UiSelector().description("Open Settings")'
      : '~open-settings';

    // ── OS Permission Dialog (PermissionController) ──
    this.allowWhileUsingBtn = this.isAndroid
      ? 'android=new UiSelector().resourceId("com.android.permissioncontroller:id/permission_allow_foreground_only_button")'
      : '~While using the app';

    this.allowOneTimeBtn = this.isAndroid
      ? 'android=new UiSelector().resourceId("com.android.permissioncontroller:id/permission_allow_one_time_button")'
      : '~Only this time';

    this.denyBtn = this.isAndroid
      ? 'android=new UiSelector().resourceIdMatches(".*permission_deny.*")'
      : "~Don't allow";

    // Pacing — Start Tracking dwell must be long enough for the emulator
    // GPS mock to return a fix and the entry to land in the History list.
    // Scratch verified ≥3s reliable; using 3500ms for headroom.
    this.startDwellMs = 3500;
  }

  // ── Page-load gates ──────────────────────────────────────────────────

  /**
   * Title-only wait. Universal across all Location states (idle, tracking,
   * denied). State-specific widgets get their own waits below.
   */
  async waitForPageLoad() {
    await this.waitForDisplayed(this.screenTitle, 15000);
  }

  /**
   * Wait for the granted-state UI (post permission accept, pre Start Tracking).
   */
  async waitForGrantedIdle() {
    // Card-render is gated on a GPS fix. Local Pixel 8 returns sub-second;
    // Pixel Tablet AVD ~10–15s; CI Pixel 6 cold-boot is variable.
    //
    // 2026-05-17: Card timeout dropped 60s → 20s after CI run 25980717553
    // showed a 60s wait starving UiAutomator2 long enough that the AVD's
    // own `system_server` crashed (`Can't find service: activity`),
    // cascading-skipping every downstream Location TC. Better to fail fast
    // and let Playwright retry with `beforeEach` cascade replay than let
    // UIA2 hang. Wrapped in try/catch so a card timeout surfaces as a
    // clear assertion failure instead of crashing the runner.
    const t0 = Date.now();
    await this.waitForDisplayed(this.screenTitle, 15000);
    console.log(`[LO02] title visible at +${Date.now() - t0}ms`);
    try {
      await this.waitForDisplayed(this.currentLocationCard, 20000);
    } catch (err) {
      console.warn(`[LO02] card wait failed at +${Date.now() - t0}ms — likely GPS warm-up race; throwing for retry`);
      throw err;
    }
    console.log(`[LO02] card visible at +${Date.now() - t0}ms`);
    await this.waitForDisplayed(this.refreshBtn, 10000);
    console.log(`[LO02] refresh visible at +${Date.now() - t0}ms`);
    await this.waitForDisplayed(this.startTrackingBtn, 10000);
    console.log(`[LO02] startTracking visible at +${Date.now() - t0}ms — granted-idle OK`);
  }

  /**
   * Inject a mock GPS fix via Appium's setGeoLocation. Side-steps the
   * emulator's own location provider, which on the CI Pixel 6 cold boot
   * doesn't emit a fix fast enough for the granted-state card render
   * (causing TC-LO02 to time out and then crash UiAutomator2). Requires
   * io.appium.settings to hold ACCESS_*_LOCATION (granted in appFixture
   * pre-flight on emulator targets; CI workflow grants too).
   *
   * Coordinates default to Singapore (taqelah.sg's nominal context).
   * Idempotent and a no-op on iOS / cloud-target sessions.
   */
  async warmupGeo({ latitude = 1.2966, longitude = 103.8547, altitude = 30 } = {}) {
    if (!this.isAndroid) return;
    try {
      await this.driver.execute('mobile: setGeolocation', { latitude, longitude, altitude });
      // 2026-05-17: bumped 500ms → 2500ms after CI run 25980717553 showed
      // `setGeolocation` returning immediately but the system location
      // provider needing seconds to propagate the fix to subscribers.
      // `mobile: getGeolocation` was tried as a deterministic verification
      // gate but throws 500 ("Cannot execute the 'retrieve geolocation'
      // action") on the CI runner — unusable. The longer pause is a
      // probabilistic improvement: still a race, but a wider window.
      await this.driver.pause(2500);
    } catch (err) {
      console.warn(`[LocationPage] warmupGeo non-fatal: ${err.message}`);
    }
  }

  /**
   * Wait for the tracking state (post Start Tracking tap).
   */
  async waitForTrackingState() {
    await this.waitForDisplayed(this.screenTitle, 15000);
    await this.waitForDisplayed(this.stopTrackingBtn, 10000);
    await this.waitForDisplayed(this.trackingIndicator, 10000);
  }

  /**
   * Wait for the denied-state UI (post permission deny).
   */
  async waitForDeniedState() {
    await this.waitForDisplayed(this.screenTitle, 15000);
    await this.waitForDisplayed(this.permissionDeniedText, 10000);
    await this.waitForDisplayed(this.openSettingsBtn, 10000);
  }

  // ── OS Dialog ────────────────────────────────────────────────────────

  // iOS: the location permission prompt is a SpringBoard system alert in a
  // separate process — it is NOT in the app's page source (run 26332984454
  // LO01 dump: 3.4KB, no XCUIElementTypeAlert), so `~`/predicate finders never
  // see it. Drive it through the XCUITest alert API instead. Button labels
  // from the LO01 screenshot: "Allow Once" / "Allow While Using App" /
  // "Don't Allow".
  static get IOS_ALERT_ALLOW_WHILE_USING() { return 'Allow While Using App'; }
  // iOS renders the deny label with a typographic apostrophe (U+2019), not a
  // straight ' (run 26333525886 LO01: ["…","Allow While Using App","Don’t Allow"]).
  // `mobile: alert` button matching is exact, so this must be the curly form.
  static get IOS_ALERT_DENY() { return 'Don’t Allow'; }

  /** Button labels on the currently-shown alert (iOS), or [] if none. */
  async getDialogButtons() {
    if (this.isAndroid) return [];
    try {
      return await this.driver.execute('mobile: alert', { action: 'getButtons' });
    } catch {
      return [];
    }
  }

  async waitForDialog(timeout = 10000) {
    if (this.isAndroid) {
      await this.waitForDisplayed(this.allowWhileUsingBtn, timeout);
      return;
    }
    await this.driver.waitUntil(async () => await this.isDialogDisplayed(), {
      timeout, interval: 500, timeoutMsg: 'iOS location permission alert did not appear',
    });
  }

  async isDialogDisplayed() {
    if (this.isAndroid) return await this.isVisible(this.allowWhileUsingBtn);
    // getAlertText throws (no such alert) when none is present.
    try { await this.driver.getAlertText(); return true; } catch { return false; }
  }

  /**
   * Tap "While using the app" on the OS dialog. Single-dialog flow
   * (Location does NOT have a back-to-back second prompt like Camera).
   */
  async acceptWhileUsing() {
    await this.waitForDialog();
    if (this.isAndroid) {
      await (await this.driver.$(this.allowWhileUsingBtn)).click();
    } else {
      await this.driver.execute('mobile: alert', { action: 'accept', buttonLabel: LocationPage.IOS_ALERT_ALLOW_WHILE_USING });
    }
    await this.driver.pause(2000);
  }

  /**
   * Tap "Don't allow" on the OS dialog.
   */
  async denyLocation() {
    await this.waitForDialog();
    if (this.isAndroid) {
      await (await this.driver.$(this.denyBtn)).click();
    } else {
      // Resolve the live deny label so we tap the exact string regardless of
      // straight vs curly apostrophe across iOS versions; fall back to the
      // known curly form.
      const buttons = await this.getDialogButtons();
      const deny = buttons.find((b) => /^Don.t Allow$/.test(b)) || LocationPage.IOS_ALERT_DENY;
      await this.driver.execute('mobile: alert', { action: 'accept', buttonLabel: deny });
    }
    await this.driver.pause(1500);
  }

  // ── Tracking controls ────────────────────────────────────────────────

  /**
   * Tap Start Tracking and wait for the GPS fix to populate one history
   * entry. Dwell is calibrated against the emulator GPS mock; real
   * devices should respond within the same window.
   */
  async tapStartTracking() {
    // Defensive wait — without this, a millisecond-level cold-render race
    // surfaces as a cryptic "element wasn't found" instead of an honest
    // wait-then-fail with the timeout in the message.
    await this.waitForDisplayed(this.startTrackingBtn, 8000);
    await (await this.driver.$(this.startTrackingBtn)).click();
    await this.driver.pause(this.startDwellMs);
  }

  async tapStopTracking() {
    // Defensive wait — see tapStartTracking. The original bare click() is
    // what surfaced in CI run 25849810128 as "element wasn't found" when
    // TC-LO04 retried after a session reload had wiped TC-LO03's state.
    await this.waitForDisplayed(this.stopTrackingBtn, 8000);
    await (await this.driver.$(this.stopTrackingBtn)).click();
    await this.driver.pause(1000);
  }

  /**
   * Detect the current Location screen state. Used by callers that need
   * to self-recover from a session reload mid-spec (Playwright retries
   * an individual TC, not the whole describe — so cascade state is lost).
   *
   * Returns one of:
   *   'tracking' — Stop Tracking visible (mid-tracking)
   *   'idle'     — Start Tracking visible (granted, not yet tracking)
   *   'denied'   — permission denied banner visible
   *   'other'    — none of the above (probably off the Location screen)
   */
  async getCurrentState() {
    if (await this.isVisible(this.stopTrackingBtn)) return 'tracking';
    if (await this.isVisible(this.startTrackingBtn)) return 'idle';
    if (await this.isVisible(this.permissionDeniedText)) return 'denied';
    return 'other';
  }

  /**
   * One Start→dwell→Stop cycle that verifies a new history entry actually
   * landed. The emulator GPS mock occasionally fails to return a fix within
   * the Start dwell on cold sessions, producing a no-op cycle. Up to
   * `maxAttempts` retries are made; each retry re-extends the dwell.
   *
   * Bounded by a wall-clock budget: a single hung getPageSource() on a
   * struggling UIA2 instrumentation could otherwise consume the entire
   * 180s Playwright test budget, then the teardown's budget on top of
   * that (observed in CI run 25849810128 — 6min total before failure).
   * If `budgetMs` is exceeded the call fails fast with diagnostic; the
   * caller learns the cycle never converged rather than waiting for
   * Playwright's outer timeout to fire without context.
   *
   * Returns the new total visible entry count for the caller to assert.
   */
  /**
   * Race a driver call against a hard timeout. A hung UIA2 command (most
   * notably getPageSource, which has no internal timeout) would otherwise
   * block until Playwright's 180s test budget fires — long enough to starve
   * and crash the AVD's instrumentation, after which even reloadSession()
   * comes back dead and the failure cascades into every downstream spec.
   *
   * The setTimeout race does NOT cancel the underlying WDIO request; it just
   * frees this test thread so the cycle can fail fast and the fixture's
   * session recovery can reload a still-alive AVD. That's the whole point —
   * convert an unbounded hang into a bounded, catchable throw.
   */
  async _withTimeout(promise, ms, label) {
    let timer;
    const guard = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`[LocationPage] ${label} hung >${ms}ms`)), ms);
    });
    try {
      return await Promise.race([promise, guard]);
    } finally {
      clearTimeout(timer);
    }
  }

  async cycleStartStop({ maxAttempts = 2, budgetMs = 30000 } = {}) {
    const deadline = Date.now() + budgetMs;
    // Use the newest entry's key (not count) to detect a successful insert:
    // once the screen fold is full, adding a new entry pushes the oldest
    // off-viewport, leaving the visible count unchanged. The newest-key
    // always changes on a successful insert because the injected coords are
    // jittered per attempt (below), so the key varies independent of the
    // second-granularity timestamp.
    const before = await this._withTimeout(this.readVisibleHistory(), 15000, 'readVisibleHistory(before)');
    const beforeKey = before[0]?.key ?? null;
    const beforeLen = before.length;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (Date.now() > deadline) {
        throw new Error(`[LocationPage] cycleStartStop exceeded budget ${budgetMs}ms after ${attempt - 1} attempt(s); newest key unchanged at ${beforeKey}. Likely GPS mock not producing fixes on this device.`);
      }
      // NOTE: do NOT re-inject a fresh GPS fix here. The app logs exactly one
      // history entry per Start/Stop session *only while the location is
      // static*. A fix that changes mid-dwell (the system provider can take
      // seconds to propagate an injected coordinate) gets logged as a SECOND
      // entry, which breaks TC-LO05's "exactly 1 entry after one cycle"
      // contract (surfaced as LO05 Expected 1 / Received 2). The single
      // static warmup fix from gotoLocationFresh is sufficient; entries across
      // cycles stay distinct via their per-second timestamps.
      await this._withTimeout(this.tapStartTracking(), 25000, 'tapStartTracking');
      await this._withTimeout(this.tapStopTracking(), 20000, 'tapStopTracking');
      // Poll for the insert to register. A single immediate read races the
      // a11y-tree update: the entry has landed in the app but getPageSource
      // returns the pre-insert XML, so the key looks unchanged and the old
      // code spuriously retried — doing a SECOND Start/Stop that inserted a
      // SECOND entry. Harmless for LO04 (asserts ≥6) but broke LO05 (asserts
      // exactly 1 → got 2). Wait up to ~5s for either a key change (fold
      // full, oldest scrolled off) or a length increase (fold not yet full)
      // before concluding the cycle was a genuine GPS no-op and retrying.
      const settleDeadline = Date.now() + 5000;
      while (Date.now() < settleDeadline) {
        const after = await this._withTimeout(this.readVisibleHistory(), 15000, 'readVisibleHistory(after)');
        const afterKey = after[0]?.key ?? null;
        if ((afterKey && afterKey !== beforeKey) || after.length > beforeLen) return after.length;
        await this.driver.pause(500);
      }
      console.log(`[LocationPage] cycleStartStop attempt ${attempt}/${maxAttempts} did not insert an entry (newest key unchanged: ${beforeKey}); retrying`);
    }
    return before.length;
  }

  async tapOpenSettings() {
    await (await this.driver.$(this.openSettingsBtn)).click();
    await this.driver.pause(2000);
  }

  // ── History parsing ──────────────────────────────────────────────────

  /**
   * Match history entries in the page source. content-desc format:
   *   "<lat>, <lng>\n<HH:mm:ss>\n±<n>m"
   * XML-encoded newlines appear as &#10;.
   */
  static get HISTORY_ENTRY_REGEX() {
    return /content-desc="(-?\d+\.\d+, -?\d+\.\d+)&#10;(\d{2}:\d{2}:\d{2})&#10;±(\d+)m"/g;
  }

  /**
   * Parse history entries from the currently-rendered page source.
   * Returns entries in document order (newest first — LIFO display).
   * Only includes entries currently in the a11y tree (LazyColumn
   * virtualization may hide off-screen items). Use
   * collectAllHistoryEntries() for the full list.
   */
  async readVisibleHistory() {
    const xml = await this.driver.getPageSource();
    const out = [];
    const re = LocationPage.HISTORY_ENTRY_REGEX;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(xml)) !== null) {
      out.push({ coords: m[1], time: m[2], acc: m[3], key: `${m[2]}|${m[1]}|${m[3]}` });
    }
    return out;
  }

  /**
   * Scroll the history list from top to bottom, deduping entries by
   * `<time>|<coords>|<acc>` key. Returns entries sorted newest-first.
   * Stops when a scroll produces no new entries.
   */
  async collectAllHistoryEntries({ maxScrolls = 3 } = {}) {
    // The Location screen always loads at the top fold (Current Location
    // card visible), so no pre-scroll is needed. We swipe up only as far
    // as required to discover new entries, then restore with a single
    // swipe down so the header Back button is back in viewport.
    const seen = new Map();
    for (let s = 0; s <= maxScrolls; s++) {
      const entries = await this.readVisibleHistory();
      const before = seen.size;
      entries.forEach((e) => seen.set(e.key, e));
      if (s > 0 && seen.size === before) break;
      if (s < maxScrolls) await this._swipeUp();
    }
    await this.scrollHistoryToTop();
    return [...seen.values()].sort((a, b) => b.time.localeCompare(a.time));
  }

  // ── Scroll helpers ───────────────────────────────────────────────────

  async _swipeUp() {
    const { width, height } = await this.driver.getWindowRect();
    const x = Math.floor(width / 2);
    await this.driver.performActions([{
      type: 'pointer', id: 'f1', parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y: Math.floor(height * 0.75) },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 100 },
        { type: 'pointerMove', duration: 400, x, y: Math.floor(height * 0.35) },
        { type: 'pointerUp', button: 0 },
      ],
    }]);
    await this.driver.releaseActions();
    await this.driver.pause(500);
  }

  async _swipeDown() {
    const { width, height } = await this.driver.getWindowRect();
    const x = Math.floor(width / 2);
    await this.driver.performActions([{
      type: 'pointer', id: 'f1', parameters: { pointerType: 'touch' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y: Math.floor(height * 0.35) },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 100 },
        { type: 'pointerMove', duration: 400, x, y: Math.floor(height * 0.75) },
        { type: 'pointerUp', button: 0 },
      ],
    }]);
    await this.driver.releaseActions();
    await this.driver.pause(500);
  }

  /**
   * Restore the page to the top fold (Current Location card + header
   * Back visible). One downward swipe is sufficient because the history
   * fold is short — the test never scrolls far below the bottom fold.
   * Safe to call when already at top (no-op).
   */
  async scrollHistoryToTop() {
    await this._swipeDown();
  }

  // ── Foreground / reset ───────────────────────────────────────────────

  async getForegroundPackage() {
    if (!this.isAndroid) return '';
    return String(await this.driver.getCurrentPackage());
  }

  /**
   * Reset app data + relaunch so the next entry re-prompts the OS
   * Location dialog. Same `pm clear` pattern as Camera / Notifications:
   * the DemoApp tracks "have we asked?" in SharedPreferences, so
   * `pm reset-permissions` alone leaves the dialog suppressed.
   *
   * Side effect: wipes login → caller must re-authenticate.
   */
  async resetLocationPermission() {
    if (!this.isAndroid) return;
    await this.driver.execute('mobile: shell', {
      command: 'pm',
      args: ['clear', this.appPackage],
    });
    await this.driver.pause(2500);
    await this.driver.execute('mobile: shell', {
      command: 'am',
      args: ['start', '-W', '-n', `${this.appPackage}/.MainActivity`],
    });
    await this.driver.pause(1500);
  }
}

module.exports = { LocationPage };
