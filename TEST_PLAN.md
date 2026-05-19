# TEST_PLAN.md

Defines the test coverage and verification strategy for the Taqelah mobile application.

**Current scope:** Android emulators — Pixel 8 (API 35, local) + Pixel Tablet (API 35, local) for full coverage; CI runs Pixel 6 profile at API 34 (Android 14, google_apis target). 82 TCs across 17 sections verified on local Pixel 8 + Tablet (§0 Smoke, §1–§14 unit modules, §15 Checkout, §16 Regression). §0 Smoke runs first as a foundation gate (~30s), §16 Regression runs last as a deep cross-module E2E. CI on API 34 with `retries: 2` to absorb emulator flake.

**iOS:** Simulator path live on GHA `macos-14` (iPhone 15, iOS 17.5) for §0 smoke; expansion to full module coverage pending selector iteration. Real-device path (BrowserStack/Sauce) parked — requires a device-signed `.ipa` not currently published.

> Status legend: ✅ Verified · ⚠️ Under investigation · ⏳ Pending · — Not applicable

## API Compatibility Matrix

Each module's supported Android API range is an explicit contract. A new module declares its minimum API and rationale; existing modules note any version-specific tuning or constraint that gates them. Tests outside a module's range MUST `test.skip` with a clear reason.

| Module | Min API | Max API tested | Rationale / Constraint |
|---|---|---|---|
| Auth (01) | 29 | 35 | No version-gated APIs. |
| Catalog (02) | 29 | 35 | No version-gated APIs. |
| Nav Main (03/01) | 29 | 35 | No version-gated APIs. |
| Gestures (03/02) | 29 | 35 | Pinch detection unified phone+tablet via dense-scan pixel count (2026-05-12). |
| WebView (03/03) | 29 | 35 | DemoApp builds without `WebContentsDebuggingEnabled` — DOM verification unavailable across all versions. |
| Dialogs (03/04) | 29 | 35 | Time Picker dial canvas tap-anchored selectors work across versions. |
| Form Validation (03/05) | 29 | 35 | Each TC self-resets via back+re-enter (2026-05-12); no cascade fragility. |
| Permissions (03/06) | 29 | 35 | API-29 fallbacks retained (AOSP "Don't ask again" checkbox, generic Allow); inactive on API 33+ via try/catch gating. |
| **Notifications (03/07)** | **33** | **35** | `POST_NOTIFICATIONS` is API 33+ only. Tests would all `waitForDialog` timeout on API ≤ 32. CI MUST run API 33+ for this module to verify. |
| Tabs & Navigation (03/08) | 29 | 35 | No version-gated APIs. Pager swipe geometry (`y = height * 0.55`) works on phone + tablet without branching. |
| Camera (03/09) | 30 | 35 | Uses Android 11+ "While using the app" permission dialog (`permission_allow_foreground_only_button`). API 29 fallbacks not retained — the DemoApp's Camera screen targets the modern foreground-only model. |
| **Location (03/10)** | 29 | 35 | No version-gated dialog widgets. **Pixel Tablet AVD skipped at runtime** (`width > 1200` → `test.skip`) — emulator-5556's GPS provider does not emit fixes within practical timeouts, so the Current Location card never renders even with OS permission granted. Module is Pixel 8 + CI Pixel 6 only until `mobile: setGeoLocation` injection or real-device cloud is wired. |
| **Dark Mode (03/11)** | 29 | 35 | No version-gated widgets. Cross-cutting smoke that visits every previously-tested page in dark mode and validates AppBar background via 3-spot pixel sampling. Location step is skipped on Pixel Tablet only (inherits 10/Location's GPS limitation). |
| **Products + Search (04/01)** | 29 | 35 | No version-gated widgets. Pixel Tablet runs in **forced portrait** — orientation lock applied AFTER login via `mobile: shell` + `settings put system user_rotation 1`. Without rotation, Pixel Tablet's natural landscape (2560×1600) makes product cards taller than the viewport and NAF add-to-cart child Buttons don't enter the a11y tree. W3C `setOrientation` is a no-op on UIA2. No orientation revert in `afterAll` — Cart (04/02) chains off this state. |
| **Cart (04/02)** | 29 | 35 | No version-gated widgets. Chains off Products' end-state (7-line cart, portrait lock inherited). `collectAllLines()` walks the cart ScrollView on phone (Compose virtualises rows past viewport); no-ops on tablet portrait where all 7 fit. Per-line NAF Buttons (Minus/Plus/Delete) resolved via direct `.click()` on line ImageView's Button children in DOM order — sidesteps the duplicate content-desc issue with PD02 color variants and the per-device coordinate-offset problem. Cart's `afterAll` reverts tablet to landscape at end of chain. |
| **Checkout (04/03)** | 29 | 35 | No version-gated widgets. Chains off Cart's empty-state via Continue Shopping → Boho grid → `clearSearch()`. Adds 2–3 distinct random items via the Detail-page add path (the grid card direct-add icon collided with the Material snackbar's VIEW CART overlay on bottom-of-grid cards — reliable across runs only via Detail). Shipping fields are 7 NAF EditTexts at positional `instance(0–6)` wrapped in `UiScrollable.scrollIntoView`. Review Order line items are `View + descriptionContains("Qty:")` (different class than Cart's `ImageView` lines). Pixel Tablet verification pending. |

**Operating contract:**
- Adding a new module → declare its min API + reason. If hardware-feature-gated, document the workaround.
- Bumping CI's API level → audit this matrix. Any module's lower bound that now exceeds CI's API is a hard skip; lower bound that now exceeds local is a regression risk.
- Migration history: CI was on API 29 prior to 2026-05-11; Notifications could not run there. Migration to API 34 unblocked Notifications and required tuning in Permissions (back-to-back dialog wait), Gestures (canvas sampling), Form (toast timing) — see CLAUDE.md.

## iOS Coverage Matrix

Tracks per-module iOS Simulator status. Mirrors the Android matrix structure. Specs are shared cross-platform (one POM per screen, selectors branch via `this.isAndroid` / `this.isIOS`); the work per module is selector verification against the live a11y tree, not new spec files.

**Platform contract:**
- **Min iOS:** 17.5 (the runtime preinstalled on `macos-14` GHA runners; `xcrun simctl list devices` confirms availability).
- **Device:** iPhone 15 Simulator. iPad target pending — added once iPhone coverage stabilizes to avoid double-iterating selectors.
- **Driver:** Appium XCUITest 7.x (pinned for Appium 2.19 server compatibility — see `mobile-automation.yml`).
- **App binary:** `apps/DemoApp-v1.0.0.app/` (Simulator build from `taqelah/demo-app` release v1.0.0; universal x86_64+arm64, `iphonesimulator` SDK, no provisioning profile). Real-device path (BrowserStack/Sauce) parked until a device-signed `.ipa` is published.
- **Selector strategy:** Flutter `Key('X')` does NOT propagate to iOS `accessibilityIdentifier`. Reliable iOS selectors are `~<name>` (matches `accessibilityIdentifier` first, falls back to `name`/`label`), `-ios predicate string:...`, or `-ios class chain:...`. Predicates verified against diagnostic XML dumps (`_iosFailureDiagnostic` fixture in `fixtures/appFixture.js`).

> Status legend: ✅ Verified · ⚠️ In progress · ⏳ Pending · ⏭ Skipped (iOS-incompatible)

| Module | iPhone 15 | Notes |
|---|---|---|
| §0 Smoke | ⚠️ | In progress. Login title (`~DemoApp`) + Login button (`~Login`) verified. Username/Password fields fixed (`~Username` / `~Password`) commit c354e1d. Next: drawer logout, Catalog Landing's `shopAllBtn`. |
| §1 Auth (01) | ⏳ | Inherits LoginPage selectors from §0. Adds error-message + password-toggle iOS branches (currently `~error-message` / `~toggle-password` — unverified; predicate/class-chain likely needed for toggle). |
| §2 Catalog (02) | ⏳ | First cross-screen work. CatalogLandingPage + categories iOS branches all unverified. |
| §3 Nav Main (03/01) | ⏳ | Drawer iOS branches unverified (logout button surfaces in §0 first). |
| §3 Gestures (03/02) | ⏳ | Pinch/swipe should work via XCUITest W3C actions; canvas pixel sampling may need tuning for Retina (2× / 3× scale). |
| §3 WebView (03/03) | ⏳ | WKWebView vs Android WebView — content-only assertions (Example Domain text) should port. |
| §3 Dialogs (03/04) | ⏳ | iOS Alert / ActionSheet have different a11y types than Android dialog widgets. Expect significant branch divergence. |
| §3 Form (03/05) | ⏳ | TextField positional `instance()` selectors don't exist on iOS — rebuild via `~labelText` matches. |
| §3 Permissions (03/06) | ⏭ | iOS permission dialogs are system-level (springboard alerts), fundamentally different from Android runtime permissions. Port required, not adapt. |
| §3 Notifications (03/07) | ⏭ | iOS notification model + permission UX differs; Simulator handles APNS differently. Defer. |
| §3 Tabs (03/08) | ⏳ | Compose-style pager — iOS equivalent should expose tabs via `XCUIElementTypeTabBar` or similar. |
| §3 Camera (03/09) | ⏭ | iOS Simulator has no camera. Stub or skip via runtime probe. |
| §3 Location (03/10) | ⏳ | Use `xcrun simctl set <udid> location lat,lng` to inject fixes. iOS location-permission dialog is a separate spec branch. |
| §3 Dark Mode (03/11) | ⏳ | iOS dark mode toggles via system Appearance setting; in-app switch should still work. Pixel sampling tolerances may differ. |
| §4 Products (04/01) | ⏳ | Detail page + add-to-cart. Snackbar equivalent on iOS is `XCUIElementTypeOther` overlay — different selector pattern. |
| §4 Cart (04/02) | ⏳ | Chains off §4 Products. iOS rotation handling not needed (orientation lock is Android-specific). |
| §4 Checkout (04/03) | ⏳ | Pure UI; should port cleanly once §4 Products is green. |
| §16 Regression | ⏳ | Last; depends on §1–§14 being green on iOS. |

**Operating contract for iOS:**
- Selector iteration is gated by the `_iosFailureDiagnostic` fixture — every iOS test failure on CI leaves `test-results/diagnostics/<slug>-source.xml` + `-screenshot.png`. **Always** verify a proposed iOS selector against fresh XML before pushing, the same way the Android suite verifies against `dumps/*.xml`.
- When expanding from 3 modules to the wider matrix, upgrade the diagnostic fixture to multi-checkpoint dumps (XML at every `waitForPageLoad`, not just on failure) to reduce CI round-trips.
- ⏭ modules: when a TC is iOS-incompatible, use `test.skip(this.isIOS, '<reason>')` at spec entry — same pattern as Android's tablet `test.skip(width > 1200, ...)`.

## 0. Smoke (foundation check)

**Spec:** `tests/specs/00_smoke/01_smoke.spec.js`. Runs **first** in the suite (~30–40s). If smoke fails, the app is fundamentally broken and there's no point running the 30+ minute unit suite below. Deliberately narrow scope: login + first-render + logout. No cart, no checkout — those are regression (§16).

**Scope summary:**
- **Foundation** (TC-SM01) — Login renders → credentials accepted → Catalog Landing renders → logout returns to Login (also leaves a clean state for 01_auth).

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-SM01** | App launches → Login renders → login → Catalog Landing renders → logout → Login renders again | Universal POM | ✅ | ✅ |

## 1. Authentication Module

**Spec:** `tests/specs/01_auth/01_functional.spec.js` + `02_negative.spec.js`

**Scope summary:**
- **Login render + interactions** (TC-L01/L02) — page elements visible, password visibility toggle stable.
- **Credential state** (TC-L03/L04) — preserved on Home interruption, cleared on Back.
- **Login + logout** (TC-L05/L06) — happy path login and session-aware logout.
- **Validation negatives** (TC-N01/N02/N03) — empty fields, invalid username format, valid-username-bad-password.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-L01** | should verify that the login page elements are visible | Universal POM | ✅ | ✅ |
| **TC-L02** | should toggle password visibility and maintain layout stability | Safe-Zone Interaction | ✅ | ✅ |
| **TC-L03** | should preserve credential state when backgrounded (Home) | Universal Interruption | ✅ | ✅ |
| **TC-L04** | should clear unsaved credential state when exited (Back) | Android-Only Interruption | ✅ | ✅ |
| **TC-L05** | should successfully login with valid demo credentials | Universal E2E | ✅ | ✅ |
| **TC-L06** | should persist session and successfully logout | Universal App State | ✅ | ✅ |
| **TC-N01** | should show validation errors when fields are left empty | Universal POM | ✅ | ✅ |
| **TC-N02** | should show error for invalid username (format) | Universal Negative | ✅ | ✅ |
| **TC-N03** | should show error for valid username with invalid password | Universal Negative | ✅ | ✅ |

## 2. Catalog Module

**Specs:** `tests/specs/02_catalog/01_landing.spec.js` + `02_categories.spec.js`

**Scope summary:**
- **Homepage + grid render** (TC-C01/C03) — default state with scroll-to-bottom and reset-to-top.
- **Cart empty states** (TC-C02/C06) — from Homepage and Grid entry points.
- **Catalog data integrity** (TC-C04) — 32-item visual scan against `tests/data/products.js`.
- **Sorting + routing** (TC-C05/C07) — all four sort modes, View All hyperlink.
- **Category specs** (TC-C08–C11) — Casual/Evening/Party/Boho data + sort + cart integrity.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-C01** | Homepage default state, scroll to last category, reset to top | Universal Safe-Zone | ✅ | ✅ |
| **TC-C02** | Cart empty state from Homepage | Universal POM | ✅ | ✅ |
| **TC-C03** | "All Dresses" page default state (alpha-first anchor) | Universal POM | ✅ | ✅ |
| **TC-C04** | Full Catalog Data Integrity (32-item visual scan) | Data-Driven Audit | ✅ | ✅ |
| **TC-C05** | All four sorting modes verified against Universal Truths | Universal Anchor | ✅ | ✅ |
| **TC-C06** | Cart empty state from Grid | Universal POM | ✅ | ✅ |
| **TC-C07** | "View All" hyperlink routing | Universal E2E | ✅ | ✅ |
| **TC-C08** | Casual Dresses data + sort + cart integrity | Data-Driven | ✅ | ✅ |
| **TC-C09** | Evening Dresses data + sort + cart integrity | Data-Driven | ✅ | ✅ |
| **TC-C10** | Party Dresses data + sort + cart integrity | Data-Driven | ✅ | ✅ |
| **TC-C11** | Boho Dresses data + sort + cart integrity | Data-Driven | ✅ | ✅ |

## 3. Navigation & Gestures

**Specs:** `03_nav/01_main_nav.spec.js` (drawer routing), `02_gestures.spec.js` (swipe/drag/zoom), `03_webview.spec.js`.

**Scope summary:**
- **Drawer routing** (TC-M01/M02/M03) — Home, Cart, About entry points; About also exercises the in-page Dark Mode toggle with pixel sampling.
- **Swipe + drag** (TC-M04/M05) — randomized card swipe-to-favorite/delete; long-press drag-and-drop reorder.
- **Long-press popup** (TC-M06) — all 3 option interactions + toast.
- **Zoom + pan** (TC-M07/M08) — double-tap zoom with pan-and-pixel-verify; pinch zoom with reset.
- **WebView** (TC-W01–W03) — open Taqelah site, navigate to example.com via Go button, Back preserves app state.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-M01** | Nav Menu default state + Home routing (above & below fold) | Functional E2E | ✅ | ✅ |
| **TC-M02** | Cart routing from drawer + empty state | Functional E2E | ✅ | ✅ |
| **TC-M03** | About routing + content integrity + Dark Mode toggle (pixel-sampled) | Component + Pixel Sample | ✅ | ✅ |
| **TC-M04** | Randomized sequential swipe (favorite/delete) for 5 cards | W3C Pointer Actions | ✅ | ✅ |
| **TC-M05** | Randomized drag-and-drop reorder with state tracking | Long-press Drag | ✅ | ✅ |
| **TC-M06** | Long-press popup with all three option interactions | Pointer + Toast | ✅ | ✅ |
| **TC-M07** | Double-tap to zoom + pan canvas, verify content via pixel scan | mobile:doubleClickGesture | ✅ | ✅ |
| **TC-M08** | Pinch to zoom + full page reset verification | Multi-finger Pointer | ✅ | ✅ |
| **TC-W01** | WebView opens and displays the Taqelah website correctly | In-App Browser | ✅ | ✅ |
| **TC-W02** | Navigate to a new URL (example.com) using the Go button | URL Navigation | ✅ | ✅ |
| **TC-W03** | WebView Back returns to the app with state preserved | State Preservation | ✅ | ✅ |

## 4. Dialogs & Alerts

**Spec:** `tests/specs/03_nav/04_dialogs.spec.js`

**Scope summary:**
- **Default render** (TC-D01) — all 7 trigger buttons visible.
- **Alert / Bottom Sheet / Snackbar** (TC-D02/D03/D04) — open + dismiss + action handling.
- **Date Picker** (TC-D05 + D05-NEG) — calendar mode, input mode, calendar toggle, invalid-format error.
- **Time Picker** (TC-D06) — analog dial + text input modes.
- **Simple + Full-Screen dialogs** (TC-D07/D08) — radio selection, back navigation with result card update.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-D01** | Dialogs page default state with all 7 trigger buttons | Universal POM | ✅ | ✅ |
| **TC-D02** | Alert Dialog with Cancel and OK actions | Universal POM | ✅ | ✅ |
| **TC-D03** | Bottom Sheet display and dismiss via Close button | Universal POM | ✅ | ✅ |
| **TC-D04** | Snackbar display and UNDO action | Universal POM | ✅ | ✅ |
| **TC-D05** | Date Picker — calendar view with OK, input mode with Cancel and OK, and calendar toggle | Multi-Modal | ✅ | ✅ |
| **TC-D05-NEG** | "Invalid format." error when submitting empty date input | Negative | ✅ | ✅ |
| **TC-D06** | Time Picker — analog dial mode with OK and Cancel, text input mode with OK and Cancel | Multi-Modal | ✅ | ✅ |
| **TC-D07** | Simple Dialog radio option selection for all colors | Universal POM | ✅ | ✅ |
| **TC-D08** | Full-Screen Dialog display, back navigation, and result card update | Universal POM | ✅ | ✅ |

## 5. Form Validation

**Spec:** `tests/specs/03_nav/05_form.spec.js`

**Scope summary:**
- **Default state** (TC-F01) — all form fields render.
- **Happy path** (TC-F02) — Bridal / Large / 2-of-5 rating / 10:30 PM submits successfully.
- **Terms gating** (TC-F03) — Submit rejected until Terms is ON.
- **Required-field + format negatives** (TC-F04/F05) — empty-form errors; bad email/phone/number/password formats.
- **State reset** (TC-F06) — Back + re-entry clears form.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-F01** | Form Validation page default state with all form fields | Universal POM | ✅ | ✅ |
| **TC-F02** | Submit successfully via the full happy path (Bridal/Large/2of5, 10:30 PM) | Universal POM | ✅ | ✅ |
| **TC-F03** | Reject Submit when Terms is OFF, then succeed after ticking Terms (consolidated) | Universal POM | ✅ | ✅ |
| **TC-F04** | Show all required-field error messages when submitting an empty form | Negative | ✅ | ✅ |
| **TC-F05** | Show format-error messages for invalid email/phone/number/password | Negative | ✅ | ✅ |
| **TC-F06** | Reset form state after Back-navigation and re-entry | Universal POM | ✅ | ✅ |

## 6. Permissions

**Spec:** `tests/specs/03_nav/06_permissions.spec.js`

**Scope summary:**
- **Default state** (TC-P01) — all 3 entries "Not checked", no Open Settings.
- **Grant Camera+Audio+Location+Storage** (TC-P02) — mixed grant path including a deny-then-recover; persistence on re-navigation.
- **Alternative grant path** (TC-P03) — Camera "While using" twice, Location "Only this time", Storage auto-grant; persistence.
- **Deny twice → permanent** (TC-P04) — Camera/Location both → "Permanently Denied", Storage still auto-grants; re-Request taps confirm no OS re-dialog.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-P01** | Permissions page default state with all 3 entries "Not checked" + no "Open Settings" | Universal POM | ✅ | ✅ |
| **TC-P02** | Grant Camera (Video→While using, Audio→Deny→recover→One time→Granted), Location (While using), Storage (auto-grant) — verify persistence with re-navigation | Multi-Dialog Grant | ✅ | ✅ |
| **TC-P03** | Grant Camera (While using twice), Location (Only this time), Storage (auto-grant) — verify persistence | Alternative Grant + Persistence | ✅ | ✅ |
| **TC-P04** | Deny Camera twice (→Denied→Permanently Denied), deny Location twice (→Denied→Permanently Denied), auto-grant Storage — verify persistence with Request taps confirming no OS re-dialogs | Deny-2x + Persistence | ✅ | ✅ |

## 7. Notifications

**Spec:** `tests/specs/03_nav/07_notifications.spec.js` (requires API 33+; CI runs API 34)

**Scope summary:**
- **Accept** (TC-NT01) — grant + card "Notification permission granted" + exercise all 5 triggers.
- **Deny** (TC-NT02) — deny + card "Permission denied — notifications may not appear" + exercise all 5 triggers.
- **Permanent denial** (TC-NT03) — 2× deny with leave+return between; 3rd entry suppresses dialog; card reverts to "No notifications sent yet" + exercise all 5 triggers.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-NT01** | Accept OS dialog → card "Notification permission granted" → exercise all 5 triggers (Instant, Schedule, Banner DISMISS + VIEW, Dialog LATER + OK, Snackbar VIEW) | Universal POM + Helper | ✅ | ✅ |
| **TC-NT02** | Deny OS dialog → card "Permission denied — notifications may not appear" → exercise all 5 triggers | Universal POM + Helper | ✅ | ✅ |
| **TC-NT03** | Deny dialog twice (with leave+return between, since Android 13+ re-prompts once after a single deny) → 3rd entry has no dialog (permanent denial) → card reverts to "No notifications sent yet" → exercise all 5 triggers | Sequential Persistence | ✅ | ✅ |

## 8. Tabs & Navigation

**Spec:** `tests/specs/03_nav/08_tabs.spec.js`

**Scope summary:**
- **Default render** (TC-T01) — Back, title, 3 top tabs, Feed selected, Page 1 of 3 hint.
- **Feed pager** (TC-T02) — swipe 1→2→3 with no overshoot; back-swipe preserves intra-tab state.
- **Static tabs** (TC-T03) — Search tab body text.
- **Nested bottom nav** (TC-T04) — Profile Home/Favorites/Settings toggle.
- **State reset** (TC-T05/T06) — cross-tab hop and Back+re-enter both reset pager to Page 1.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-T01** | Default load — Back, title, 3 top tabs visible, Feed selected, Page 1 of 3 hint | UI Assertion | ✅ | ✅ |
| **TC-T02** | Feed pager — swipe 1→2→3, no overshoot past Page 3, swipe back to Page 2 preserved | Gesture + State | ✅ | ✅ |
| **TC-T03** | Search tab — selected state moves, static body text `Search Tab Content` shown | UI Assertion | ✅ | ✅ |
| **TC-T04** | Profile tab + nested bottom nav — Home/Favorites/Settings toggle, body text follows `<Name> Section` | UI Assertion | ✅ | ✅ |
| **TC-T05** | Cross-tab reset — Feed→Page 2 → Search → Feed → pager resets to Page 1 | State Reset | ✅ | ✅ |
| **TC-T06** | Back+re-enter reset — Feed→Page 3 → Back → re-enter via drawer → pager resets to Page 1 | State Reset | ✅ | ✅ |

## 9. Camera

**Spec:** `tests/specs/03_nav/09_camera.spec.js` (requires API 30+)

**Scope summary:**
- **Granted Path** (TC-CM01–CM04) — grant Camera + Audio → live preview UI; shutter capture + "Photo saved" toast; header Back returns to live; flip-camera smoke.
- **Denied Path** (TC-CM05–CM07) — single deny → denied screen + Open Settings; 2× deny → permanent denial persists; Open Settings deep-links to `com.android.settings`.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-CM01** | Grant Camera + Audio → live preview header, shutter, flip visible | Permission Flow + UI Assertion | ✅ | ✅ |
| **TC-CM02** | Tap shutter → "Photo Captured!" chip + transient toast matching `^Photo saved: CAP\d+\.jpg$` | Side-effect Capture | ✅ | ✅ |
| **TC-CM03** | Header Back arrow on captured state returns to live preview (intra-screen) | State Reset | ✅ | ✅ |
| **TC-CM04** | Tap flip-camera button → no crash, live preview UI intact (smoke; SurfaceView has no a11y diff between back/front cameras) | Smoke | ✅ | ✅ |
| **TC-CM05** | Deny camera dialog (single deny) → "Camera permission denied" + "Open Settings" | Permission Denial | ✅ | ✅ |
| **TC-CM06** | Deny twice with leave+return between → 3rd entry has no dialog (permanent denial) → denied state persists | Sequential Persistence | ✅ | ✅ |
| **TC-CM07** | Tap "Open Settings" from denied state → Android Settings (`com.android.settings`) is foreground app | Intent Verification | ✅ | ✅ |

## 10. Location

**Spec:** `tests/specs/03_nav/10_location.spec.js` (Pixel Tablet skipped — emulator-5556 GPS never emits fixes)

**Scope summary:**
- **Granted Path** (TC-LO01–LO05) — OS dialog → "While using" grant → idle granted screen → Start Tracking + first history entry → 5 Start/Stop cycles accumulate ≥6 LIFO entries → re-entry persists permission but resets history.
- **Denied Path** (TC-LO06–LO08) — single deny → denied screen + Open Settings; Open Settings deep-links; 2× deny → permanent denial.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-LO01** | Cold entry → OS Location dialog visible (While using / Don't allow) | Permission Flow | ✅ | ⏭ Skipped |
| **TC-LO02** | Grant "While using the app" → idle granted screen renders (Current Location card with Lat/Lng/Altitude/Speed/Accuracy + Refresh + Start Tracking) | UI Assertion | ✅ | ⏭ Skipped |
| **TC-LO03** | Tap Start Tracking → "Stop Tracking" + "Tracking location updates..." indicator + Location History with first entry matching `<lat>, <lng>\n<HH:mm:ss>\n±<n>m` | State Transition | ✅ | ⏭ Skipped |
| **TC-LO04** | 5 additional Start/Stop cycles → ≥ 6 total history entries (verify-and-retry per cycle), LIFO display order, end on stopped state (Start Tracking restored, indicator gone, Current Location card retained) | Accumulation + LIFO | ✅ | ⏭ Skipped |
| **TC-LO05** | Back to Home + re-enter Location → no OS dialog (permission persists); History is **screen-session-scoped** and resets to 0 entries; first fresh Start/Stop adds exactly 1 entry (pre-exit entries are NOT restored) | Persistence Contract | ✅ | ⏭ Skipped |
| **TC-LO06** | Single deny → "Location permission denied" + "Open Settings"; no Start Tracking / Current Location card | Permission Denial | ✅ | ⏭ Skipped |
| **TC-LO07** | Tap Open Settings → `getCurrentPackage()` reports `com.android.settings`; back to app → denied state retained | Intent Verification + Return State | ✅ | ⏭ Skipped |
| **TC-LO08** | Deny twice with leave+return between → 3rd entry has no dialog (permanent denial); denied state persists | Sequential Persistence | ✅ | ⏭ Skipped |

## 11. Dark Mode (cross-cutting smoke)

**Spec:** `tests/specs/03_nav/11_dark_mode.spec.js`. Verifies that the drawer Dark Mode toggle propagates across every previously-tested module.

**Scope summary:**
- **Baseline + toggle ON** (TC-DK01) — capture light AppBar 3-spot baseline, toggle ON, assert Home brightness drops ≥80.
- **Cross-cutting walk** (TC-DK02) — visit Catalog Landing / Shop All / 4 Categories / Cart / About / Gestures / WebView / Dialogs / Form / Permissions / Notifications / Tabs / Camera / Location; each samples as dark.
- **Toggle OFF restoration** (TC-DK03) — toggle OFF, Home returns within ±30 of original baseline.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-DK01** | Default state at Home — drawer Dark Mode toggle reports `checked=false`. Capture 3-spot **light baseline** at AppBar coords. Toggle ON → `checked=true`; Home avg brightness drops by ≥ 80 vs baseline. | Theme Toggle + Baseline Capture | ✅ | ✅ |
| **TC-DK02** | Walk through every previously-tested page and verify each samples as dark (avg brightness < baseline − 80). Order: Catalog Landing → Shop All → Casual → Evening → Party → Boho → Cart → About (scroll → in-page Dark Mode Switch reports ON, synced with drawer) → Gestures → WebView (navigate-only, sample skipped) → Dialogs → Form → Permissions → Notifications → Tabs → Camera (deny dialog) → Location (deny dialog, Pixel 8 only). | Cross-Cutting Visual Smoke | ✅ | ✅ (Location step skipped) |
| **TC-DK03** | Toggle OFF via drawer → `checked=false`. Dismiss → Home avg brightness within ±30 of original baseline. | Restoration | ✅ | ✅ |

## 12. Product Detail + Add to Cart

**Spec:** `tests/specs/04_products/01_product_detail_add.spec.js`
**Flow:** Shop All → Detail → 2 color variants → Casual → Detail (add) → Evening → direct-add. Cart ends with 4 lines (pre-Search).

**Scope summary:**
- **Detail render** (TC-PD01) — image, title, price, 3 color swatches, qty stepper, Add to Cart all present after random pick.
- **Variant cart model** (TC-PD02) — different colors of one product become separate cart lines; cart=2, badge=2.
- **Badge persistence** (TC-PD03/PD05) — cart badge survives drawer nav between Shop All / Casual / Evening grids.
- **Add via Detail** (TC-PD04) — Add to Cart snackbar fires, badge increments to 3.
- **Add via card icon** (TC-PD06) — direct-add from Evening grid card (no Detail visit), badge increments to 4.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-PD01** | Shop All → random product → Detail renders (image, title, price, 3 swatches, qty stepper, Add to Cart) | E2E Flow | ✅ | ✅ |
| **TC-PD02** | Two color variants of same product → 2 distinct cart lines + badge=2 | Variant Side-effect | ✅ | ✅ |
| **TC-PD03** | Back to Shop All → badge=2 persists; drawer → Home → Casual → random product Detail | E2E Flow | ✅ | ✅ |
| **TC-PD04** | Add Casual product → snackbar → badge=3 | UI + Side-effect | ✅ | ✅ |
| **TC-PD05** | Back → Evening grid renders | E2E Flow | ✅ | ✅ |
| **TC-PD06** | Direct-add from Evening card icon (no Detail visit) → badge=4 | UI + Side-effect | ✅ | ✅ |

## 13. Search

**Spec:** folded into `04_products/01_product_detail_add.spec.js`. Search bar lives on Shop All and each Category grid (not on Catalog Landing).

**Scope summary:**
- **Multi-add from results** (TC-SR01) — Party + "Cocktail" returns 3 matches; add all 3 via direct-add icon; badge 4 → 7.
- **Empty result** (TC-SR02) — Boho + "shorts" returns zero cards; badge unchanged at 7.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-SR01** | Party → search "Cocktail" → 3 matches → add all 3 → badge=7 | Functional + Multi-Add | ✅ | ✅ |
| **TC-SR02** | Boho → search "shorts" → empty grid, badge unchanged | Negative | ✅ | ✅ |

## 14. Shopping Cart

**Spec:** `tests/specs/04_products/02_cart.spec.js`
**Cascade entry:** chains off §12+§13 7-line cart by tapping the grid cart icon.

**Scope summary:**
- **Entry + data integrity** (TC-S01) — 7 lines load, line totals sum to bottom-bar cart Total, Proceed to Checkout enabled.
- **Quantity stepper** (TC-S02/S03) — Plus drives qty 1→5, Minus drives back to 1, line total + cart Total stay in sync per tap, Minus is greyed at qty=1.
- **Delete + math** (TC-S04) — deleting a line drops the count by 1 and decrements the cart Total by exactly that line's total.
- **Empty state** (TC-S05) — deleting every line surfaces "Your cart is empty" + Continue Shopping.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-S01** | 7 lines visible, each well-formed; `Total:` = Σ line totals; Proceed to Checkout clickable | Data Integrity | ✅ | ✅ |
| **TC-S02** | Plus on line 0 qty 1→5; per tap: line total = unitPrice × qty AND Σ line totals = cart Total | UI Interaction + Sum Verify | ✅ | ✅ |
| **TC-S03** | Minus on line 0 back to qty=1; same Σ verification; at qty=1 Minus is `clickable=false, enabled=false` | UI Interaction + Disabled-state | ✅ | ✅ |
| **TC-S04** | Delete line 0 → count -1; cart Total = before − deletedLine.total | UI Interaction + Math Verify | ✅ | ✅ |
| **TC-S05** | Loop delete until empty → "Your cart is empty" + Continue Shopping | Negative / Empty State | ✅ | ✅ |

## 15. Checkout

**Spec:** `tests/specs/04_products/03_checkout.spec.js`
**Flow:** Cart → Shipping Info ("To Payment") → Review Order ("Place Order") → Thank You ("Continue Shopping"). No Payment step. Test data: `tests/data/checkout-scenarios.json`.

**Scope summary:**
- **Empty submit** (TC-K01) — required-field errors on 6 of 7 fields (Address 2 optional).
- **Happy path** (TC-K02) — fill `valid[0]` fixture → Review Order matches Cart totals → Place Order → Thank You.
- **Continue Shopping** (TC-K03) — returns to Catalog Landing with cart badge=0.
- **State preservation** (TC-K04) — Back from Review re-renders Shipping Info with all 7 entered values preserved.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-K01** | Cart → Checkout → empty To Payment → 6 required-field errors; stay on Shipping | Negative | ✅ | ⏳ |
| **TC-K02** | Fill `valid[0]` → To Payment → Review (5-line Shipping Address card, totals match Cart) → Place Order → Thank You | E2E Flow | ✅ | ⏳ |
| **TC-K03** | Continue Shopping → Catalog Landing + cart badge=0 | E2E Flow | ✅ | ⏳ |
| **TC-K04** | Fill 7 fields → To Payment → Back → Shipping Info preserves all 7 values verbatim | State Preservation | ✅ | ⏳ |

## 16. End-to-End Regression

**Spec:** `tests/specs/05_regression/01_e2e.spec.js`. Runs **after** all module specs (01–04) as a final cross-feature integration check — not a smoke test. §0 Smoke runs first as a foundation gate; this regression spec is a deep multi-module E2E that fails meaningfully only once every unit spec has passed.

**Scope summary:**
- **Full serial journey** (TC-E01) — fresh `pm clear` → login → catalog → product → add → cart → checkout → place order → thank you → continue shopping → assert badge=0.

| Test ID | Description | Strategy | Pixel 8 | Pixel Tablet |
| :--- | :--- | :--- | :---: | :---: |
| **TC-E01** | Full serial single-product journey, end-to-end from cold launch to badge=0 | Full E2E Serial | ✅ | ✅ |
