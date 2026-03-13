## 2026-03-11 - Native Lazy Loading on Image Heavy Pages

**Learning:** Found that the portfolio pages (p1/, p2/, p3/) are extremely image-heavy, loading up to ~16MB of images concurrently without native lazy loading on the `<img>` tags. The site relies heavily on a block-navigation component that depends on intersecting viewports, but fetching all these high-res (approx 1MB each) images at once blocks critical bandwidth and parse time.

**Action:** Always add `loading="lazy"` to below-the-fold `<img ...>` tags to massively defer offscreen image network requests, significantly improving Initial Load Time and reducing unnecessary bandwidth usage.

## 2026-03-12 - `requestAnimationFrame` for Debounced Scroll Listeners

**Learning:** Found that `debounce` functions used for scroll and resize handlers (`syncCurrentIndex`, `updatePositions`) were relying solely on `setTimeout`. This causes the callback (which often involves synchronous DOM reads like `getBoundingClientRect`) to fire out-of-sync with the browser's render cycle, leading to layout thrashing.

**Action:** Always wrap the final delayed execution of UI-bound debounced functions in `requestAnimationFrame`. This guarantees that heavy layout recalculations happen immediately before the frame is painted, improving performance and predictability on heavy pages.

## 2026-03-13 - Layout Thrashing in Polling Loaders

**Learning:** Found that the `FontAwesomeLoader` in `js/font-awesome-loader.js` was causing significant layout thrashing. It polled for font load completion every 100ms by dynamically creating an `<i>` element, appending it to the DOM, reading its computed style (forcing a synchronous layout/reflow), and then removing it.

**Action:** To prevent layout thrashing during repeated DOM-based state checks, always prefer reusing a persistent hidden element instead of appending and removing temporary elements on every interval tick.
