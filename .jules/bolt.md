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

## 2026-03-17 - DOM Layout Reads Inside Render Loops

**Learning:** Found that `metrics()` in `js/ambient/ambient.js` was being called inside the 60fps `requestAnimationFrame` loop (`s.update` and `reset()`). This function read `clientWidth` and `clientHeight` from the DOM. Reading layout properties triggers synchronous layout calculations if the DOM is invalidated, which can severely degrade animation performance and cause layout thrashing on the main thread.
**Action:** Always avoid reading DOM layout properties (`clientWidth`, `offsetWidth`, `getBoundingClientRect`, etc.) inside tight loops like `requestAnimationFrame`. Instead, cache these values during `resize` events and reuse the cached dimensions for calculations.

## 2026-03-18 - Redundant NodeList to Array conversion and Iteration

**Learning:** Iterating over a DOM `NodeList` multiple times, especially by first doing a boolean check and then converting it to an `Array` using `Array.from()` to use methods like `.find()`, causes unnecessary memory allocations and blocks the main thread during critical page load phases.
**Action:** Use a single `for...of` loop to iterate over DOM `NodeList` elements and store the reference to the target element directly instead of running multiple iteration passes and creating intermediate `Array` objects.

## 2026-03-24 - Unnecessary DOM/Style Writes in Continuous requestAnimationFrame Loops

**Learning:** Found that the custom cursor in `js/vendor/cursor.js` was continuously evaluating and writing layout updates to the DOM (`gsap.set`) during every `requestAnimationFrame` cycle, even when the cursor's visual position (`current`) and the underlying state (`value`) had converged. This resulted in perpetual layout thrashing and main-thread overhead even when the user wasn't interacting with the site.
**Action:** Always check if a threshold has been reached (e.g., comparing `Math.abs(current - target) > threshold`) inside continuous render loops. If properties have settled, strictly bypass any subsequent DOM and inline style manipulations to preserve CPU cycles and prevent the browser from constantly re-evaluating layouts.

## 2026-03-25 - Event Delegation for Image Load Events

**Learning:** Found that `bindImageLoadHandlers()` in `js/block-navigation.js` was iterating over `document.images` to attach individual `load` event listeners to every incomplete image. On image-heavy pages, this results in O(N) listener allocations and DOM bindings, increasing memory pressure and initialization time.
**Action:** When tracking `load` events for many elements (like images), use a single document-level event listener with `useCapture: true` (since `load` events do not bubble) and check `event.target.tagName === 'IMG'`. This O(1) approach leverages event delegation, drastically reducing memory overhead and main-thread execution time.

## 2026-03-26 - Cached MediaQueryList Evaluation

**Learning:** Calling `window.matchMedia` repeatedly incurs unnecessary main-thread parsing and garbage collection overhead. Since `MediaQueryList` properties like `.matches` update automatically when system preferences change, running string query evaluations constantly creates unnecessary bottlenecks.
**Action:** To minimize main-thread overhead and garbage collection, cache `MediaQueryList` objects from `window.matchMedia` (e.g., for `prefers-reduced-motion`) in module-scoped variables rather than calling the method repeatedly. The `.matches` property of the cached object remains reactive to system preference changes without re-parsing the query. When unit testing this behavior in Node's `vm` context, ensure the cached variable is reset between tests to avoid state leakage.

## 2026-03-27 - Throttle Synchronous DOM Reads in Scroll Listeners

**Learning:** Found that `updateVisibility` in `js/scroll-reveal-icon.js` was being called synchronously on every `scroll` and `resize` event. This function reads `scrollHeight`, `scrollTop`, and `innerHeight`. Calling these layout properties inside high-frequency event listeners forces the browser to synchronously recalculate layout on the main thread multiple times per frame, causing scroll jitter and layout thrashing.
**Action:** When handling `scroll` or `resize` events that require reading DOM layout geometry, always decouple the callback execution from the event listener by using `requestAnimationFrame` paired with a boolean locking flag (`ticking`). This ensures that the expensive DOM reads happen at most once per frame and are synchronized with the browser's native render cycle.

## 2026-03-28 - Avoid String Concatenation in Canvas Render Loops

**Learning:** Found that the ambient canvas effect was concatenating strings (`'rgba(255,255,255,' + p.a + ')'`) to set `ctx.fillStyle` for every particle inside the 60FPS `requestAnimationFrame` loop. With hundreds of particles, this creates thousands of short-lived string allocations per second, leading to significant memory churn and garbage collection pauses.

**Action:** Always prefer using a static `ctx.fillStyle` combined with dynamically updating `ctx.globalAlpha` inside high-frequency canvas drawing loops to eliminate string allocation overhead.
