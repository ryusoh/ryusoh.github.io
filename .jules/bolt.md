## 2026-03-11 - Native Lazy Loading on Image Heavy Pages

**Learning:** Found that the portfolio pages (p1/, p2/, p3/) are extremely image-heavy, loading up to ~16MB of images concurrently without native lazy loading on the `<img>` tags. The site relies heavily on a block-navigation component that depends on intersecting viewports, but fetching all these high-res (approx 1MB each) images at once blocks critical bandwidth and parse time.

**Action:** Always add `loading="lazy"` to below-the-fold `<img ...>` tags to massively defer offscreen image network requests, significantly improving Initial Load Time and reducing unnecessary bandwidth usage.

## 2026-03-12 - `requestAnimationFrame` for Debounced Scroll Listeners

**Learning:** Found that `debounce` functions used for scroll and resize handlers (`syncCurrentIndex`, `updatePositions`) were relying solely on `setTimeout`. This causes the callback (which often involves synchronous DOM reads like `getBoundingClientRect`) to fire out-of-sync with the browser's render cycle, leading to layout thrashing.

**Action:** Always wrap the final delayed execution of UI-bound debounced functions in `requestAnimationFrame`. This guarantees that heavy layout recalculations happen immediately before the frame is painted, improving performance and predictability on heavy pages.

## 2026-03-13 - Layout Thrashing in Polling Loaders

**Learning:** Found that the `FontAwesomeLoader` in `js/font-awesome-loader.js` was causing significant layout thrashing. It polled for font load completion every 100ms by dynamically creating an `<i>` element, appending it to the DOM, reading its computed style (forcing a synchronous layout/reflow), and then removing it.

**Action:** To prevent layout thrashing during repeated DOM-based state checks, always prefer reusing a persistent hidden element instead of appending and removing temporary elements on every interval tick.

## 2026-03-15 - Natively Optimized DOM Traversal for Candidate Filtering

**Learning:** Found that `block-navigation.js` used a `TreeWalker` to iterate over every single DOM element in `document.body` (often thousands of nodes, like formatting tags and generic wrappers) to evaluate expensive `.matches()` and `.closest()` checks via the `shouldUseElement()` filter. This O(N) traversal entirely in JS-land was needlessly expensive.

**Action:** Whenever filtering a specific subset of nodes based on known CSS classes/attributes, avoid O(N) JS-land DOM tree iterations (`TreeWalker` or recursive node visiting). Always delegate the search to the browser's highly-optimized C++ selector engine using `document.querySelectorAll()` with the target selectors, and then filter the much smaller resulting NodeList.

## 2026-03-16 - Batch DOM Inserts with DocumentFragment

**Learning:** Found that `AssetPreloader` in `js/preloader.js` was appending up to ~34 image preload `<link>` elements one by one directly into `document.head` in a loop. This repetitive DOM manipulation can cause multiple style recalculations, reflows, and potential layout thrashing on the main thread during initialization.
**Action:** Always use a `DocumentFragment` (`document.createDocumentFragment()`) to batch multiple DOM insertions when creating elements in a loop. Append the newly created elements to the fragment first, and then append the entire fragment to the DOM in a single operation to minimize main thread blocking time.
