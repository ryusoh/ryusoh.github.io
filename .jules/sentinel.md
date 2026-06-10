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

## 2026-03-24 - [Avoid Empty Catch Blocks]

**Vulnerability:** Empty catch blocks (e.g., `.catch(() => {})`) swallow errors silently, which can mask critical operational failures, underlying bugs, or signs of attack. This hinders debugging and security observability.
**Learning:** Found instances of `.catch(() => {})` in `js/page-transition.js` that suppressed texture loading failures. While graceful fallback is good, silent failure is an anti-pattern.
**Prevention:** Replace empty catch blocks with defensive logging using `window.console.warn` (checking `typeof window !== 'undefined'` first for environment safety). This preserves the graceful fallback while ensuring observability.

## 2026-03-24 - [Unbounded JSON Parse Length Limit DoS]

**Vulnerability:** Parsing arbitrarily large JSON payloads from untrusted client-side storage (`sessionStorage`) without length validation can lead to Denial of Service (DoS) attacks by exhausting memory and blocking the main thread execution during the `JSON.parse` operation.
**Learning:** Functions that retrieve and deserialize stored values (like cursor positions) must implement bounds checking _before_ passing strings to expensive parsers. Even if the data is expected to be a small object, malicious actors can manipulate client storage.
**Prevention:** Implement strict string length limits on all data read from `sessionStorage` or `localStorage` prior to parsing (e.g., `if (raw.length > 100) return null`) to mitigate memory exhaustion risks.

## 2026-03-28 - [Empty Catch Blocks in prefersReducedMotion]

**Vulnerability:** Empty catch blocks in `prefersReducedMotion` handlers across the codebase (`js/page-transition.js`, `js/ambient/ambient.js`, `js/block-navigation.js`) suppressed `window.matchMedia` errors. This silent failure hid potential issues in unsupported environments or testing contexts where `matchMedia` might throw.
**Learning:** While gracefully falling back to `false` (meaning motion is enabled) is the correct functional behavior when `matchMedia` fails, the error itself must still be observable for debugging and health monitoring. A silent `catch {}` prevents this visibility.
**Prevention:** Replace all empty catch blocks with defensive logging (e.g., `window.console.warn`). Always wrap the logging call in environmental safety checks (e.g., `typeof window !== 'undefined' && window.console`) to ensure the logging attempt itself does not cause a secondary fatal error.

## 2026-04-12 - [DoS via Unbounded URL Search Params]

**Vulnerability:** `URLSearchParams` was parsing `window.location.search` without any length limitations. An attacker could craft a massive query string, potentially causing performance degradation or memory exhaustion on the client-side.
**Learning:** Just as with `localStorage` parsing, any input derived from the environment—including URL parameters—should be length-validated before being handed off to native parsers, serving as a defense-in-depth measure.
**Prevention:** Apply a reasonable bounds check (e.g., 1000 characters) to `window.location.search` before invoking `URLSearchParams`.

## 2024-04-16 - [DoS via Hanging Fetch Requests]

**Vulnerability:** External `fetch` requests in `cdnFallback.js` lacked explicit timeouts. This could lead to client-side Denial of Service (DoS) and resource exhaustion if the remote server hung indefinitely, blocking the completion of the fallback CSS loading promise.
**Learning:** By default, the native `fetch` API does not implement a timeout. In environments where network reliability is uncertain, failing to bound the duration of network requests leaves the application vulnerable to stalled execution paths.
**Prevention:** Always wrap external `window.fetch` requests with an explicit timeout mechanism using `AbortController` and `setTimeout` (e.g., 5000ms), and ensure the timeout is cleaned up to prevent memory leaks.

## 2026-04-15 - Empty catch block audit

**Vulnerability:** Empty catch blocks hide failures and errors, making debugging difficult and obscuring silent crashes.
**Learning:** We need to explicitly log exceptions when catching them, even during progressive enhancements.
**Prevention:** Ensured all explicit catch blocks in source scripts handle the exceptions by logging warnings via a safe console check or AppLogger.

## 2026-05-13 - [DoS via Unbounded URL Parsing]

**Vulnerability:** The native `new window.URL()` constructor was repeatedly called with `window.location.href` to parse query parameters (e.g., `hasTransitionParam()`) without any length limitations. An attacker could craft an excessively long URL that forces the client to allocate significant memory and CPU time to parse it, causing a Denial of Service (DoS) and hanging the user's browser.
**Learning:** Even built-in browser functions like `new window.URL()` can be computationally expensive when forced to parse arbitrarily massive strings. Protecting against DoS requires validating the size of the input _before_ passing it to the parsing engine, just as we did for `URLSearchParams`.
**Prevention:** Apply bounds checking (e.g., `window.location.href.length > 2000`) before passing dynamic, attacker-controlled strings like URLs into native parsing constructors.

