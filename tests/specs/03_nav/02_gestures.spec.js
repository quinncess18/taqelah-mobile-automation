// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');
const { GesturesPage } = require('../../pages/GesturesPage');

test.describe('Navigation - Gestures Interaction Suite (TC-M04-M08)', () => {
  let landingPage;
  let navMenu;
  let gesturesPage;

  test.beforeAll(async ({ driver }) => {
    landingPage = new CatalogLandingPage(driver);
    navMenu = new NavMenuPage(driver);
    gesturesPage = new GesturesPage(driver);

    let onHome = await landingPage.isVisible(landingPage.shopAllBtn);
    let tries = 0;
    while (!onHome && tries < 3) {
      await landingPage.deviceBack(); // edge-swipe / Back button; driver.back() no-ops on iOS
      await driver.pause(1000);
      onHome = await landingPage.isVisible(landingPage.shopAllBtn);
      tries++;
    }

    await navMenu.open();
    await navMenu.navigateTo(navMenu.navGestures);
    await gesturesPage.waitForPageLoad();
  });

  test('TC-M04: should verify Randomized Sequential Swipe interactions', async ({ driver }) => {
    let availableCards = [1, 2, 3, 4, 5];
    while (availableCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableCards.length);
      const cardId = availableCards.splice(randomIndex, 1)[0];
      const direction = Math.random() > 0.5 ? 'right' : 'left';

      await gesturesPage.swipeCardSide(cardId, direction);

      const expectedToast = `Swipe Card ${cardId} ${direction === 'right' ? 'favorited!' : 'deleted!'}`;
      expect(await gesturesPage.verifyToast(expectedToast)).toBe(true);
      expect(await gesturesPage.isVisible(gesturesPage.swipeCard(cardId))).toBe(false);

      await driver.pause(1000);
    }
  });

  test('TC-M05: should verify Randomized Drag & Drop Reorder', async ({ driver }) => {
    await gesturesPage.scrollToDragSection();

    // Verify default state: card i is at position i
    for (let i = 1; i <= 5; i++) {
      expect(await gesturesPage.isVisible(gesturesPage.dragItemExact(i, i))).toBe(true);
    }

    // State tracker: positionOf[cardId] = currentSlot
    const positionOf = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };

    for (const cardId of [1, 2, 3, 4, 5]) {
      const currentSlot = positionOf[cardId];
      // Target must differ from both the card's current slot and its default position
      const available = [1, 2, 3, 4, 5].filter(s => s !== currentSlot && s !== cardId);
      const targetSlot = available[Math.floor(Math.random() * available.length)];
      const displacedCardId = Number(Object.keys(positionOf).find(id => positionOf[Number(id)] === targetSlot));

      await gesturesPage.reorderItem(
        gesturesPage.dragItem(cardId),
        gesturesPage.dragSlot(targetSlot)
      );
      await driver.pause(1000);

      // Update state tracker (cards swap positions)
      positionOf[cardId] = targetSlot;
      positionOf[displacedCardId] = currentSlot;

      // Verify card landed at target: checks both position index and card ID
      expect(await gesturesPage.isVisible(gesturesPage.dragItemExact(targetSlot, cardId))).toBe(true);
    }

    // Verify all 5 position indexes still present (ascending order maintained)
    for (let i = 1; i <= 5; i++) {
      expect(await gesturesPage.isVisible(gesturesPage.dragSlot(i))).toBe(true);
    }
    // No exit — continue to TC-M06 on the same page
  });

  test('TC-M06: should verify Long Press popup and all three option interactions', async ({ driver }) => {
    await gesturesPage.scrollToSection(gesturesPage.sectionLongPress);

    // Verify initial state
    expect(await gesturesPage.isVisible(gesturesPage.sectionLongPress)).toBe(true);
    expect(await gesturesPage.isVisible(gesturesPage.instructionLongPress)).toBe(true);
    expect(await gesturesPage.isVisible(gesturesPage.longPressBtn)).toBe(true);

    const options = ['Copy', 'Share', 'Delete'];
    const expectedMessages = ['Copied!', 'Shared!', 'Deleted!'];

    for (let i = 0; i < options.length; i++) {
      await gesturesPage.longPress(gesturesPage.longPressBtn);

      // Verify all three dropdown options appear
      expect(await gesturesPage.isVisible(gesturesPage.optionCopy)).toBe(true);
      expect(await gesturesPage.isVisible(gesturesPage.optionShare)).toBe(true);
      expect(await gesturesPage.isVisible(gesturesPage.optionDelete)).toBe(true);

      await gesturesPage.tapOption(options[i]);
      expect(await gesturesPage.verifyToast(expectedMessages[i])).toBe(true);
    }
    // No exit — continue to TC-M07 on the same page
  });

  test('TC-M07: should verify Double Tap to Zoom interaction', async ({ driver }) => {
    await gesturesPage.scrollToSection(gesturesPage.doubleTapArea);

    await gesturesPage.doubleTapZoomCanvas();
    await gesturesPage.panCanvas();

    expect(await gesturesPage.verifyCanvasHasContent()).toBe(true);
    // No exit — continue to TC-M08 on the same page
  });

  test('TC-M08: should verify Pinch to Zoom interaction and full page reset', async ({ driver }) => {
    await gesturesPage.scrollToSection(gesturesPage.pinchArea);

    const before = await gesturesPage.getPinchCenterBrightness();
    await gesturesPage.pinch(gesturesPage.pinchArea);
    const after = await gesturesPage.getPinchCenterBrightness();

    expect(after).not.toBe(before);

    // Single exit — verify entire Gestures page resets to default state
    await gesturesPage.goBack();
    await landingPage.waitForPageLoad();
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navGestures);
    await gesturesPage.waitForPageLoad();

    // Swipe cards reset
    for (let i = 1; i <= 5; i++) {
      expect(await gesturesPage.isVisible(gesturesPage.swipeCard(i))).toBe(true);
    }

    // Drag items reset
    await gesturesPage.scrollToDragSection();
    for (let i = 1; i <= 5; i++) {
      expect(await gesturesPage.isVisible(gesturesPage.dragItemExact(i, i))).toBe(true);
    }

    // Long press reset
    await gesturesPage.scrollToSection(gesturesPage.sectionLongPress);
    expect(await gesturesPage.isVisible(gesturesPage.longPressBtn)).toBe(true);

    // Double tap canvas reset
    await gesturesPage.scrollToSection(gesturesPage.doubleTapArea);
    expect(await gesturesPage.isVisible(gesturesPage.doubleTapArea)).toBe(true);

    // Pinch canvas reset — brightness after re-navigation must be closer to pre-pinch than post-pinch
    await gesturesPage.scrollToSection(gesturesPage.pinchArea);
    const afterReset = await gesturesPage.getPinchCenterBrightness();
    expect(Math.abs(afterReset - before)).toBeLessThan(Math.abs(afterReset - after));

    await gesturesPage.goBack();
    await landingPage.waitForPageLoad();
  });
});
