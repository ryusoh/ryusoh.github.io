## 2025-02-28 - JSDOM Origin and Global Event Listener Mocks

**Learning:** When writing navigation or click interception unit tests in JSDOM, `window.location.href` defaults to `http://localhost/`. Tests using external URLs (e.g., `https://example.com/test`) will falsely trigger cross-origin/same-origin validation barriers. Furthermore, tests spanning across modules with multiple internal references (`isAtTopOrBottom`, `getCurrentIndex`) must carefully sync or mock DOM layouts (`scrollHeight`, `scrollTop`) to accurately evaluate internally scoped closures without forcibly modifying feature code to expose them.

**Action:** Standardize same-origin test URL configurations across the suite by applying `Object.defineProperty` on `window.location` consistently, or use `http://localhost/test` paths. Prevent modifying `.js` feature files to expose properties purely for coverage purposes, and instead mock the environment to invoke internal calls via public event handlers.
