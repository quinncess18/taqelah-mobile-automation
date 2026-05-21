# Taqelah Mobile Automation Framework

Production-grade automation framework for the **Taqelah Boutique** Flutter application. This project uses a hybrid architecture combining **Playwright** for test orchestration and **Appium (WebdriverIO)** for mobile interaction, with cross-platform Android + iOS as the design goal.

## 🏁 Coverage Summary

96 TCs across 17 sections, all verified on Pixel 8 + Pixel Tablet locally (Location is Pixel 8 only — emulator-5556 GPS doesn't emit fixes; the GPS-warm-up tests TC-LO02–LO05 are also skipped on Android CI, where the warm-up crashes the GHA AVD's UIA2 session).

| Section | TCs | Notes |
|---|---|---|
| §0 Smoke | TC-SM01 | Foundation gate — runs first (~30s) |
| §1 Auth | TC-L01–L06, TC-N01–N03 | Login + negative paths |
| §2 Catalog | TC-C01–C11 | Landing, grid, sort, data integrity |
| §3 Nav + Gestures + WebView | TC-M01–M08, TC-W01–W03 | Drawer, swipe/drag/zoom, in-app browser |
| §4 Dialogs | TC-D01–D08 + D05-NEG | Alert, Bottom Sheet, Snackbar, Date/Time pickers |
| §5 Form Validation | TC-F01–F06 | Inputs, validation, reset |
| §6 Permissions | TC-P01–P04 | Camera/Location/Storage grant + deny paths |
| §7 Notifications | TC-NT01–NT03 | Allow / Deny / Permanent denial (API 33+) |
| §8 Tabs | TC-T01–T06 | Pager + nested bottom nav |
| §9 Camera | TC-CM01–CM07 | Granted + Denied paths |
| §10 Location | TC-LO01–LO08 | Pixel 8 only; TC-LO02–LO05 skipped on Android CI (GPS warm-up crashes AVD UIA2) |
| §11 Dark Mode | TC-DK01–DK03 | Cross-cutting AppBar pixel sampling |
| §12 Products + §13 Search | TC-PD01–PD06, TC-SR01–SR02 | Detail, variants, direct-add, search |
| §14 Cart | TC-S01–S05 | Line math, qty stepper, delete, empty state |
| §15 Checkout | TC-K01–K04 | Shipping validation, Review math, Place Order, state preservation |
| §16 Regression | TC-E01 | Full cross-module E2E — runs last |

Detailed coverage, strategy, and per-device status in [TEST_PLAN.md](./TEST_PLAN.md).


## 🚀 Key Features
- **Cross-Platform Architecture:** Codebase runs on both Android (Pixel 8, Pixel Tablet) and iOS (Simulator). Android suite is fully verified across all 17 sections; iOS Simulator runs §0 smoke on GHA `macos-14` and is being expanded module-by-module.
- **Safe-Zone Gestures:** Device-agnostic logic using a **30% width safe zone**, avoiding all system handles and split-view triggers on wide screens.
- **Cross-Platform POMs:** Intelligent Page Objects using the "Ternary Selector" pattern to bridge Android and iOS Flutter TestKeys.
- **Sequential Cross-Device Execution:** `workers: 1` in `playwright.config.js` runs each device project (Pixel 8, Pixel Tablet) sequentially — avoids Appium port collisions and UIAutomator2 session crashes.
- **Scalable Architecture:** Module-first directory structure designed for large-scale E2E coverage.
- **Flutter-First Strategy:** Optimized stability pauses specifically for Flutter's high-momentum accessibility tree.

## 🏗️ Project Structure
```text
├── apps/                 # Application binaries (.apk, .app)
├── config/               # Device (Android/iOS) and Appium server configurations
├── fixtures/             # Playwright custom fixtures (Dynamic Driver switching)
├── tests/
│   ├── data/             # Static test data (products.js)
│   ├── pages/            # Page Object Models (Cross-Platform Selectors)
│   └── specs/            # Test suites organized by module
│       ├── 01_auth/      # Authentication & Security tests
│       ├── 02_catalog/   # Home, Grid, Categories
│       ├── 03_nav/       # Navigation routing & Gestures
│       └── 04_products/  # Product Detail, Add to Cart, Search
└── playwright.config.js  # Main configuration for the test runner
```

## 🛠️ Tech Stack

