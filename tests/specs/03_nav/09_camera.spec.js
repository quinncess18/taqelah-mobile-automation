// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { LoginPage } = require('../../pages/LoginPage');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');
const { CameraPage } = require('../../pages/CameraPage');

/**
 * Camera Suite — two pm clear resets only:
 *   1. Before the Granted-path describe (TC-CM01–CM04) — grant once, cascade.
 *   2. Before the Denied-path describe (TC-CM05–CM07) — deny inline as each
 *      TC's flow requires.
 *
 * pm clear is heavyweight (wipes login + SharedPreferences flag that
 * suppresses the dialog), so calling it per-test would burn ~20s of overhead
 * across the suite. Cascading inside each describe is safe because the TCs
 * are explicitly ordered and the in-screen state transitions are deterministic.
 *
 * No API-specific branching in dialog handling — both local (API 35) and CI
 * (API 34) use the same PermissionController button resource-ids (foreground-
 * only, deny). API 29 fallbacks aren't needed for this module.
 */

/**
 * pm clear + relaunch + re-login + open nav drawer + nav to Camera.
 * Leaves the OS Camera dialog on screen.
 */
async function gotoCameraFresh(driver) {
  const loginPage = new LoginPage(driver);
  const landingPage = new CatalogLandingPage(driver);
  const navMenu = new NavMenuPage(driver);
  const cameraPage = new CameraPage(driver);

  await cameraPage.resetCameraPermission();

  await loginPage.waitForDisplayed(loginPage.loginButton, 10000);
  await loginPage.login(loginPage.defaultUser, loginPage.defaultPass);
  await landingPage.waitForDisplayed(landingPage.shopAllBtn, 10000);

  await navMenu.open();
  await navMenu.navigateTo(navMenu.navCamera);

  return cameraPage;
}

test.describe('Navigation - Camera Suite — Granted Path (TC-CM01-CM04)', () => {
  let cameraPage;
  // Single-camera environments (GHA CI's Pixel 6 AVD) omit the flip widget.
  // Probed once after live-preview renders; consumed by CM01/CM03 (conditional
  // assertion) and CM04 (skip when absent).
  let flipAvailable;

  test.beforeAll(async ({ driver }) => {
    cameraPage = await gotoCameraFresh(driver);
    // One-time grant for the whole group — both Camera + Audio dialogs.
    await cameraPage.acceptCameraAndAudio();
    // CI emulator may inject the "Entering camera mode" overlay on entry
    // (not only on first flip). No-op on real devices and on emulators where
    // the modal isn't surfaced.
    await cameraPage.dismissEmulatorTutorialIfPresent();
    await cameraPage.waitForLivePreview();
    flipAvailable = await cameraPage.hasFlipButton();
  });

  test('TC-CM01: should reveal the live preview with shutter (and flip when device exposes a front camera) after granting Camera + Audio', async () => {
    expect(await cameraPage.isVisible(cameraPage.backBtn)).toBe(true);
    expect(await cameraPage.isVisible(cameraPage.screenTitle)).toBe(true);
    expect(await cameraPage.isVisible(cameraPage.shutterBtn)).toBe(true);
    if (flipAvailable) {
      expect(await cameraPage.isVisible(cameraPage.flipBtn)).toBe(true);
    }

    // Denial-state markers must NOT be present after a grant.
    expect(await cameraPage.isVisible(cameraPage.permissionDeniedText)).toBe(false);
    expect(await cameraPage.isVisible(cameraPage.openSettingsBtn)).toBe(false);
  });

  test('TC-CM02: should tap shutter and show "Photo Captured!" chip plus a "Photo saved: CAP<digits>.jpg" toast', async ({ driver }) => {
    await cameraPage.tapShutter();

    const chipVisible = await cameraPage.isVisible(cameraPage.photoCapturedChip);
    expect(chipVisible).toBe(true);

    // Toast is transient (~3-4s in a11y tree). Filename is non-deterministic.
    const toastEl = await driver.$(cameraPage.photoSavedToast);
    await toastEl.waitForDisplayed({ timeout: 4000 });
    const toastDesc = String(await toastEl.getAttribute('content-desc'));
    expect(toastDesc).toMatch(/^Photo saved: CAP\d+\.jpg$/);
  });

  test('TC-CM03: should return from captured-photo state to live preview when tapping the in-screen back-arrow', async () => {
    // Cascade: end of TC-CM02 left us on the captured state.
    expect(await cameraPage.isVisible(cameraPage.photoCapturedChip)).toBe(true);

    await cameraPage.tapBackArrow();

    expect(await cameraPage.isVisible(cameraPage.photoCapturedChip)).toBe(false);
    expect(await cameraPage.isVisible(cameraPage.shutterBtn)).toBe(true);
    if (flipAvailable) {
      expect(await cameraPage.isVisible(cameraPage.flipBtn)).toBe(true);
    }
  });

  test('TC-CM04: should tap the flip-camera button without crashing and keep the live preview UI intact', async () => {
    test.skip(!flipAvailable, 'Single-camera environment: flip widget not rendered (DemoApp omits it when no front camera is exposed, e.g. GHA-hosted Pixel 6 AVD).');

    // The Flutter preview is a SurfaceView with no a11y nodes; we can't observe
    // the sensor swap directly. Strongest signal we can reliably assert is
    // "button is wired + UI doesn't regress". On the Android Studio emulator,
    // first flip-to-front injects an "Entering camera mode" tutorial overlay —
    // not part of the DemoApp; dismissed pre- and post-tap as env hygiene so
    // CI runs and real-device runs share the same code path.
    await cameraPage.dismissEmulatorTutorialIfPresent();
    await cameraPage.tapFlip();
    await cameraPage.dismissEmulatorTutorialIfPresent();

    expect(await cameraPage.isVisible(cameraPage.shutterBtn)).toBe(true);
    expect(await cameraPage.isVisible(cameraPage.flipBtn)).toBe(true);
    expect(await cameraPage.isVisible(cameraPage.permissionDeniedText)).toBe(false);
  });
});

