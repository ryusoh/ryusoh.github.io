## 2025-04-02 - Extracting methods for cyclomatic complexity

**Learning:** When using the `eslint.ESLint` API programmatically (e.g., via a Node script) to lint files with flat configs, avoid passing negated glob patterns (like `!js/vendor/**/*.js`) to `lintFiles()`, as this can throw an `AllFilesIgnoredError`. Instead, rely on the existing ignores in `eslint.config.cjs`, or pass explicit file lists.
**Action:** Created internal helper functions in `js/ambient/ambient.js`, `js/ambient/quantum_particles.js`, and `js/page-transition.js` to keep cyclomatic complexity strictly below 10 while maintaining identical functionality.

- Reduced complexity in js/ambient/loader.js by extracting test exports to exportTesting function.
- Handled synchronous errors gracefully in js/ambient/loader.js by adding window.AppLogger.error fallback.

## 2026-04-15 - Refactored loader complexity

**Learning:** When addressing cyclomatic complexity (>10) in large IIFEs, extracting repetitive error handling into dedicated helper functions like `handleAsyncError` and `handleSyncError` effectively reduces complexity and improves readability without breaking the module's core logic.
**Action:** Refactored `js/ambient/loader.js` by breaking down the main function into smaller, single-responsibility functions, successfully bringing the cyclomatic complexity down below the threshold.
