// @ts-check
const { BasePage } = require('./BasePage');

/**
 * NotificationsPage — POM for the Notifications module.
 * Covers: OS-level notification permission dialog, system/in-app notification
 * trigger buttons, and permission status display.
 */
class NotificationsPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    // ── Page Elements ──
    this.title = this.isAndroid
      ? 'android=new UiSelector().description("Notifications")'
      : '~Notifications';

    this.description = this.isAndroid
      ? 'android=new UiSelector().description("Test system and in-app notifications for automation.")'
      : '~notifications-description';

    // ── Permission Status / Result display ──
    // Shows the card status — value depends on dialog interaction state:
    //   - Default (no dialog shown / pre-granted): "No notifications sent yet"
    //   - After "Allow":  "Notification permission granted"
    //   - After "Don't allow": "Permission denied — notifications may not appear"
    this.noNotificationsYet = this.isAndroid
      ? 'android=new UiSelector().description("No notifications sent yet")'
      : '~no-notifications-yet';

    this.permissionGranted = this.isAndroid
      ? 'android=new UiSelector().description("Notification permission granted")'
      : '~notification-permission-granted';

    this.permissionDenied = this.isAndroid
      ? 'android=new UiSelector().description("Permission denied — notifications may not appear")'
      : '~notification-permission-denied';

    // ── Section Headers ──
    this.systemNotificationsHeader = this.isAndroid
      ? 'android=new UiSelector().description("System Notifications")'
      : '~system-notifications-header';

    this.inAppNotificationsHeader = this.isAndroid
      ? 'android=new UiSelector().description("In-App Notifications")'
      : '~in-app-notifications-header';

    // ── System Notification Buttons ──
    this.sendInstantBtn = this.isAndroid
      ? 'android=new UiSelector().description("Send Instant Notification")'
      : '~send-instant-notification';

    this.scheduleNotificationBtn = this.isAndroid
      ? 'android=new UiSelector().description("Schedule Notification (5 sec)")'
      : '~schedule-notification';

    // ── In-App Notification Buttons ──
    this.showBannerBtn = this.isAndroid
      ? 'android=new UiSelector().description("Show Banner Notification")'
      : '~show-banner-notification';

    this.showDialogBtn = this.isAndroid
      ? 'android=new UiSelector().description("Show Dialog Notification")'
      : '~show-dialog-notification';

    this.showSnackbarBtn = this.isAndroid
      ? 'android=new UiSelector().description("Show Snackbar Notification")'
      : '~show-snackbar-notification';

    // ── Notification Result Status Messages (card text) ──
    this.instantNotifSent = this.isAndroid
      ? 'android=new UiSelector().description("Instant notification sent!")'
      : '~instant-notification-sent';

    this.notifScheduled = this.isAndroid
      ? 'android=new UiSelector().description("Notification scheduled (5 seconds)...")'
      : '~notification-scheduled';

    this.inAppBannerShown = this.isAndroid
      ? 'android=new UiSelector().description("In-app banner shown!")'
      : '~in-app-banner-shown';

    this.bannerActionTapped = this.isAndroid
      ? 'android=new UiSelector().description("Banner action tapped!")'
      : '~banner-action-tapped';

    this.dialogNotifShown = this.isAndroid
      ? 'android=new UiSelector().description("In-app dialog shown!")'
      : '~in-app-dialog-shown';

    // Only OK changes the card status. LATER and scrim leave the card at
    // "In-app dialog shown!" — verified against UI dumps notif_09 / notif_10 / notif_11.
    this.dialogOkTapped = this.isAndroid
      ? 'android=new UiSelector().description("Dialog action tapped!")'
      : '~dialog-action-tapped';

    // Snackbar statuses (card text)
    this.snackbarShown = this.isAndroid
      ? 'android=new UiSelector().description("In-app snackbar shown!")'
      : '~in-app-snackbar-shown';

    this.snackbarActionTapped = this.isAndroid
      ? 'android=new UiSelector().description("Snackbar action tapped!")'
      : '~snackbar-action-tapped';

    // Snackbar toast (transient, ~4-5s auto-dismiss)
    this.snackbarToast = this.isAndroid
      ? 'android=new UiSelector().description("New message from DemoApp!")'
      : '~snackbar-toast';

    // Snackbar's VIEW button. Shares content-desc "VIEW" with the banner action,
    // but in TC-NT01 they appear at different steps (banner dismissed before
    // snackbar test). For overlap scenarios, anchor via fromParent on the
    // snackbar toast text.
    this.snackbarViewBtn = this.isAndroid
      ? 'android=new UiSelector().description("VIEW")'
      : '~snackbar-view';

    // ── In-App Banner Overlay ──
    // Appears after clicking "Show Banner Notification"
    this.inAppBanner = this.isAndroid
      ? 'android=new UiSelector().descriptionContains("You have a new in-app notification!")'
      : '~in-app-banner';

    this.dismissBannerBtn = this.isAndroid
      ? 'android=new UiSelector().description("DISMISS")'
      : '~dismiss-banner';

    this.viewBannerBtn = this.isAndroid
      ? 'android=new UiSelector().description("VIEW")'
      : '~view-banner';

    // ── In-App Dialog Notification ──
    // Appears after clicking "Show Dialog Notification"
    // Modal dialog with header, message, OK and LATER buttons
    this.inAppDialog = this.isAndroid
      ? 'android=new UiSelector().description("DemoApp")'
      : '~in-app-dialog';

    this.dialogLaterBtn = this.isAndroid
      ? 'android=new UiSelector().description("LATER")'
      : '~dialog-later';

    this.dialogOkBtn = this.isAndroid
      ? 'android=new UiSelector().description("OK")'
      : '~dialog-ok';

    // ── Native OS Notification Permission Dialog (PermissionController) ──
    // Triggered automatically on page load (Android 13+ / API 33+).
    // Uses the same PermissionController pattern as PermissionsPage.

    // "Allow" button — same resourceId as permissions generic allow
    this.allowNotificationBtn = this.isAndroid
      ? 'android=new UiSelector().resourceId("com.android.permissioncontroller:id/permission_allow_button")'
      : '~Allow';

    // "Don't allow" button — same resourceId pattern as permissions deny
    this.denyNotificationBtn = this.isAndroid
      ? 'android=new UiSelector().resourceIdMatches(".*permission_deny.*")'
      : "~Don't allow";
  }

  /**
   * Wait for the Notifications page to load.
   * Checks for the page title to be visible.
   * Note: On initial navigation, the permission dialog overlay will be showing,
   * but the page elements exist underneath. This method waits for the title
   * to confirm the page rendered.
   */
  async waitForPageLoad() {
    await this.waitForDisplayed(this.title);
  }

  /**
   * Wait for the native notification permission dialog to appear.
   * The dialog shows automatically on page load for Android 13+.
   */
  async waitForDialog() {
    await this.waitForDisplayed(this.allowNotificationBtn, 5000);
  }

  /**
   * Check if the notification permission dialog is currently displayed.
   * @returns {Promise<boolean>}
   */
  async isDialogDisplayed() {
    try {
      return await this.isVisible(this.allowNotificationBtn);
    } catch {
      return false;
    }
  }

  /**
   * Accept the notification permission dialog by tapping "Allow".
   * Waits for the dialog to appear, taps accept, then waits for dismissal.
   */
  async acceptNotificationPermission() {
    await this.waitForDialog();
    const btn = await this.driver.$(this.allowNotificationBtn);
    await btn.click();
    await this.driver.pause(1500);
  }

  /**
   * Deny the notification permission dialog by tapping "Don't allow".
   * Waits for the dialog to appear, taps deny, then waits for dismissal.
   */
  async denyNotificationPermission() {
    await this.waitForDialog();
    const btn = await this.driver.$(this.denyNotificationBtn);
    await btn.click();
    await this.driver.pause(1500);
  }

  /**
   * Reset app data and restart so the next navigation to Notifications
   * re-prompts the native OS dialog.
   *
   * Why pm clear (heavyweight) over pm reset-permissions:
   *   The DemoApp tracks "have we already asked for POST_NOTIFICATIONS?" in
   *   SharedPreferences. `pm reset-permissions` clears the OS-level grant +
   *   user_set/user_fixed flags, but does NOT touch app data — so the app
   *   suppresses the dialog on subsequent launches anyway. `pm clear` wipes
   *   SharedPreferences (and all other app data), forcing the app back to a
   *   true first-launch state where the dialog re-prompts. This is heavier
   *   than other modules' resets but the only reliable path for Notifications.
   */
  async resetNotificationPermission() {
    if (!this.isAndroid) return;
    await this.driver.execute('mobile: shell', {
      command: 'pm',
      args: ['clear', this.appPackage],
    });
    // Longer settle after pm clear — the tablet emulator races against the
    // package manager if we kick off `am start` too soon and the app ends up
    // behind the launcher (Pixel 8 was lucky on the shorter pause).
    await this.driver.pause(2500);
    // -W blocks until the activity is fully launched, eliminating the race
    // where `am start` returns success before the activity is foreground.
    await this.driver.execute('mobile: shell', {
      command: 'am',
      args: ['start', '-W', '-n', `${this.appPackage}/.MainActivity`],
    });
    await this.driver.pause(1500);
  }

  /**
   * Internal: throw if a selector is not currently visible.
   * @private
   */
  async _assertVisible(selector, label) {
    const visible = await this.isVisible(selector);
    if (!visible) throw new Error(`Expected "${label}" to be visible, but it was not.`);
  }

  /**
   * Internal: throw if a selector IS currently visible.
   * @private
   */
  async _assertHidden(selector, label) {
    const visible = await this.isVisible(selector);
    if (visible) throw new Error(`Expected "${label}" to be hidden, but it was visible.`);
  }

  /**
   * Run the full trigger-exercise sequence (5 buttons × associated assertions).
   * Shared between TC-NT01 (Allowed) and TC-NT02 (Not Allowed) — the UI side of
   * each button updates the card identically regardless of OS permission state;
   * the only OS-permission-gated side effect is the actual system tray
   * notification, which native automation cannot observe.
   *
   * Sequence:
   *  1. Send Instant         → card "Instant notification sent!"
   *  2. Schedule             → card "Notification scheduled (5 seconds)..."
   *  3. Show Banner          → overlay + card "In-app banner shown!"
   *  4. Banner DISMISS       → overlay gone, card unchanged
   *  5. Show Banner again    → VIEW → card "Banner action tapped!"
   *  6. Show Dialog          → modal + LATER → modal gone, card "In-app dialog shown!"
   *  7. Show Dialog again    → OK → modal gone, card "Dialog action tapped!"
   *  8. Show Snackbar        → toast "New message from DemoApp!" + card "In-app snackbar shown!"
   *  9. Snackbar VIEW        → card "Snackbar action tapped!"
   *
   * In-app dialog removes background nodes from the a11y tree while open
   * (verified via UI dump notif_08_dialog_open.xml); card status checks for
   * dialog-related state happen only after dismissal.
   */
  async exerciseAllTriggers() {
    // 1. Send Instant Notification
    await this.driver.$(this.sendInstantBtn).click();
    await this.driver.pause(1000);
    await this._assertVisible(this.instantNotifSent, 'card: Instant notification sent!');

    // 2. Schedule Notification
    await this.driver.$(this.scheduleNotificationBtn).click();
    await this.driver.pause(1000);
    await this._assertVisible(this.notifScheduled, 'card: Notification scheduled');

    // 3. Show Banner → DISMISS (card unchanged)
    await this.driver.$(this.showBannerBtn).click();
    await this.driver.pause(1000);
    await this._assertVisible(this.inAppBannerShown, 'card: In-app banner shown!');
    await this._assertVisible(this.inAppBanner, 'banner overlay');
    await this._assertVisible(this.dismissBannerBtn, 'banner DISMISS button');
    await this._assertVisible(this.viewBannerBtn, 'banner VIEW button');

    await this.driver.$(this.dismissBannerBtn).click();
    await this.driver.pause(1000);
    await this._assertHidden(this.inAppBanner, 'banner overlay (after DISMISS)');
    await this._assertVisible(this.inAppBannerShown, 'card: In-app banner shown! (unchanged after DISMISS)');

    // 4. Show Banner again → VIEW
    await this.driver.$(this.showBannerBtn).click();
    await this.driver.pause(1000);
    await this._assertVisible(this.inAppBanner, 'banner overlay (re-trigger)');

    await this.driver.$(this.viewBannerBtn).click();
    await this.driver.pause(1000);
    await this._assertVisible(this.bannerActionTapped, 'card: Banner action tapped!');
    await this._assertHidden(this.inAppBanner, 'banner overlay (after VIEW)');

    // 5. Show Dialog → LATER (no card change; still "In-app dialog shown!")
    await this.driver.$(this.showDialogBtn).click();
    await this.driver.pause(1000);
    await this._assertVisible(this.inAppDialog, 'in-app dialog modal');
    await this._assertVisible(this.dialogOkBtn, 'dialog OK button');
    await this._assertVisible(this.dialogLaterBtn, 'dialog LATER button');

    await this.driver.$(this.dialogLaterBtn).click();
    await this.driver.pause(1000);
    await this._assertHidden(this.inAppDialog, 'in-app dialog (after LATER)');
    await this._assertVisible(this.dialogNotifShown, 'card: In-app dialog shown! (unchanged after LATER)');

    // 6. Show Dialog again → OK (card → "Dialog action tapped!")
    await this.driver.$(this.showDialogBtn).click();
    await this.driver.pause(1000);
    await this._assertVisible(this.inAppDialog, 'in-app dialog modal (re-trigger)');

    await this.driver.$(this.dialogOkBtn).click();
    await this.driver.pause(1000);
    await this._assertHidden(this.inAppDialog, 'in-app dialog (after OK)');
    await this._assertVisible(this.dialogOkTapped, 'card: Dialog action tapped!');

    // 7. Show Snackbar → VIEW (toast is transient; no intermediate pause before tap)
    await this.driver.$(this.showSnackbarBtn).click();
    await this.waitForDisplayed(this.snackbarToast, 3000);
    await this._assertVisible(this.snackbarShown, 'card: In-app snackbar shown!');
    await this._assertVisible(this.snackbarToast, 'snackbar toast');

    await this.driver.$(this.snackbarViewBtn).click();
    await this.driver.pause(1000);
    await this._assertVisible(this.snackbarActionTapped, 'card: Snackbar action tapped!');
  }
}

module.exports = { NotificationsPage };