- **Test Runner:** [Playwright Test](https://playwright.dev/)
- **Mobile Driver:** [Appium 2.x](https://appium.io/)
- **Client Library:** [WebdriverIO 8.x](https://webdriver.io/)
- **Android Driver:** `uiautomator2` (installed)
- **iOS Driver:** `xcuitest` (installed; CI runs §0 smoke on iOS Simulator via GHA `macos-14`)

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- Android SDK & ADB
- Appium 2.x server with `uiautomator2` driver
- An active Android emulator or physical device

### Installation
```bash
npm install
```

### Running Tests
```bash
# 1. Start Appium (required before any test run)
npm run appium:start

# 2. Run all tests (sequential across configured devices, single worker)
npm test

# Module-specific runs
npm run test:smoke         # 00_smoke/01_smoke.spec.js — foundation check (~30s)
npm run test:login         # 01_auth/01_functional.spec.js
npm run test:login:neg     # 01_auth/02_negative.spec.js
npm run test:catalog       # 02_catalog/01_landing.spec.js
npm run test:categories    # 02_catalog/02_categories.spec.js
npm run test:nav           # 03_nav/01_main_nav.spec.js
npm run test:gestures      # 03_nav/02_gestures.spec.js
npm run test:webview       # 03_nav/03_webview.spec.js
npm run test:dialogs       # 03_nav/04_dialogs.spec.js
npm run test:form          # 03_nav/05_form.spec.js
npm run test:permissions   # 03_nav/06_permissions.spec.js
npm run test:notifications # 03_nav/07_notifications.spec.js
npm run test:tabs          # 03_nav/08_tabs.spec.js
npm run test:camera        # 03_nav/09_camera.spec.js
npm run test:location      # 03_nav/10_location.spec.js (Pixel 8 only — tablet auto-skipped; LO02–LO05 also skip on Android CI)
npm run test:darkmode      # 03_nav/11_dark_mode.spec.js (cross-cutting smoke; Location step tablet-skipped)
npm run test:products      # 04_products/01_product_detail_add.spec.js (tablet auto-rotates to portrait post-login)
npm run test:cart          # 04_products/02_cart.spec.js — requires test:products to have just run in the same worker
npm run test:checkout      # 04_products/03_checkout.spec.js — requires test:cart to have just run (chains from empty cart)
npm run test:regression    # 05_regression/01_e2e.spec.js — full E2E with own pm clear; no chaining

# Single spec against a specific device

npx playwright test tests/specs/01_auth/01_functional.spec.js --project="Pixel 8 (Local)"


# Single TC by ID
npx playwright test --project="Pixel 8 (Local)" -g "TC-L01"
```

## 🎯 Per-Module API Compatibility

Each module declares its supported Android API range as an explicit contract.

| Module | Min API | Notes |
|---|---|---|
| Auth, Catalog, Nav Main, Gestures, WebView, Dialogs, Form, Permissions, Tabs | 29 | All version-gated paths have fallbacks (e.g. PermissionsPage's API-29 AOSP UI selectors). |
| Camera | 30 | Uses Android 11+ foreground-only permission dialog; API 29 fallbacks not retained. |
| **Notifications** | **33** | `POST_NOTIFICATIONS` is API 33+. CI MUST run API 33+ for this module to verify. |
| **Location** | 29 | No version-gated APIs. Pixel Tablet AVD runtime-skipped (`width > 1200`) — emulator-5556's GPS provider does not emit fixes. GPS-warm-up tests TC-LO02–LO05 also skipped on Android CI (`process.env.CI && driver.isAndroid`) — the warm-up crashes the GHA Pixel-6 AVD's UIA2 session and cascades into Products/Checkout/Regression; LO01 + LO06–LO08 still run. Module runs full locally on Pixel 8 until mock-location injection, adb-reboot recovery, or real-device cloud is wired. |
| **Dark Mode** | 29 | Cross-cutting smoke. Inherits 10/Location's tablet-skip for the Location step only; rest of the walk runs on both devices. |
| **Products (04/01)** | 29 | No version-gated widgets. Pixel Tablet runs in **forced portrait** — orientation lock applied AFTER login via `mobile: shell` + `settings put system user_rotation 1`. Without rotation, Pixel Tablet's natural landscape makes product cards taller than the viewport and NAF add-to-cart child Buttons don't enter the a11y tree. |
| **Cart (04/02)** | 29 | Inherits Products' portrait lock (Products' `afterAll` no longer reverts). Cart's `afterAll` performs the end-of-chain revert. Per-line buttons are NAF + duplicate content-desc (PD02 variants) → resolved via direct `.click()` on the line ImageView's Button children. |
| **Checkout (04/03)** | 29 | Chains off Cart's empty-state. Adds 2–3 distinct random items via Detail-page add (snackbar overlay made grid direct-add unreliable). Shipping fields are NAF EditTexts via UiScrollable instance(0–6); Review line items are `View + descriptionContains("Qty:")` (different class than Cart's `ImageView` lines). |

See `TEST_PLAN.md → API Compatibility Matrix` for the operating contract (how to declare modules, what to do when bumping CI API).

## 📝 Documentation
- [TEST_PLAN.md](./TEST_PLAN.md): Current test coverage, per-device verification status, and the per-module API compatibility matrix.
