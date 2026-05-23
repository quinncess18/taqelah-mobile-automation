# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03_nav/05_form.spec.js >> Navigation - Form Validation Suite (TC-F01-F06) >> TC-F01: should verify Form Validation page default state with all form fields
- Location: tests/specs/03_nav/05_form.spec.js:86:3

# Error details

```
Error: element ("~Open navigation menu") still not displayed after 15000ms
```

# Test source

```ts
  28  |       : '~Open navigation menu';
  29  | 
  30  |     this.backBtn = this.isAndroid
  31  |       ? 'android=new UiSelector().description("Back")'
  32  |       : '~Back';
  33  | 
  34  |     // App package identifiers — single source of truth for lifecycle operations
  35  |     this.appPackage = this.isAndroid ? 'com.taqelah.demo_app' : 'com.taqelah.demoApp';
  36  | 
  37  |     // Platform attribute name for reading element descriptions (content-desc
  38  |     // on Android, label on iOS). Single source of truth used by all POMs.
  39  |     this.attrName = this.isAndroid ? 'content-desc' : 'label';
  40  | 
  41  |     // App-global "added to cart" snackbar — fires from Product Detail's
  42  |     // Add to Cart button AND from a grid card's direct-add icon. Owned at
  43  |     // BasePage so any POM can wait on it without cross-POM reaching.
  44  |     this.addedSnackbar = this.isAndroid
  45  |       ? 'android=new UiSelector().descriptionContains("added to cart")'
  46  |       : '~added-snackbar';
  47  |   }
  48  | 
  49  |   /**
  50  |    * Clear text from an EditText field.
  51  |    * Essential for Flutter stability to ensure clean input.
  52  |    * @param {string} selector 
  53  |    */
  54  |   async clearField(selector) {
  55  |     const el = await this.driver.$(selector);
  56  |     await el.click();
  57  |     await el.clearValue();
  58  |     await this.driver.pause(500);
  59  |   }
  60  | 
  61  |   /**
  62  |    * Helper to perform a coordinate-based swipe (W3C Actions).
  63  |    * @param {number} startX 
  64  |    * @param {number} startY 
  65  |    * @param {number} endX 
  66  |    * @param {number} endY 
  67  |    * @param {number} duration
  68  |    */
  69  |   async swipe(startX, startY, endX, endY, duration = 1200) {
  70  |     await this.driver.performActions([
  71  |       {
  72  |         type: 'pointer',
  73  |         id: 'finger1',
  74  |         parameters: { pointerType: 'touch' },
  75  |         actions: [
  76  |           { type: 'pointerMove', duration: 0, x: startX, y: startY },
  77  |           { type: 'pointerDown', button: 0 },
  78  |           { type: 'pointerMove', duration: duration, origin: 'viewport', x: endX, y: endY },
  79  |           { type: 'pointerUp', button: 0 },
  80  |         ],
  81  |       },
  82  |     ]);
  83  |     await this.driver.pause(this.settlePause);
  84  |   }
  85  | 
  86  |   /**
  87  |    * Returns true if the element is currently displayed, false otherwise.
  88  |    * Safe: never throws.
  89  |    * @param {string} selector
  90  |    */
  91  |   async isVisible(selector) {
  92  |     try {
  93  |       const el = await this.driver.$(selector);
  94  |       return await el.isDisplayed();
  95  |     } catch {
  96  |       return false;
  97  |     }
  98  |   }
  99  | 
  100 |   /**
  101 |    * Intelligently check if an element is within the visible viewport.
  102 |    * More reliable than isDisplayed() for Flutter edge elements.
  103 |    * @param {string} selector 
  104 |    */
  105 |   async isInsideViewport(selector) {
  106 |     try {
  107 |       const el = await this.driver.$(selector);
  108 |       if (!(await el.isDisplayed())) return false;
  109 | 
  110 |       const { y } = await el.getLocation();
  111 |       const { height: elHeight } = await el.getSize();
  112 |       const { height: screenHeight } = await this.driver.getWindowRect();
  113 | 
  114 |       const elCenterY = y + (elHeight / 2);
  115 |       
  116 |       // COMFORT ZONE: Center of element must be between 20% and 80% of screen height
  117 |       return elCenterY >= (screenHeight * 0.2) && elCenterY <= (screenHeight * 0.8);
  118 |     } catch (err) {
  119 |       return false;
  120 |     }
  121 |   }
  122 | 
  123 |   /**
  124 |    * Wait for an element to be displayed.
  125 |    */
  126 |   async waitForDisplayed(selector, timeout = 10000) {
  127 |     const el = await this.driver.$(selector);
> 128 |     await el.waitForDisplayed({ timeout });
      |     ^ Error: element ("~Open navigation menu") still not displayed after 15000ms
  129 |     return el;
  130 |   }
  131 |   /**
  132 |    * Universal Reset to Top (Pure Navigation).
  133 |    * Returns the screen to the absolute ceiling without nudging.
  134 |    */
  135 |   async resetToTop(count) {
  136 |     const { width, height } = await this.driver.getWindowRect();
  137 |     const isTablet = width > 1200;
  138 |     const safeX = Math.round(width * 0.3);
  139 |     const resetCount = count || (isTablet ? 2 : 1);
  140 | 
  141 |     if (!isTablet) {
  142 |       for (let i = 0; i < resetCount; i++) {
  143 |         await this.driver.performActions([
  144 |           {
  145 |             type: 'pointer',
  146 |             id: 'finger1',
  147 |             parameters: { pointerType: 'touch' },
  148 |             actions: [
  149 |               { type: 'pointerMove', duration: 0, x: safeX, y: Math.round(height * 0.45) },
  150 |               { type: 'pointerDown', button: 0 },
  151 |               { type: 'pointerMove', duration: 400, origin: 'viewport', x: safeX, y: Math.round(height * 0.65) },
  152 |               { type: 'pointerUp', button: 0 },
  153 |             ],
  154 |           },
  155 |         ]);
  156 |         await this.driver.pause(150);
  157 |       }
  158 |     } else {
  159 |       // TABLET: Hit the absolute ceiling (Power Swipes UP)
  160 |       for (let i = 0; i < resetCount; i++) {
  161 |         await this.driver.performActions([
  162 |           {
  163 |             type: 'pointer',
  164 |             id: 'finger1',
  165 |             parameters: { pointerType: 'touch' },
  166 |             actions: [
  167 |               { type: 'pointerMove', duration: 0, x: safeX, y: Math.round(height * 0.25) },
  168 |               { type: 'pointerDown', button: 0 },
  169 |               { type: 'pointerMove', duration: 600, origin: 'viewport', x: safeX, y: Math.round(height * 0.9) },
  170 |               { type: 'pointerUp', button: 0 },
  171 |             ],
  172 |           },
  173 |         ]);
  174 |         await this.driver.pause(200);
  175 |       }
  176 |     }
  177 |     await this.driver.pause(500); 
  178 |   }
  179 | 
  180 |   /**
  181 |    * Performs a hardware 'Back' press.
  182 |    */
  183 |   async deviceBack() {
  184 |     if (this.isAndroid) {
  185 |       await this.driver.execute('mobile: shell', { command: 'input', args: ['keyevent', '4'] });
  186 |     } else {
  187 |       // iOS: prefer the app-bar Back button — it's deterministic and avoids the
  188 |       // left-edge drawer-open conflict. Pushed detail pages (Cart, About,
  189 |       // Gestures, …) expose a "Back" button (run 26210913562 confirmed it on
  190 |       // Cart/About); the flaky edge-swipe was leaving those pages off-Home and
  191 |       // breaking the next module's entry. Fall back to a left-edge Cupertino
  192 |       // back-swipe only on screens with no Back button (e.g. the catalog grid,
  193 |       // which shows a hamburger) — driver.back() does NOT pop Flutter on iOS.
  194 |       const backBtn = await this.driver.$(this.backBtn);
  195 |       const hasBack = await backBtn.isDisplayed().catch(() => false);
  196 |       if (hasBack) {
  197 |         await backBtn.click();
  198 |       } else {
  199 |         const { width, height } = await this.driver.getWindowRect();
  200 |         const y = Math.round(height * 0.5);
  201 |         await this.swipe(3, y, Math.round(width * 0.6), y, 350);
  202 |       }
  203 |     }
  204 |   }
  205 | 
  206 |   /**
  207 |    * Performs a hardware 'Home' press (Backgrounds app).
  208 |    */
  209 |   async deviceHome() {
  210 |     if (this.isAndroid) {
  211 |       await this.driver.execute('mobile: shell', { command: 'input', args: ['keyevent', '3'] });
  212 |     } else {
  213 |       // WDIO 8/9 removed the legacy `driver.backgroundApp(n)` method; use the
  214 |       // XCUITest mobile extension instead. `seconds: -1` backgrounds the app
  215 |       // indefinitely (we re-foreground via `deviceForeground` ourselves).
  216 |       await this.driver.execute('mobile: backgroundApp', { seconds: -1 });
  217 |     }
  218 |   }
  219 | 
  220 |   /**
  221 |    * Re-activates/Foregrounds the app.
  222 |    * @param {boolean} [isDestructive=false] - If true, forces a fresh launch with cleared state.
  223 |    */
  224 |   async deviceForeground(isDestructive = false) {
  225 |     if (this.isAndroid) {
  226 |       const intent = `${this.appPackage}/${this.appPackage}.MainActivity`;
  227 |       await this.driver.execute('mobile: startActivity', { intent, stop: isDestructive });
  228 |       const { width } = await this.driver.getWindowRect();
```