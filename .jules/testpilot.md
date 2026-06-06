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
