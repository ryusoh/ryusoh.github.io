# Testing notes (Jest + jsdom)

Hard-won gotchas for this repo's Jest suite (`tests/js/`, jest-environment-jsdom 30).
Add a dated entry when you hit a new one.

## 2026-06-28 — `Object.defineProperty(document, 'body')` overrides instance getter permanently, causing leaks

**Problem:** Defining a mock value for `document.body` on the document instance itself via `Object.defineProperty(document, 'body', { value: undefined })` breaks the JSDOM instance prototype getter.
Even if you attempt to restore it by defining the property back to its original value, it remains a static property on the instance rather than restoring the reactive prototype getter. As a result, in all subsequent tests in the same environment:

- Setting `document.documentElement.innerHTML = ...` creates new DOM elements but does not update `document.body`.
- `document.body` continues to return the old/detached body.
- `document.getElementById` and `document.querySelector` fail and return `null` because elements are parsed into the active document but searched for in the detached body reference.

**Fix:** Use Jest's `spyOn` to mock the getter on the prototype cleanly, allowing it to be fully restored with `.mockRestore()`:

```js
// In the test
const bodySpy = jest.spyOn(document, 'body', 'get').mockReturnValue(undefined);

// Execute code under test
require('../../js/page-transition.js');

// In afterEach or at the end of the test
bodySpy.mockRestore();
```

## 2026-06-16 — `window.location` / `window.document` are non-configurable in jsdom 26 (jest 30)

**Problem:** After bumping to jest 30 / jest-environment-jsdom 30 (jsdom 26), the
old location-mocking patterns all throw:

```js
delete window.location;                                  // Cannot delete property 'location'
window.location = new URL('https://example.com/');       //   (the delete above already threw)
Object.defineProperty(window, 'location', { value });    // Cannot redefine property: location
Object.defineProperty(window.location, 'href', { ... }); // Cannot redefine property: href
jest.replaceProperty(window, 'location', ...);           // Property `location` is not declared configurable
window.location.href = '...';                            // attempts a real (not-implemented) navigation
```

`global.document` is likewise a non-configurable accessor (no setter), so
`Object.defineProperty(global, 'document', { get: () => undefined })` throws
`Cannot redefine property: document` and `global.document = undefined` is a silent no-op.

**Fixes (in order of preference):**

- **Change `search` / `pathname` / `hash`** → use the History API, which mutates the
  _same_ Location object: `window.history.pushState({}, '', '/?ambient=on')`
  (use `replaceState({}, '', window.location.pathname)` to clear the query). Do **not**
  assign `window.location.search = ...` / `.href = ...` directly: each assignment is a
  no-op navigation that jsdom logs as `console.error: Not implemented: navigation
(except hash changes)`. The test still passes, but in a `beforeEach` this floods the
  output with one stack trace per test and looks like a failure.
- **Make `location.href` long** (for `href.length > 2000` guards) → set a long
  **hash**: `window.location.hash = '#' + 'a'.repeat(2000)` (then reset to `''`).
  `pushState` rejects URLs longer than ~2000 chars with a `SecurityError`, so it
  can't build a long href.
- **Vary `hostname` / `readyState`, or make a global absent** (i.e. anything
  `pushState`/hash can't reach, or testing a `typeof window.location === 'undefined'`
  guard) → run the source in a `vm` context with hand-built `window`/`document`/
  `navigator` globals. Good fit for load-time IIFEs like `service-worker-register.js`.
  If the source uses ES `import`, strip the import lines first
  (`code.replace(/^import .*$/gm, '')`) when the imported bindings aren't reached
  on the path under test — see `cursor-init.test.js`.
- **Set a per-file base URL** with a docblock when a whole suite needs one origin:
  `/** @jest-environment-options {"url": "https://example.com/"} */`.

## 2026-06-14 — Throwing getters on `window` are silently bypassed in jsdom

**Problem:** Simulating a synchronous error by defining a throwing accessor on a
`window` property does **not** work in jest-environment-jsdom 29:

```js
// Looks right, but the getter never fires.
Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    get: () => {
        throw new Error('boom');
    },
});
window.matchMedia; // => undefined (no throw), even though the descriptor's `get` is a function
```

The source's `catch` block never runs, so error-log assertions fail with
`Number of calls: 0`, and `.not.toThrow()` tests silently become no-ops. This bit
`tests/js/ambient/loader.test.js` and `tests/js/ambient/config/default.test.js`.

**Fix:** Inject the error through the operation the source actually performs, not a
property read:

- Source **calls** the global (e.g. `window.matchMedia('(...)')`) → use a throwing
  **function value**:

    ```js
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: jest.fn(() => {
            throw new Error('boom');
        }),
    });
    ```

- Source **assigns** to the global (e.g. `window.AMBIENT_CONFIG = ...`) → use a
  throwing **setter** (keep `get: () => undefined` so any RHS read still resolves):

    ```js
    Object.defineProperty(window, 'AMBIENT_CONFIG', {
        configurable: true,
        get: () => undefined,
        set: () => {
            throw new Error('boom');
        },
    });
    ```

Setters and function-value reads fire reliably; only accessor **getters on `window`**
are the broken case.
