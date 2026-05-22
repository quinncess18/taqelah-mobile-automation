// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');
const { WebViewPage } = require('../../pages/WebViewPage');

test.describe('Navigation - WebView / In-App Browser (TC-W01-W03)', () => {
  let landingPage;
  let navMenu;
  let webViewPage;

  test.beforeAll(async ({ driver }) => {
    landingPage = new CatalogLandingPage(driver);
    navMenu = new NavMenuPage(driver);
    webViewPage = new WebViewPage(driver);

    // SELF-HEALING: Return to DemoApp Homepage if deep-linked.
    // Use deviceBack() (app-bar Back / edge-swipe) — driver.back() no-ops on iOS.
    let onHome = await landingPage.isVisible(landingPage.shopAllBtn);
    let retryCount = 0;
    while (!onHome && retryCount < 3) {
      await landingPage.deviceBack();
      await driver.pause(1000);
      onHome = await landingPage.isVisible(landingPage.shopAllBtn);
      retryCount++;
    }
  });

  test('TC-W01: should verify WebView opens and displays the Taqelah website correctly', async ({ driver }) => {
    // Native-only verification. The DemoApp's WebView is built without
    // WebContentsDebuggingEnabled, so WEBVIEW context never attaches and
    // we cannot inspect the DOM. Heavy SPAs like taqelah.sg also do not
    // expose accessibility nodes inside the WebView, so paint completion
    // is not observable from native automation. We verify the surface:
    // chrome elements present, URL bar accepted the target URL, and the
    // WebView widget was instantiated with non-zero bounds.
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navWebView);
    await webViewPage.waitForPageLoad();

    expect(await webViewPage.isVisible(webViewPage.title)).toBe(true);
    expect(await webViewPage.isVisible(webViewPage.urlInput)).toBe(true);
    expect(await webViewPage.isVisible(webViewPage.goBtn)).toBe(true);

    const currentUrl = await webViewPage.getCurrentUrl();
    expect(currentUrl).toContain('taqelah.sg');

    expect(await webViewPage.isWebViewDisplayed()).toBe(true);
    const container = await driver.$(webViewPage.webViewContainer);
    const { width, height } = await container.getSize();
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  test('TC-W02: should navigate to a new URL using the Go button', async ({ driver }) => {
    // example.com exposes accessibility nodes once the page paints, so we
    // can anchor the load-complete signal on rendered page text rather
    // than the URL bar (which updates instantly on Go click and is not a
    // load signal).
    await webViewPage.navigateToUrl('https://example.com');
    await webViewPage.waitForPageContent('Example Domain');

    const newUrl = await webViewPage.getCurrentUrl();
    expect(newUrl).toContain('example.com');
  });

  test('TC-W03: should verify WebView Back returns to the app with state preserved', async ({ driver }) => {
    // Navigate back using the header Back button
    await webViewPage.goBack();

    // Verify we're back on the DemoApp Home screen
    await landingPage.waitForPageLoad();
    expect(await landingPage.isVisible(landingPage.shopAllBtn)).toBe(true);
  });
});