## 2026-06-25 - [Incomplete DoS Prevention on URL Parsing]

**Vulnerability:** While `window.location.search` was previously secured against massive lengths before parsing to prevent Denial of Service (DoS), the `window.location.href` and passed `url` string were passed to `new window.URL()` without length limits in `getValidatedUrl` and `buildTransitionUrl`. An attacker could exploit this by crafting a massive URL.
**Learning:** Security fixes must be comprehensive across all similar patterns. Fixing a DoS vulnerability for `URLSearchParams` but leaving `new window.URL` exposed reveals a gap in identifying all vector surfaces for a single class of vulnerability (Unbounded Input to Native Parsers).
**Prevention:** Apply rigorous pattern searching (`grep -rn 'new window.URL'`) when addressing DoS vulnerabilities to ensure all similar usages (e.g., `new window.URL`, `URLSearchParams`) enforce strict length boundaries (e.g., `> 2000` characters) on inputs derived from the environment.

## 2026-06-25 - [DoS via Unbounded URL Parsing in Service Worker]

**Vulnerability:** Similar to previous URL parsing vulnerabilities, `sw.js` instantiated `new URL(req.url)` inside `fetchLogic` without restricting the length of `req.url`. An attacker could exploit this by crafting an excessively long request URL, consuming vast CPU and memory resources to parse it within the Service Worker, potentially leading to a Denial of Service.
**Learning:** Native `URL` parsing is computationally expensive and poses a DoS vector if inputs are unrestricted. Service Workers, operating as a proxy layer, are equally susceptible to these vectors and must enforce length boundaries on incoming request URLs before processing them.
**Prevention:** Always implement strict string length limits (e.g., `if (req.url.length > 2000)`) on request URLs before passing them to native parsers like `new URL()` in both standard client scripts and Service Workers.

## 2026-06-25 - [Code Hygiene: Empty Catch Blocks & Cyclomatic Complexity]

**Vulnerability:** Empty catch blocks can suppress critical initialization or operational errors, hiding bugs and delaying diagnosis. High cyclomatic complexity (> 8) increases cognitive load and maintenance overhead.
**Learning:** During the codebase health pass, multiple critical `catch {}` blocks were identified in `js/page-transition.js`, `js/loader/imageFallback.js`, `js/scroll-reveal.js`, `js/service-worker-register.js`, and `js/ambient/config/default.js` that masked runtime exceptions. Additionally, core functions had overgrown into tightly coupled blocks.
**Prevention:** Never use empty catch blocks unless explicitly intentional (and documented with a comment) for non-critical, degradable features. Extract complex logic into smaller, single-responsibility sub-functions to keep cyclomatic complexity strictly below 8 for maintainability and readability.

## 2026-06-06 - [DoS via Unbounded sessionStorage Payload]

**Vulnerability:** The `storeCursorPositionForTransition` function in `js/page-transition.js` derived coordinate strings via `JSON.stringify` and wrote them directly to `sessionStorage` without any payload length verification. An attacker or unexpected condition could potentially inject massive payloads into client-side storage, causing Denial of Service (DoS) through storage quota exhaustion.
**Learning:** While `JSON.stringify` on numerical coordinates naturally produces short strings, defense-in-depth requires explicitly bounding inputs prior to storage API calls. The identical functionality in `js/vendor/cursor.js` already implemented this check (`if (payload.length > 200) return;`), highlighting a slight inconsistency across the codebase.
**Action:** Always implement explicit string length limits before invoking `sessionStorage.setItem` or `localStorage.setItem`, regardless of whether the payload is generated natively or passed from external input.

## 2024-05-20 - Security Header Meta Tags

**Vulnerability:** Ineffective security headers (`X-Frame-Options`, `X-Content-Type-Options`) implemented as HTML `<meta>` tags (Security Theater).
**Learning:** Modern browsers explicitly ignore these directives when placed inside HTML `<meta>` tags. They are only recognized and enforced when sent as actual HTTP response headers from the server.
**Prevention:** Never attempt to configure `X-Frame-Options` or `X-Content-Type-Options` using `<meta>` tags. Focus on server-level configuration or application-level logic for DOM security.

## 2026-12-05 - Avoid generic error suppressions

**Vulnerability:** Generic error suppressions and non-contextual log warnings make debugging challenging and can silently ignore critical errors by not distinguishing different failures.
**Learning:** Found instances where `catch (error) { logWarning('Caught exception:', error); }` was used generically. While not empty, it lacked sufficient context to be immediately actionable.
**Prevention:** Enhance generic catch blocks with descriptive, contextual messages (e.g. `logWarning('Caught exception during image fallback init:', error);`) so that errors trace directly back to their source operation.
