## 2026-03-13 - [DOM XSS Bypass via URL Control Characters]

**Vulnerability:** The `PageTransition.prototype.navigate` function was vulnerable to a DOM XSS bypass. It relied on `String.prototype.trim()` to sanitize URLs before checking for malicious schemes like `javascript:`.
**Learning:** `trim()` only removes standard whitespace. Browsers ignore various control characters (e.g., `\x01` to `\x1F`) at the beginning of a URL when evaluating the scheme. An attacker could bypass the `.startsWith('javascript:')` check by prepending a control character (e.g., `\x01javascript:alert(1)`), which would then be executed by `window.location.assign()`.
**Prevention:** Always use robust normalization, such as a regular expression `url.replace(/^[\s\u0000-\u001F]+/g, '')`, to strip both whitespace and control characters before validating URL schemes to prevent XSS.

## 2026-03-24 - [Cyclomatic Complexity & Silent Failures Cleanup]

**Vulnerability:** Empty catch blocks can suppress critical initialization or operational errors, hiding bugs and delaying diagnosis. High cyclomatic complexity (> 10) increases cognitive load and maintenance overhead.
**Learning:** During the codebase health pass, multiple critical `catch {}` blocks were identified in `js/page-transition.js`, `js/ambient/ambient.js`, and other core modules that masked runtime exceptions. Additionally, core navigational functions had overgrown into tightly coupled, monolithic blocks.
**Prevention:** Never use empty catch blocks unless explicitly intentional (and documented with a comment) for non-critical, degradable features. Extract complex logic into smaller, single-responsibility sub-functions to keep cyclomatic complexity strictly below 10 for maintainability and readability.

## 2026-03-24 - [CSP Inline Script Execution Risk]
**Vulnerability:** The Content-Security-Policy (CSP) `script-src` directive contained `'unsafe-inline'`, which allows the execution of arbitrary inline scripts embedded within HTML elements. This poses a significant XSS risk if an attacker manages to inject HTML into the page.
**Learning:** During review, it was confirmed that all inline scripts (such as Google Analytics bootstrapping) had previously been migrated to external files (e.g., `js/ga.js`). The `'unsafe-inline'` directive was therefore a remnant of older architecture and provided no functional value, only risk.
**Prevention:** Regularly review CSP directives to ensure they enforce the principle of least privilege. Explicitly omit `'unsafe-inline'` and `'unsafe-eval'` from `script-src` and rely exclusively on external scripts, nonces, or hashes to mitigate DOM XSS.
