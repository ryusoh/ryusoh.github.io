## 2025-04-02 - Extracting methods for cyclomatic complexity

**Learning:** When using the `eslint.ESLint` API programmatically (e.g., via a Node script) to lint files with flat configs, avoid passing negated glob patterns (like `!js/vendor/**/*.js`) to `lintFiles()`, as this can throw an `AllFilesIgnoredError`. Instead, rely on the existing ignores in `eslint.config.cjs`, or pass explicit file lists.
**Action:** Created internal helper functions in `js/ambient/ambient.js`, `js/ambient/quantum_particles.js`, and `js/page-transition.js` to keep cyclomatic complexity strictly below 10 while maintaining identical functionality.

- Reduced complexity in js/ambient/loader.js by extracting test exports to exportTesting function.
- Handled synchronous errors gracefully in js/ambient/loader.js by adding window.AppLogger.error fallback.

## 2026-04-23 - Extracting methods for cyclomatic complexity in js/ambient/loader.js

**Learning:** When addressing high cyclomatic complexity (e.g. >10) in monolithic initialization scripts like `js/ambient/loader.js`, extracting logical sections such as the asynchronous loading sequence and synchronous error handlers into dedicated internal helper functions (`initLoader`, `handleAsyncError`, `handleSyncError`) effectively reduces complexity scores while preserving the identical IIFE structure and functionality.
**Action:** Refactored `js/ambient/loader.js` to reduce cyclomatic complexity from 12 to 6, maintaining graceful fallbacks and the `AppLogger` integration.
