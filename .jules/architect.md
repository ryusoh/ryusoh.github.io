## 2025-04-02 - Extracting methods for cyclomatic complexity

**Learning:** When using the `eslint.ESLint` API programmatically (e.g., via a Node script) to lint files with flat configs, avoid passing negated glob patterns (like `!js/vendor/**/*.js`) to `lintFiles()`, as this can throw an `AllFilesIgnoredError`. Instead, rely on the existing ignores in `eslint.config.cjs`, or pass explicit file lists.
**Action:** Created internal helper functions in `js/ambient/ambient.js`, `js/ambient/quantum_particles.js`, and `js/page-transition.js` to keep cyclomatic complexity strictly below 10 while maintaining identical functionality.

- Reduced complexity in js/ambient/loader.js by extracting test exports to exportTesting function.
- Handled synchronous errors gracefully in js/ambient/loader.js by adding window.AppLogger.error fallback.

## 2026-04-15 - Refactored loader complexity

**Learning:** When addressing cyclomatic complexity (>10) in large IIFEs, extracting repetitive error handling into dedicated helper functions like `handleAsyncError` and `handleSyncError` effectively reduces complexity and improves readability without breaking the module's core logic.
**Action:** Refactored `js/ambient/loader.js` by breaking down the main function into smaller, single-responsibility functions, successfully bringing the cyclomatic complexity down below the threshold.

## 2026-04-23 - Extracting methods for cyclomatic complexity in js/ambient/loader.js

**Learning:** When addressing high cyclomatic complexity (e.g. >10) in monolithic initialization scripts like `js/ambient/loader.js`, extracting logical sections such as the asynchronous loading sequence and synchronous error handlers into dedicated internal helper functions (`initLoader`, `handleAsyncError`, `handleSyncError`) effectively reduces complexity scores while preserving the identical IIFE structure and functionality.
**Action:** Refactored `js/ambient/loader.js` to reduce cyclomatic complexity from 12 to 6, maintaining graceful fallbacks and the `AppLogger` integration.

## 2026-06-25 - [Lowering Cyclomatic Complexity]

**Learning:** High cyclomatic complexity (> 10) significantly increases cognitive load and maintenance overhead, leading to fragile code. The codebase strictly limits cyclomatic complexity.
**Action:** Always extract nested logic, such as large callbacks, closures inside loops, and verbose initialization sequences, into smaller, single-responsibility helper functions located in the outer scope, ensuring complexity remains strictly below 10.

## 2026-10-25 - Extracting methods for cyclomatic complexity in js/magnetic-nav.js, js/page-transition.js, js/block-navigation.js and js/ambient/quantum_particles.js

**Learning:** Extracting code logic into smaller helper functions drastically decreases cyclomatic complexity of individual functions without impacting expected functionality. This keeps the codebase maintainable and strictly obeys maximum allowed complexity threshold (7).
**Action:** Extracted logic in `js/magnetic-nav.js`, `js/page-transition.js`, `js/block-navigation.js` and `js/ambient/quantum_particles.js` to new single-responsibility functions. The code passed 100% tests and ESLint complexity limits.

## 2026-12-05 - Refactored handleSyncError complexity

**Learning:** When addressing cyclomatic complexity, deeply nested logic with multiple logical operators (like `&&` and `!==`) quickly drives up complexity score.
**Action:** Refactored `handleSyncError` in `js/ambient/loader.js` by extracting `getFallbackLogger` helper function. This reduced the cyclomatic complexity of `handleSyncError` from 7 to 5.

## 2026-12-05 - Lowering Cyclomatic Complexity in Service Worker

**Learning:** Extracted logic in `sw.js` to new single-responsibility functions. The code passed 100% tests and ESLint complexity limits.
**Action:** Always extract nested logic, such as large callbacks, closures inside loops, and verbose initialization sequences, into smaller, single-responsibility helper functions located in the outer scope, ensuring complexity remains strictly below 10.

## 2024-06-20 - Refactoring test cyclomatic complexity
**Learning:** Jest tests containing multiple deeply nested anonymous functions and large mock setups inside `describe` blocks can trigger ESLint cyclomatic complexity warnings. Extracting nested logic (like mock setup defaults and manual test helper calls) into separate standalone or top-level `function`s brings complexity back under 10.
**Action:** Always extract configuration and triggering functions in Jest test files when they become too large.