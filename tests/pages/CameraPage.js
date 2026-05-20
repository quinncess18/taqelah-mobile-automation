// @ts-check
const { BasePage } = require('./BasePage');

/**
 * CameraPage — POM for the Camera module.
 *
 * Permission flow on entry: Camera dialog → (if granted) Audio dialog → Camera screen.
 * Denying Camera shortcuts the flow: no Audio dialog appears.
 *
 * Camera screen states:
 *   - Live preview: header + shutter (large center View) + flip (Button, right)
 *   - Captured photo: header + "Photo Captured!" chip + branded image +
 *     transient toast "Photo saved: CAP<digits>.jpg" + back-arrow (left Button)
 *     that returns to live preview
 *   - Denied: header + "Camera permission denied" text + "Open Settings" button
 *
 * The bottom buttons (shutter / flip / back-arrow) are Flutter canvas widgets
 * with NAF=true and no content-desc / resource-id. They are selected via
 * className + clickable + empty-description (and per-state instance index),
 * which is the most stable handle that doesn't fall back to coordinate taps.
 */
class CameraPage extends BasePage {
  /**
   * @param {import('webdriverio').Browser} driver
   */
  constructor(driver) {
    super(driver);

    // ── Page header ──
    this.screenTitle = this.isAndroid
      ? 'android=new UiSelector().description("Camera")'
      : '~Camera';

    // ── Live preview state ──
    // The Flutter camera widgets are NAF=true with no content-desc / resource-id
    // attribute set at all (description("") doesn't match because the attribute
    // is absent, not empty). The most stable handle is clickable-instance order
    // in the a11y tree:
    //   instance(0) = header Back (content-desc "Back")
    //   instance(1) = shutter View      (NAF, live state only)
    //   instance(2) = flip Button       (NAF, both states)
    // Captured state replaces the centered shutter with a left-side back-arrow
    // at the same instance(1) position.
    this.shutterBtn = this.isAndroid
      ? 'android=new UiSelector().clickable(true).instance(1)'
      : '~camera-shutter';

    this.flipBtn = this.isAndroid
      ? 'android=new UiSelector().clickable(true).instance(2)'
      : '~camera-flip';

    // ── Captured state ──
    this.photoCapturedChip = this.isAndroid
      ? 'android=new UiSelector().description("Photo Captured!")'
      : '~photo-captured';

    // Toast message — transient, observable in a11y tree for ~3-4s post-shutter.
    // Filename is non-deterministic (CAP<digits>.jpg) so we anchor on the prefix.
    this.photoSavedToast = this.isAndroid
      ? 'android=new UiSelector().descriptionStartsWith("Photo saved: CAP")'
      : '~photo-saved-toast';

    // The header Back arrow has context-aware behavior: in the captured state
    // it returns to live preview (intra-screen navigation); in the live state
    // it exits the Camera screen entirely. TC-CM03 exercises the
    // captured→live transition by tapping the header Back. (The in-screen
    // left NAF button at the bottom is something else — likely
    // retake/delete — and is not part of our coverage.)
    this.backArrowBtn = this.backBtn;

    // ── Denied state ──
    this.permissionDeniedText = this.isAndroid
      ? 'android=new UiSelector().description("Camera permission denied")'
      : '~camera-permission-denied';

    this.openSettingsBtn = this.isAndroid
      ? 'android=new UiSelector().description("Open Settings")'
      : '~open-settings';

    // ── Native OS Permission Dialog (PermissionController) ──
    // Same controller as Permissions / Notifications modules.
    this.allowWhileUsingBtn = this.isAndroid
      ? 'android=new UiSelector().resourceId("com.android.permissioncontroller:id/permission_allow_foreground_only_button")'
      : '~While using the app';

    this.allowOneTimeBtn = this.isAndroid
      ? 'android=new UiSelector().resourceId("com.android.permissioncontroller:id/permission_allow_one_time_button")'
      : '~Only this time';

    this.denyBtn = this.isAndroid
      ? 'android=new UiSelector().resourceIdMatches(".*permission_deny.*")'
      : "~Don't allow";

    // ── Emulator-injected "Entering camera mode" tutorial ──
    // Appears on first flip-to-front-camera on Android Studio emulators. NOT a
    // DemoApp UI element; on real devices this modal never appears.
    this.emulatorTutorialGotItBtn = this.isAndroid
      ? 'android=new UiSelector().textMatches("(?i)Got [Ii]t")'
      : '~Got It';

    this.emulatorTutorialCheckbox = this.isAndroid
      ? 'android=new UiSelector().textContains("Don") .className("android.widget.CheckBox")'
      : '~dont-remind-again';
  }