test.describe('Navigation - Camera Suite — Denied Path (TC-CM05-CM07)', () => {
  let cameraPage;

  test.beforeAll(async ({ driver }) => {
    cameraPage = await gotoCameraFresh(driver);
    // Dialog is on screen; first TC handles the first deny.
  });

  test('TC-CM05: should show "Camera permission denied" + "Open Settings" after a single dialog deny', async () => {
    // Wait (don't single-shot) for the OS dialog — on fresh entry it lags the
    // Flutter permission request by 1-2s. Single-shot isVisible flaked here.
    expect(await cameraPage.waitForDialogDisplayed(10000)).toBe(true);
    await cameraPage.denyCamera();
    await cameraPage.waitForDeniedState();

    expect(await cameraPage.isVisible(cameraPage.permissionDeniedText)).toBe(true);
    expect(await cameraPage.isVisible(cameraPage.openSettingsBtn)).toBe(true);
  });

  test('TC-CM06: should suppress the OS dialog after a second deny and remain on the denied state on re-entry (permanent denial)', async ({ driver }) => {
    const navMenu = new NavMenuPage(driver);

    // Cascade: TC-CM05 already performed deny #1. Leave + re-enter for deny #2.
    await driver.$(cameraPage.backBtn).click();
    await driver.pause(1000);
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navCamera);

    await cameraPage.waitForDialog();
    await cameraPage.denyCamera();
    await cameraPage.waitForDeniedState();

    // 3rd entry — the dialog must NOT appear (permanent denial).
    await driver.$(cameraPage.backBtn).click();
    await driver.pause(1000);
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navCamera);
    await cameraPage.waitForDeniedState();

    expect(await cameraPage.isDialogDisplayed()).toBe(false);
    expect(await cameraPage.isVisible(cameraPage.permissionDeniedText)).toBe(true);
    expect(await cameraPage.isVisible(cameraPage.openSettingsBtn)).toBe(true);
  });

  test('TC-CM07: should deep-link to Android Settings when "Open Settings" is tapped from the denied state', async ({ driver }) => {
    // Cascade: TC-CM06 ended on the permanently-denied screen.
    expect(await cameraPage.isVisible(cameraPage.openSettingsBtn)).toBe(true);

    await cameraPage.tapOpenSettings();

    const pkg = await cameraPage.getForegroundPackage();
    expect(pkg).toBe('com.android.settings');

    // Press device Back to leave Settings so we don't poison any later spec.
    await driver.back();
    await driver.pause(1000);
  });
});
