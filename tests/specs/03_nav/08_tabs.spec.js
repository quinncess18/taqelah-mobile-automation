// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');
const { TabsPage } = require('../../pages/TabsPage');

test.describe('Navigation - Tabs & Navigation Suite (TC-T01-T06)', () => {
  let landingPage;
  let navMenu;
  let tabsPage;

  /**
   * Single entry point — navigate into Tabs once. Tests cascade from each
   * other's end state; the only test that intentionally leaves the screen
   * is TC-T06 (Back + re-enter reset), which runs last.
   */
  test.beforeAll(async ({ driver }) => {
    landingPage = new CatalogLandingPage(driver);
    navMenu = new NavMenuPage(driver);
    tabsPage = new TabsPage(driver);

    // Heal back to Home if a prior spec left us elsewhere.
    let onHome = await landingPage.isVisible(landingPage.shopAllBtn);
    let retryCount = 0;
    while (!onHome && retryCount < 3) {
      await driver.back();
      await driver.pause(1000);
      onHome = await landingPage.isVisible(landingPage.shopAllBtn);
      retryCount++;
    }

    await navMenu.open();
    await navMenu.navigateTo(navMenu.navTabs);
    await tabsPage.waitForPageLoad();
  });

  test('TC-T01: should load Tabs screen with Back, title, 3 top tabs, Feed selected, Page 1 of 3 visible', async () => {
    expect(await tabsPage.isVisible(tabsPage.backBtn)).toBe(true);
    expect(await tabsPage.isVisible(tabsPage.screenTitle)).toBe(true);

    expect(await tabsPage.isVisible(tabsPage.feedTab)).toBe(true);
    expect(await tabsPage.isVisible(tabsPage.searchTab)).toBe(true);
    expect(await tabsPage.isVisible(tabsPage.profileTab)).toBe(true);

    expect(await tabsPage.isSelected(tabsPage.feedTab)).toBe(true);
    expect(await tabsPage.isSelected(tabsPage.searchTab)).toBe(false);
    expect(await tabsPage.isSelected(tabsPage.profileTab)).toBe(false);

    expect(await tabsPage.isVisible(tabsPage.pageHint(1))).toBe(true);
  });

  test('TC-T02: should swipe Feed pager 1→2→3, not overshoot past Page 3, and swipe back to Page 2 preserved', async () => {
    expect(await tabsPage.isVisible(tabsPage.pageHint(1))).toBe(true);

    await tabsPage.swipePager('left');
    expect(await tabsPage.isVisible(tabsPage.pageHint(2))).toBe(true);

    await tabsPage.swipePager('left');
    expect(await tabsPage.isVisible(tabsPage.pageHint(3))).toBe(true);

    // Extra left swipe at the end — pager should stay on Page 3 (bounded).
    await tabsPage.swipePager('left');
    expect(await tabsPage.isVisible(tabsPage.pageHint(3))).toBe(true);

    // Swipe right — Page 2 is restored.
    await tabsPage.swipePager('right');
    expect(await tabsPage.isVisible(tabsPage.pageHint(2))).toBe(true);
  });

  test('TC-T03: should switch to Search tab — selected state moves, static body text shown', async () => {
    await tabsPage.tapSearchTab();

    expect(await tabsPage.isSelected(tabsPage.searchTab)).toBe(true);
    expect(await tabsPage.isSelected(tabsPage.feedTab)).toBe(false);
    expect(await tabsPage.isSelected(tabsPage.profileTab)).toBe(false);

    expect(await tabsPage.isVisible(tabsPage.searchBody)).toBe(true);
  });

  test('TC-T04: should switch to Profile tab and toggle Home/Favorites/Settings bottom nav with section text updating', async () => {
    await tabsPage.tapProfileTab();

    expect(await tabsPage.isSelected(tabsPage.profileTab)).toBe(true);
    expect(await tabsPage.isSelected(tabsPage.feedTab)).toBe(false);
    expect(await tabsPage.isSelected(tabsPage.searchTab)).toBe(false);

    // Default bottom-nav state on Profile entry.
    expect(await tabsPage.isSelected(tabsPage.bottomHome)).toBe(true);
    expect(await tabsPage.isVisible(tabsPage.sectionBody('Home'))).toBe(true);

    // Favorites
    await tabsPage.tapBottomFavorites();
    expect(await tabsPage.isSelected(tabsPage.bottomFavorites)).toBe(true);
    expect(await tabsPage.isSelected(tabsPage.bottomHome)).toBe(false);
    expect(await tabsPage.isSelected(tabsPage.bottomSettings)).toBe(false);
    expect(await tabsPage.isVisible(tabsPage.sectionBody('Favorites'))).toBe(true);

    // Settings
    await tabsPage.tapBottomSettings();
    expect(await tabsPage.isSelected(tabsPage.bottomSettings)).toBe(true);
    expect(await tabsPage.isSelected(tabsPage.bottomHome)).toBe(false);
    expect(await tabsPage.isSelected(tabsPage.bottomFavorites)).toBe(false);
    expect(await tabsPage.isVisible(tabsPage.sectionBody('Settings'))).toBe(true);
  });

  test('TC-T05: should reset Feed pager to Page 1 when leaving and returning to Feed via another tab', async () => {
    // Prior TC left us on Profile/Settings — return to Feed (Page 1) before swiping.
    await tabsPage.tapFeedTab();
    expect(await tabsPage.isVisible(tabsPage.pageHint(1))).toBe(true);

    // Advance Feed to Page 2.
    await tabsPage.swipePager('left');
    expect(await tabsPage.isVisible(tabsPage.pageHint(2))).toBe(true);

    // Hop to Search, then back to Feed — pager resets to Page 1.
    await tabsPage.tapSearchTab();
    expect(await tabsPage.isVisible(tabsPage.searchBody)).toBe(true);

    await tabsPage.tapFeedTab();
    expect(await tabsPage.isSelected(tabsPage.feedTab)).toBe(true);
    expect(await tabsPage.isVisible(tabsPage.pageHint(1))).toBe(true);
  });

  test('TC-T06: should reset Feed pager to Page 1 when leaving the screen via Back and re-entering', async ({ driver }) => {
    // Advance Feed to Page 3.
    await tabsPage.swipePager('left');
    await tabsPage.swipePager('left');
    const onPage3 = await tabsPage.isVisible(tabsPage.pageHint(3));
    expect(onPage3).toBe(true);

    // Exit via Back, then re-enter from the nav drawer.
    await driver.$(tabsPage.backBtn).click();
    await driver.pause(1000);
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navTabs);
    await tabsPage.waitForPageLoad();

    const onPage1 = await tabsPage.isVisible(tabsPage.pageHint(1));
    const feedSelected = await tabsPage.isSelected(tabsPage.feedTab);
    expect(onPage1).toBe(true);
    expect(feedSelected).toBe(true);
  });
});
