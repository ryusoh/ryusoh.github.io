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

## 2025-03-24 - Service Worker Test Environment Mocks

**Learning:** When testing Service Worker `fetch` logic in JSDOM environments, explicitly mock both `global.self.location.origin` and `window.self.location.origin` to match the test URL's origin, ensuring same-origin policy checks evaluate correctly.

## 2025-03-24 - Mocking performance.now with Fake Timers

**Learning:** When unit testing modules that rely on `performance.now()` in JSDOM with Jest fake timers, explicitly mock `window.performance.now` _before_ the module is required. This ensures any internal closure bindings (e.g., `perfNow = window.performance.now.bind(...)`) properly capture the mocked timer mechanism.

## 2025-03-24 - Handling Fake Timers and DOM Events inside Node VM context

**Learning:** Test methods using fake timers that evaluate JavaScript source string files containing `setTimeout` or `setInterval` should ensure `jest.useFakeTimers()` applies to global execution properly, especially when evaluating string logic via `vm.runInContext`. If issues arise where fake timers fail inside `vm` context evaluation, avoid string evaluation in favor of importing modules directly or ensuring timer mocks are explicitly mapped to the VM context during creation. In this codebase, Jest handles `jest.useFakeTimers()` natively well when testing files imported directly instead of `vm.runInContext`.

## 2025-03-24 - Testing DOM elements evaluated by Node VM

**Learning:** When testing DOM interactions like `document.createElement('link')` alongside `setTimeout` or `setInterval` execution inside Node VM contexts, you must construct the objects globally before evaluation or ensure that the `window` context passed into `vm.createContext()` is well-formed to correctly execute logic like `setTimeout`. This allows testing DOM modifications explicitly added by scripts using `.appendChild()` during asynchronous events.

## 2025-05-06 - Test Coverage for page-transition.js

**Learning:** In this repository, internal vanilla JS utility functions are exposed to the Jest test environment by adding them to a global testing object at the bottom of the source file (e.g., `window.__PageTransitionForTesting`).
**Action:** When adding test coverage to unexported internal functions in vanilla JS files, safely expose them by appending them to the existing `window.__*ForTesting` object rather than fundamentally changing module structure or application logic.

## 2024-05-24 - JSDOM Mocking Learnings

**Learning:** In JSDOM test environments, `window.location` and its methods (e.g., `window.location.assign`) are read-only. Attempting to directly mock them via `window.location.assign = jest.fn();` throws TypeErrors.
**Action:** When mocking navigation, use `delete window.location` followed by reassigning a mock object, ensuring restoration of the original location object in an `afterEach` hook or at the end of the test.

## 2024-05-24 - Console Mocks and Matcher Errors

**Learning:** In JSDOM tests running through Jest, asserting `expect(window.console.warn).toHaveBeenCalled(...)` without explicitly spying on or replacing `window.console.warn` with a mock function (`jest.fn()`) will cause Jest to immediately throw a `Matcher error: received value must be a mock or spy function`.
**Action:** Always replace or spy on console methods (`jest.spyOn(console, 'warn')` or `window.console.warn = jest.fn()`) before making assertions against them.

## 2024-05-24 - Closure Spying Flaws in IIFEs

**Learning:** When unit testing internal functions within an IIFE closure (e.g., \`navigate\` calling \`exitPage\` internally), you cannot use \`jest.spyOn\` on the globally exported test wrapper (e.g., \`window.\_\_PageTransitionForTesting\`) to intercept calls between sibling functions inside the closure. The spy will fail to intercept the internal call, leading to false-positive assertions or logic breakdowns.
**Action:** Always test the resulting side-effects of internal closure functions (e.g., verifying DOM manipulations, class additions, or delayed \`window.location.assign\`) rather than attempting to spy on the exported references.

## 2024-05-24 - Npx Jest Arguments Handling

**Learning:** Running \`pnpm test -- --coverage\` fails with 'No tests found' because Jest interprets \`--coverage\` as a test regex match due to argument interception issues.
**Action:** Always use \`npx jest --coverage\` directly to successfully generate coverage reports.

## 2025-02-24 - Testing Module-Level Event Listeners in JSDOM

**Learning:** When testing global event handlers attached within an IIFE upon file require (`require('module.js')`), `jest.resetModules()` prevents caching issues, but JSDOM does not clear `document` or `window` event listeners between test blocks since the global `document` instance is shared. This causes event listener leaks where multiple versions of closures are triggered during `dispatchEvent`, leading to falsely preventing defaults.
**Action:** Replace `document.addEventListener` with a mock function during `beforeEach` to intercept and locally capture the active listener array, then explicitly invoke `activeListener(event)` rather than relying on natural `dispatchEvent` bubbling to prevent cross-test contamination.

## 2024-05-27 - Meaningful Assertions for Coverage Gaps

**Learning:** When identifying and fixing coverage gaps, do not merely inject function executions into existing test blocks (like "coverage helpers") just to hit the lines. You must include meaningful assertions (`expect()`) that validate the state changes or expected behavior; otherwise, the tests are superficial and violate strict quality standards.

## 2024-05-27 - Accurate Test Scope Injection

**Learning:** When dynamically appending or injecting tests via scripts, ensure the new `describe` or `it` blocks are placed inside the correct parent `describe` scope. Placing tests outside the main suite can lead to `ReferenceError`s due to missing mocked classes or shared test `context` variables that are defined within the main block.

## 2025-05-24 - Test State Leakage Prevention in VM Contexts

**Learning:** When testing in JSDOM or \`vm\` contexts and modifying shared context objects (e.g., \`context.window.console\`) within a \`beforeEach\` block, always cache the original object and restore it in an \`afterEach\` block. Failure to do so causes test state leakage and cross-suite contamination, which breaks other tests that depend on the original object reference.

## 2025-05-24 - Strictly Limiting Testing Exposure Scope

**Learning:** When writing unit tests and adding functions to the global testing export object (e.g., \`window.\_\_\*ForTesting\`), strictly avoid exposing unnecessary internal constants or unrelated helper variables. Doing so clutters the export and violates the boundary against modifying feature code unnecessarily. Tests should be evaluated against the public/intended interfaces.

## 2024-05-25 - Mocking matchMedia and URLSearchParams in global context

**Learning:** When mocking `window.matchMedia` or `window.URLSearchParams` to test error fallback paths (especially inside utilities like `ambient/quantum_particles.js` or `block-navigation.js`), it's essential to safely mock `window.console.warn` at the same time to prevent the expected warnings from spilling into the terminal. Use `Object.defineProperty` or `try...finally` blocks to restore all original global functions (`console.warn`, `matchMedia`, `URLSearchParams`) immediately after execution.

**Learning:** In JSDOM test environments, dynamically setting an element's `contenteditable` attribute (e.g., `element.setAttribute('contenteditable', 'true')`) may not immediately update its native `isContentEditable` property. To reliably evaluate `isContentEditable` logic in tests (e.g., `block-navigation.js`), explicitly mock the property directly (e.g., `Object.defineProperty(element, 'isContentEditable', { value: true })`).
