## 2024-05-18 - Node VM Environment Mocking for Frontend Utility Scripts

**Learning:** Testing unexported vanilla JS utilities (e.g., `preloader.js`, `service-worker-register.js`, `ga.js`) requires reading the raw source with `fs.readFileSync` and evaluating it inside a custom `vm.runInContext`. When the script has synchronous side effects on load (such as attaching `DOMContentLoaded` event listeners that may crash or create unwanted behavior in the test runner), these strings must be stripped from the source code using regex before `vm.runInContext` evaluation.

## 2025-03-01 - Testing window fallback structures

**Learning:** When testing scripts that attach themselves globally like `window.AMBIENT_CONFIG = Object.assign({...}, window.AMBIENT_CONFIG)`, one must ensure the context provides a valid `Object` constructor and an empty initial `window` object to prevent `ReferenceError`s and allow successful assignment in the Node `vm` context.

## 2025-03-16 - Standard Jest Coverage Reporting Limitations for VM Scripts

**Learning:** Standard Jest coverage reporting (`--coverage`) natively reports 0% for browser scripts read via `fs.readFileSync` and evaluated in Node's `vm` context. Test coverage gaps for these files must be identified through manual codebase inspection alongside evaluating test suites.

## 2025-03-16 - Service Worker Lifecycle and Strategy Mocking

**Learning:** When unit testing the Service Worker (`sw.js`) in Node's `vm` context, provide robust manual mocks for `self` (including `addEventListener`, `skipWaiting`, `clients.claim`), `caches` (`open`, `match`, `keys`, `delete`), and global `fetch` to adequately simulate and test caching strategies and lifecycle events.

## 2025-03-18 - Exposing global context tools and stripping exports for Node VM

**Learning:** When using Node `vm` to evaluate modular scripts (ES6 `export` classes/functions) that rely on DOM timer APIs (`requestAnimationFrame`, `cancelAnimationFrame`), the script text must be sanitized to remove `export` keywords prior to evaluation. Furthermore, global context variables required directly by the file (e.g. `cancelAnimationFrame`) must be provided explicitly in the `context` object passed to `vm.createContext`, as they are not intrinsically available unless mirrored from the mocked `window` object.

## 2025-03-21 - Extracting nested unexported functions in IIFEs

**Learning:** When extracting an internal function from an IIFE for isolated testing in a vm context, use a non-greedy multiline regex (e.g., `code.match(/function myFunc\(\) {[\s\S]*?}/)[0]`) to reliably extract its exact source string, rather than complex `.replace()` chains that mangle closure scopes.

## 2024-05-18 - Defensive Missing Global Fallback

**Learning:** When asserting behavior in Edge Cases for utilities expecting globals (e.g. `window.console` during failure states), one must test both if `window.console` is missing entirely and if specific properties (e.g. `window.console.warn`) are missing, to ensure defensive coding doesn't inadvertently mask failures by crashing.

## 2024-05-18 - Testing Early Exit and Rate Limit Conditions

**Learning:** When checking logic that includes rate limits, boundaries, or early exits to avoid re-running calculations (e.g., bypassing fallback logic in `font-awesome-loader` if `this.fontAwesomeLoaded` is already true, or early exiting in `page-transition.js` if the payload exceeds 5MB), verify that these explicit conditions prevent internal API calls like `sessionStorage.setItem` or `stopChecking` using `.not.toHaveBeenCalled()`.

## 2025-03-24 - Defensive Coding Practices and Refactoring Code

**Learning:** When addressing code smells like 'no-empty' catch blocks, 'no-unused-expressions', and complexity violations in vanilla JS utilities, it is crucial to employ defensive checking for the global environment (e.g. `typeof window !== 'undefined'`, checking if `window.console` and `window.console.warn` exist). The `void` operator can be used to explicitly evaluate an expression while safely indicating to tools like ESLint that the return value is intentionally ignored (e.g., `void this.container.offsetHeight;`).

## 2025-03-24 - Defensive Testing for Global Fallbacks

**Learning:** When testing defensive fallback structures (e.g. fallbacks when an API throws), always include tests that verify the code gracefully handles the scenario where the fallback itself (like ) is missing from the environment, to ensure defensive code doesn't inadvertently introduce new crashing bugs.
