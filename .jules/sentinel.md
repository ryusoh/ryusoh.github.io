## 2026-03-13 - [DOM XSS Bypass via URL Control Characters]

**Vulnerability:** The `PageTransition.prototype.navigate` function was vulnerable to a DOM XSS bypass. It relied on `String.prototype.trim()` to sanitize URLs before checking for malicious schemes like `javascript:`.
**Learning:** `trim()` only removes standard whitespace. Browsers ignore various control characters (e.g., `\x01` to `\x1F`) at the beginning of a URL when evaluating the scheme. An attacker could bypass the `.startsWith('javascript:')` check by prepending a control character (e.g., `\x01javascript:alert(1)`), which would then be executed by `window.location.assign()`.
**Prevention:** Always use robust normalization, such as a regular expression `url.replace(/^[\s\u0000-\u001F]+/g, '')`, to strip both whitespace and control characters before validating URL schemes to prevent XSS.