  async waitForPageLoad() {
    // Anchor only on the screen title — the universal element across all
    // Camera states (live preview, captured, denied). State-specific widgets
    // get their own waits (waitForLivePreview / waitForDeniedState) so a
    // denied-path entry doesn't hang waiting for shutter/flip that will
    // never appear.
    await this.waitForDisplayed(this.screenTitle, 15000);
  }

  /**
   * Wait for the live-preview state to render. Anchors on title + shutter only.
   *
   * Flip-button presence is environment-dependent: the DemoApp omits the flip
   * widget on single-camera devices, which is the case on the GHA-hosted Pixel
   * 6 AVD (back-camera-only). Local Pixel 8 + Pixel Tablet both expose front +
   * back. Callers that care about flip should consult `hasFlipButton()` and
   * either assert conditionally or skip.
   */
  async waitForLivePreview() {
    await this.waitForDisplayed(this.screenTitle, 15000);
    await this.waitForDisplayed(this.shutterBtn, 15000);
  }

  /**
   * Short-poll probe for the flip-camera widget. Returns true on multi-camera
   * environments (local emulators, real devices); false on single-camera
   * environments (GHA CI emulator).
   */
  async hasFlipButton() {
    try {
      const el = await this.driver.$(this.flipBtn);
      await el.waitForDisplayed({ timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for the denied state to render. Use after a Camera deny.
   */
  async waitForDeniedState() {
    await this.waitForDisplayed(this.screenTitle, 15000);
    await this.waitForDisplayed(this.permissionDeniedText, 10000);
    await this.waitForDisplayed(this.openSettingsBtn, 10000);
  }

  /**
   * Wait for the native Camera permission dialog to appear.
   */
  async waitForDialog(timeout = 5000) {
    await this.waitForDisplayed(this.allowWhileUsingBtn, timeout);
  }

  async isDialogDisplayed() {
    return await this.isVisible(this.allowWhileUsingBtn);
  }

  /**
   * Wait up to `timeout` for the native permission dialog and return whether it
   * appeared. Use this — NOT the single-shot isDialogDisplayed — when asserting
   * the dialog showed after a cold/fresh screen entry. On a fresh Camera entry
   * the OS dialog can lag the Flutter permission request by 1-2s, so a
   * single-shot isVisible races it (TC-CM05 flaked at 190ms on a clean Pixel 8
   * run, passed at 2.2s on rerun). isDialogDisplayed stays single-shot for the
   * fast leftover-dialog guard in acceptCameraAndAudio where waiting is wrong.
   */
  async waitForDialogDisplayed(timeout = 10000) {
    try {
      await this.waitForDialog(timeout);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Accept the Camera permission flow — taps "While using the app" on the
   * Camera dialog, then on the back-to-back Audio dialog. Both dialogs use
   * the same PermissionController layout.
   *
   * Audio-dialog wait is 10s (was 5s) because CI's API 34 emulator on the
   * GHA runner takes noticeably longer between Camera-grant and Audio-prompt
   * than local API 35 does. After accepting, polls for screen-title render
   * up to 5s — covers cases where the controller's dismiss animation outlasts
   * the fixed pause.
   */
  async acceptCameraAndAudio() {
    // 1. Camera dialog.
    await this.waitForDialog();
    await (await this.driver.$(this.allowWhileUsingBtn)).click();
    await this.driver.pause(1500);

    // 2. Audio dialog — slower CI emulators can take 5-10s to surface this.
    try {
      const audioBtn = await this.driver.$(this.allowWhileUsingBtn);
      await audioBtn.waitForDisplayed({ timeout: 10000 });
      await audioBtn.click();
      await this.driver.pause(2500);
    } catch {
      // No audio dialog (Audio already granted from a prior session) — fine.
    }

    // 3. Guard: if any dialog is still on-screen (timing race or unexpected
    // third prompt), give it one more accept attempt before handing back.
    try {
      if (await this.isDialogDisplayed()) {
        await (await this.driver.$(this.allowWhileUsingBtn)).click();
        await this.driver.pause(2000);
      }
    } catch {
      // Dialog gone — fine.
    }
  }

  /**
   * Deny the Camera permission dialog — taps "Don't allow". The Audio dialog
   * never appears after a Camera deny, so this is a single tap.
   */
  async denyCamera() {
    await this.waitForDialog();
    const btn = await this.driver.$(this.denyBtn);
    await btn.click();
    await this.driver.pause(1500);
  }

  async tapShutter() {
    await (await this.driver.$(this.shutterBtn)).click();
    // Captured state should appear within ~1s; toast follows shortly after.
    await this.driver.pause(800);
  }

  async tapBackArrow() {
    await (await this.driver.$(this.backArrowBtn)).click();
    await this.driver.pause(this.settlePause);
  }

  async tapFlip() {
    await (await this.driver.$(this.flipBtn)).click();
    await this.driver.pause(this.settlePause);
  }

  async tapOpenSettings() {
    await (await this.driver.$(this.openSettingsBtn)).click();
    await this.driver.pause(2000);
  }

  /**
   * Detect the emulator-injected "Entering camera mode" tutorial that appears
   * on first flip-to-front-camera, dismiss it (ticking "Don't remind again"),
   * and return. No-op when the modal isn't present (real device, or already
   * dismissed in a prior run — the emulator persists the preference).
   *
   * The modal is part of the Android emulator's pose-camera UI, NOT the
   * DemoApp. We dismiss it as setup; it isn't a testable artifact.
   */
  async dismissEmulatorTutorialIfPresent() {
    if (!this.isAndroid) return;
    try {
      const gotIt = await this.driver.$(this.emulatorTutorialGotItBtn);
      if (!(await gotIt.isDisplayed())) return;
    } catch {
      return;
    }
    // Tick "Don't remind again" first so future flips don't re-prompt.
    try {
      const cb = await this.driver.$(this.emulatorTutorialCheckbox);
      if (await cb.isDisplayed()) {
        await cb.click();
        await this.driver.pause(300);
      }
    } catch {
      // Checkbox shape varies across emulator builds — best-effort.
    }
    try {
      await (await this.driver.$(this.emulatorTutorialGotItBtn)).click();
      await this.driver.pause(500);
    } catch {
      // Got It already dismissed in the race — fine.
    }
  }

  /**
   * Return the foreground app's package name. Used by the Open Settings TC to
   * verify the intent fired and Android Settings is now in focus.
   */
  async getForegroundPackage() {
    if (!this.isAndroid) return '';
    return String(await this.driver.getCurrentPackage());
  }

  /**
   * Reset app data + relaunch so the next entry re-prompts the Camera dialog.
   *
   * Same rationale as NotificationsPage.resetNotificationPermission(): the
   * DemoApp tracks "have we asked for CAMERA?" in SharedPreferences, so
   * `pm reset-permissions` alone leaves the dialog suppressed across runs.
   * `pm clear` wipes the SharedPreferences flag and forces a true cold launch.
   *
   * Side effect: wipes login → caller must re-authenticate.
   */
  async resetCameraPermission() {
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

module.exports = { CameraPage };
