# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03_nav/02_gestures.spec.js >> Navigation - Gestures Interaction Suite (TC-M04-M08) >> TC-M07: should verify Double Tap to Zoom interaction
- Location: tests/specs/03_nav/02_gestures.spec.js:151:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  57  |       // iOS: after a reorder the just-displaced card (at whatever slot it lands)
  58  |       // reports visible="false" at (0,0) in the a11y tree (confirmed via
  59  |       // diagnostic XML), so we never read that row's own coords. iosDragLayout
  60  |       // derives all slot positions from the visible sibling rows (even pitch) and
  61  |       // infers the missing card by elimination. We still test the REAL action:
  62  |       // drag a card to a target slot and confirm it lands there. A landing read
  63  |       // can be transiently dirty, so each drag retries. Page reset → ascending is
  64  |       // covered by TC-M08.
  65  |       for (const cardId of [1, 2, 3, 4, 5]) {
  66  |         let layout = await gesturesPage.iosDragLayout();
  67  |         const startSlot = layout.order.indexOf(cardId) + 1;
  68  |         const choices = [1, 2, 3, 4, 5].filter(s => s !== startSlot);
  69  |         const targetSlot = choices[Math.floor(Math.random() * choices.length)];
  70  | 
  71  |         let moved = false;
  72  |         let attempts = 0;
  73  |         while (!moved && attempts < 3) {
  74  |           attempts++;
  75  |           const curSlot = layout.order.indexOf(cardId) + 1;
  76  |           await gesturesPage.iosReorder(layout.cx, layout.slotY(curSlot), layout.slotY(targetSlot));
  77  |           layout = await gesturesPage.iosDragLayout();
  78  |           moved = layout.order[targetSlot - 1] === cardId;
  79  |         }
  80  |         // Verify the actual action landed: card is now at its target slot
  81  |         expect(moved).toBe(true);
  82  |       }
  83  | 
  84  |       // Final sanity: every card still exists in the list (none lost). Checked by
  85  |       // id, not slot — the just-displaced card reports (0,0)/not-displayed and a
  86  |       // transient duplicate can mis-map a slot, but its NODE still exists and no
  87  |       // reorder ever drops a card. The per-drag checks above prove each landing.
  88  |       for (let id = 1; id <= 5; id++) {
  89  |         const nodes = await driver.$$(gesturesPage.dragItem(id));
  90  |         expect(nodes.length).toBeGreaterThan(0);
  91  |       }
  92  |       return; // No exit — continue to TC-M06 on the same page
  93  |     }
  94  | 
  95  |     // Android: per-step exact-slot verification via swap-model state tracker.
  96  |     const positionOf = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  97  | 
  98  |     for (const cardId of [1, 2, 3, 4, 5]) {
  99  |       const currentSlot = positionOf[cardId];
  100 |       // Target must differ from both the card's current slot and its default position
  101 |       const available = [1, 2, 3, 4, 5].filter(s => s !== currentSlot && s !== cardId);
  102 |       const targetSlot = available[Math.floor(Math.random() * available.length)];
  103 |       const displacedCardId = Number(Object.keys(positionOf).find(id => positionOf[Number(id)] === targetSlot));
  104 | 
  105 |       await gesturesPage.reorderItem(
  106 |         gesturesPage.dragItem(cardId),
  107 |         gesturesPage.dragSlot(targetSlot)
  108 |       );
  109 |       await driver.pause(1000);
  110 | 
  111 |       // Update state tracker (cards swap positions)
  112 |       positionOf[cardId] = targetSlot;
  113 |       positionOf[displacedCardId] = currentSlot;
  114 | 
  115 |       // Verify card landed at target: checks both position index and card ID
  116 |       expect(await gesturesPage.isVisible(gesturesPage.dragItemExact(targetSlot, cardId))).toBe(true);
  117 |     }
  118 | 
  119 |     // Verify all 5 position indexes still present (ascending order maintained)
  120 |     for (let i = 1; i <= 5; i++) {
  121 |       expect(await gesturesPage.isVisible(gesturesPage.dragSlot(i))).toBe(true);
  122 |     }
  123 |     // No exit — continue to TC-M06 on the same page
  124 |   });
  125 | 
  126 |   test('TC-M06: should verify Long Press popup and all three option interactions', async ({ driver }) => {
  127 |     await gesturesPage.scrollToSection(gesturesPage.sectionLongPress);
  128 | 
  129 |     // Verify initial state
  130 |     expect(await gesturesPage.isVisible(gesturesPage.sectionLongPress)).toBe(true);
  131 |     expect(await gesturesPage.isVisible(gesturesPage.instructionLongPress)).toBe(true);
  132 |     expect(await gesturesPage.isVisible(gesturesPage.longPressBtn)).toBe(true);
  133 | 
  134 |     const options = ['Copy', 'Share', 'Delete'];
  135 |     const expectedMessages = ['Copied!', 'Shared!', 'Deleted!'];
  136 | 
  137 |     for (let i = 0; i < options.length; i++) {
  138 |       await gesturesPage.longPress(gesturesPage.longPressBtn);
  139 | 
  140 |       // Verify all three dropdown options appear
  141 |       expect(await gesturesPage.isVisible(gesturesPage.optionCopy)).toBe(true);
  142 |       expect(await gesturesPage.isVisible(gesturesPage.optionShare)).toBe(true);
  143 |       expect(await gesturesPage.isVisible(gesturesPage.optionDelete)).toBe(true);
  144 | 
  145 |       await gesturesPage.tapOption(options[i]);
  146 |       expect(await gesturesPage.verifyToast(expectedMessages[i])).toBe(true);
  147 |     }
  148 |     // No exit — continue to TC-M07 on the same page
  149 |   });
  150 | 
  151 |   test('TC-M07: should verify Double Tap to Zoom interaction', async ({ driver }) => {
  152 |     await gesturesPage.scrollToSection(gesturesPage.doubleTapArea);
  153 | 
  154 |     await gesturesPage.doubleTapZoomCanvas();
  155 |     await gesturesPage.panCanvas();
  156 | 
> 157 |     expect(await gesturesPage.verifyCanvasHasContent()).toBe(true);
      |                                                         ^ Error: expect(received).toBe(expected) // Object.is equality
  158 |     // No exit — continue to TC-M08 on the same page
  159 |   });
  160 | 
  161 |   test('TC-M08: should verify Pinch to Zoom interaction and full page reset', async ({ driver }) => {
  162 |     await gesturesPage.scrollToSection(gesturesPage.pinchArea);
  163 | 
  164 |     const before = await gesturesPage.getPinchCenterBrightness();
  165 |     await gesturesPage.pinch(gesturesPage.pinchArea);
  166 |     const after = await gesturesPage.getPinchCenterBrightness();
  167 | 
  168 |     expect(after).not.toBe(before);
  169 | 
  170 |     // Single exit — verify entire Gestures page resets to default state
  171 |     await gesturesPage.goBack();
  172 |     await landingPage.waitForPageLoad();
  173 |     await navMenu.open();
  174 |     await navMenu.navigateTo(navMenu.navGestures);
  175 |     await gesturesPage.waitForPageLoad();
  176 | 
  177 |     // Swipe cards reset
  178 |     for (let i = 1; i <= 5; i++) {
  179 |       expect(await gesturesPage.isVisible(gesturesPage.swipeCard(i))).toBe(true);
  180 |     }
  181 | 
  182 |     // Drag items reset
  183 |     await gesturesPage.scrollToDragSection();
  184 |     for (let i = 1; i <= 5; i++) {
  185 |       expect(await gesturesPage.isVisible(gesturesPage.dragItemExact(i, i))).toBe(true);
  186 |     }
  187 | 
  188 |     // Long press reset
  189 |     await gesturesPage.scrollToSection(gesturesPage.sectionLongPress);
  190 |     expect(await gesturesPage.isVisible(gesturesPage.longPressBtn)).toBe(true);
  191 | 
  192 |     // Double tap canvas reset
  193 |     await gesturesPage.scrollToSection(gesturesPage.doubleTapArea);
  194 |     expect(await gesturesPage.isVisible(gesturesPage.doubleTapArea)).toBe(true);
  195 | 
  196 |     // Pinch canvas reset — brightness after re-navigation must be closer to pre-pinch than post-pinch
  197 |     await gesturesPage.scrollToSection(gesturesPage.pinchArea);
  198 |     const afterReset = await gesturesPage.getPinchCenterBrightness();
  199 |     expect(Math.abs(afterReset - before)).toBeLessThan(Math.abs(afterReset - after));
  200 | 
  201 |     await gesturesPage.goBack();
  202 |     await landingPage.waitForPageLoad();
  203 |   });
  204 | });
  205 | 
```