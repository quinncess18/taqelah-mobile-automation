// @ts-check
const { test, expect } = require('../../../fixtures/appFixture');
const { CatalogLandingPage } = require('../../pages/CatalogLandingPage');
const { NavMenuPage } = require('../../pages/NavMenuPage');
const { DialogsPage } = require('../../pages/DialogsPage');

test.describe('Navigation - Dialogs & Alerts Suite (TC-D01-D08)', () => {
  let landingPage;
  let navMenu;
  let dialogsPage;

  test.beforeAll(async ({ driver }) => {
    landingPage = new CatalogLandingPage(driver);
    navMenu = new NavMenuPage(driver);
    dialogsPage = new DialogsPage(driver);

    // SELF-HEALING: Return to DemoApp Homepage if deep-linked.
    // deviceBack() (app-bar Back / edge-swipe) — driver.back() no-ops on iOS.
    let onHome = await landingPage.isVisible(landingPage.shopAllBtn);
    let retryCount = 0;
    while (!onHome && retryCount < 3) {
      await landingPage.deviceBack();
      await driver.pause(1000);
      onHome = await landingPage.isVisible(landingPage.shopAllBtn);
      retryCount++;
    }

    // Navigate to Dialogs & Alerts
    await navMenu.open();
    await navMenu.navigateTo(navMenu.navDialogs);
    await dialogsPage.waitForPageLoad();
  });

  test('TC-D01: should verify Dialogs page default state with all trigger buttons', async ({ driver }) => {
    expect(await dialogsPage.isVisible(dialogsPage.title)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.backBtn)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.resultCard)).toBe(true);

    // Verify all 7 dialog trigger buttons are present
    expect(await dialogsPage.isVisible(dialogsPage.alertBtn)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.bottomSheetBtn)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.snackbarBtn)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerBtn)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerBtn)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.simpleDialogBtn)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.fullScreenBtn)).toBe(true);
  });

  test('TC-D02: should verify Alert Dialog with Cancel and OK actions', async ({ driver }) => {
    // Open Alert Dialog
    await driver.$(dialogsPage.alertBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.alertTitle);

    // Verify Alert Dialog elements
    expect(await dialogsPage.isVisible(dialogsPage.alertMessage)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.alertCancel)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.alertOk)).toBe(true);

    // Click Cancel
    await driver.$(dialogsPage.alertCancel).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    // Verify result shows cancelled
    const resultAfterCancel = await dialogsPage.getResultText();
    expect(resultAfterCancel).toContain('Cancelled');

    // Re-open and click OK
    await driver.$(dialogsPage.alertBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.alertTitle);
    await driver.$(dialogsPage.alertOk).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    const resultAfterOk = await dialogsPage.getResultText();
    expect(resultAfterOk).toContain('OK pressed');
  });

  test('TC-D03: should verify Bottom Sheet display and dismiss via Close button', async ({ driver }) => {
    // Open Bottom Sheet
    await driver.$(dialogsPage.bottomSheetBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.bottomSheetTitle);

    // Verify Bottom Sheet elements
    expect(await dialogsPage.isVisible(dialogsPage.bottomSheetDesc)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.bottomSheetClose)).toBe(true);

    // Dismiss via Close button
    await driver.$(dialogsPage.bottomSheetClose).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    // Verify result shows closed
    const result = await dialogsPage.getResultText();
    expect(result).toContain('Closed');
  });

  test('TC-D04: should verify Snackbar display and UNDO action', async ({ driver }) => {
    // Open Snackbar
    await driver.$(dialogsPage.snackbarBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.snackbarMessage);

    // Verify Snackbar toast message and UNDO button are visible
    expect(await dialogsPage.isVisible(dialogsPage.snackbarMessage)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.snackbarUndo)).toBe(true);

    // Click UNDO
    await driver.$(dialogsPage.snackbarUndo).click();

    // Verify the undo toast message appears at the bottom of the page
    expect(await dialogsPage.isVisible(dialogsPage.snackbarUndoToast)).toBe(true);

    // Verify result card shows the undo action
    const result = await dialogsPage.getResultText();
    expect(result).toContain('Undo pressed');
  });

  test('TC-D05: should verify Date Picker — calendar view with OK, input mode with Cancel and OK, and calendar toggle', async ({ driver }) => {
    // ── Part 1: Calendar View with OK ──
    // Open Date Picker
    await driver.$(dialogsPage.datePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.datePickerTitle);

    // Verify Date Picker elements in calendar view
    expect(await dialogsPage.isVisible(dialogsPage.datePickerYear)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerPrevMonth)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerNextMonth)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerSwitchInput)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerCancel)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerOk)).toBe(true);

    // Click year dropdown and select a different year (2024)
    await driver.$(dialogsPage.datePickerYear).click();
    await driver.pause(500);
    await dialogsPage.selectYear(2024);

    // Navigate to next month and back
    await driver.$(dialogsPage.datePickerNextMonth).click();
    await driver.pause(500);
    await driver.$(dialogsPage.datePickerPrevMonth).click();
    await driver.pause(500);

    // Select a date (day 15)
    await dialogsPage.selectDate(15);

    // Click OK to confirm the date selection
    await driver.$(dialogsPage.datePickerOk).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    // Result format is "Date: YYYY-MM-DD". Year 2024 was selected; day 15
    // was tapped on the (current) month. Assert both.
    let result = await dialogsPage.getResultText();
    expect(result).toMatch(/^Date: 2024-\d{2}-15$/);
    const baselineAfterCalendarOk = result;

    // ── Part 2: Input Mode with Cancel ──
    await driver.$(dialogsPage.datePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.datePickerTitle);
    await driver.$(dialogsPage.datePickerSwitchInput).click();
    await driver.pause(500);

    expect(await dialogsPage.isVisible(dialogsPage.datePickerInputField)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerSwitchCalendar)).toBe(true);

    await dialogsPage.typeIntoEditText(dialogsPage.datePickerInputField, '12/25/2026');

    // Cancel — result must equal Part 1 baseline (typed value discarded)
    await driver.$(dialogsPage.datePickerCancel).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);
    result = await dialogsPage.getResultText();
    expect(result).toBe(baselineAfterCalendarOk);

    // ── Part 3: Input Mode with OK ──
    await driver.$(dialogsPage.datePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.datePickerTitle);
    await driver.$(dialogsPage.datePickerSwitchInput).click();
    await driver.pause(500);

    await dialogsPage.typeIntoEditText(dialogsPage.datePickerInputField, '06/15/2027');

    await driver.$(dialogsPage.datePickerOk).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);
    result = await dialogsPage.getResultText();
    expect(result).toBe('Date: 2027-06-15');

    // ── Part 4: Switch back to Calendar View from Input Mode ──
    // Re-open and switch to input mode
    await driver.$(dialogsPage.datePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.datePickerTitle);
    await driver.$(dialogsPage.datePickerSwitchInput).click();
    await driver.pause(500);

    // Click "Switch to calendar" icon to go back to calendar view
    await driver.$(dialogsPage.datePickerSwitchCalendar).click();
    await driver.pause(500);

    // Verify calendar view elements are visible again
    expect(await dialogsPage.isVisible(dialogsPage.datePickerYear)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerPrevMonth)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerNextMonth)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerSwitchInput)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerCancel)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.datePickerOk)).toBe(true);

    // Click Cancel to exit
    await driver.$(dialogsPage.datePickerCancel).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);
  });

  test('TC-D05-NEG: should show "Invalid format." error when submitting empty date input', async ({ driver }) => {
    // Open Date Picker
    await driver.$(dialogsPage.datePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.datePickerTitle);

    // Switch to input mode via pencil icon
    await driver.$(dialogsPage.datePickerSwitchInput).click();
    await driver.pause(500);

    // Clear the input field
    const inputField = await driver.$(dialogsPage.datePickerInputField);
    await inputField.clearValue();
    await driver.pause(300);

    // Click OK with empty input
    await driver.$(dialogsPage.datePickerOk).click();
    await driver.pause(500);

    // Verify "Invalid format." error message is displayed
    expect(await dialogsPage.isVisible(dialogsPage.datePickerInvalidFormat)).toBe(true);

    // Pause briefly to let the keyboard settle, then Cancel to close
    await driver.pause(1500);
    await driver.$(dialogsPage.datePickerCancel).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);
  });

  test('TC-D06: should verify Time Picker — analog dial mode with OK and Cancel, text input mode with OK and Cancel', async ({ driver }) => {
    // ── Part 1: Analog Dial Mode with OK ──
    await driver.$(dialogsPage.timePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.timePickerTitle);

    expect(await dialogsPage.isVisible(dialogsPage.timePickerHours)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerMinutes)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerAm)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerPm)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerSwitchInput)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerCancel)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerOk)).toBe(true);

    // Set time to 10:30 AM via dial canvas tap
    await dialogsPage.setHours(10);
    await dialogsPage.setMinutes(30);
    await dialogsPage.selectPeriod('AM');

    await driver.$(dialogsPage.timePickerOk).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    // Result format is "Time: H:MM AM/PM" (no leading-zero hour)
    let result = await dialogsPage.getResultText();
    expect(result).toBe('Time: 10:30 AM');
    const baselineAfterDialOk = result;

    // ── Part 2: Analog Dial Mode with Cancel ──
    await driver.$(dialogsPage.timePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.timePickerTitle);

    await dialogsPage.setHours(2);
    await dialogsPage.setMinutes(45);
    await dialogsPage.selectPeriod('PM');

    // Cancel — result must equal Part 1 baseline (set values discarded)
    await driver.$(dialogsPage.timePickerCancel).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);
    result = await dialogsPage.getResultText();
    expect(result).toBe(baselineAfterDialOk);

    // ── Part 3: Text Input Mode with OK ──
    await driver.$(dialogsPage.timePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.timePickerTitle);
    await driver.$(dialogsPage.timePickerSwitchInput).click();
    await driver.pause(500);

    expect(await dialogsPage.isVisible(dialogsPage.timePickerInputTitle)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerHourInput)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerMinuteInput)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerAm)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerPm)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerSwitchDial)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerCancel)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.timePickerOk)).toBe(true);

    await dialogsPage.typeIntoEditText(dialogsPage.timePickerHourInput, '2');
    await dialogsPage.typeIntoEditText(dialogsPage.timePickerMinuteInput, '45');
    await dialogsPage.selectPeriod('PM');

    await driver.$(dialogsPage.timePickerOk).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);
    result = await dialogsPage.getResultText();
    expect(result).toBe('Time: 2:45 PM');
    const baselineAfterInputOk = result;

    // ── Part 4: Text Input Mode with Cancel ──
    await driver.$(dialogsPage.timePickerBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.timePickerTitle);
    await driver.$(dialogsPage.timePickerSwitchInput).click();
    await driver.pause(500);

    await dialogsPage.typeIntoEditText(dialogsPage.timePickerHourInput, '8');
    await dialogsPage.typeIntoEditText(dialogsPage.timePickerMinuteInput, '15');
    await dialogsPage.selectPeriod('AM');

    // Cancel — result must equal Part 3 baseline
    await driver.$(dialogsPage.timePickerCancel).click();
    await dialogsPage.waitForDisplayed(dialogsPage.title);
    result = await dialogsPage.getResultText();
    expect(result).toBe(baselineAfterInputOk);
  });

  test('TC-D07: should verify Simple Dialog radio option selection for all colors', async ({ driver }) => {
    // ── Select Red ──
    await driver.$(dialogsPage.simpleDialogBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.simpleDialogTitle);

    // Verify Simple Dialog elements
    expect(await dialogsPage.isVisible(dialogsPage.simpleDialogOptionRed)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.simpleDialogOptionBlue)).toBe(true);
    expect(await dialogsPage.isVisible(dialogsPage.simpleDialogOptionGreen)).toBe(true);

    // Select Red
    await dialogsPage.selectSimpleOption('Red');
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    // Verify result shows "Red selected"
    let result = await dialogsPage.getResultText();
    expect(result).toContain('Red selected');

    // ── Select Blue ──
    await driver.$(dialogsPage.simpleDialogBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.simpleDialogTitle);
    await dialogsPage.selectSimpleOption('Blue');
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    // Verify result shows "Blue selected"
    result = await dialogsPage.getResultText();
    expect(result).toContain('Blue selected');

    // ── Select Green ──
    await driver.$(dialogsPage.simpleDialogBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.simpleDialogTitle);
    await dialogsPage.selectSimpleOption('Green');
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    // Verify result shows "Green selected"
    result = await dialogsPage.getResultText();
    expect(result).toContain('Green selected');
  });

  test('TC-D08: should verify Full-Screen Dialog display, back navigation, and result card update', async ({ driver }) => {
    // Open Full-Screen Dialog
    await driver.$(dialogsPage.fullScreenBtn).click();
    await dialogsPage.waitForDisplayed(dialogsPage.fullScreenTitle);

    // Verify Full-Screen Dialog elements
    expect(await dialogsPage.isVisible(dialogsPage.fullScreenDesc)).toBe(true);

    // Go back using header back button
    await dialogsPage.goBackFromFullScreen();
    await dialogsPage.waitForDisplayed(dialogsPage.title);

    // Verify we're back on the Dialogs page
    expect(await dialogsPage.isVisible(dialogsPage.title)).toBe(true);

    // Verify result card shows "Full Screen: Closed"
    const result = await dialogsPage.getResultText();
    expect(result).toContain('Closed');
  });
});
