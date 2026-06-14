# Testing notes (Jest + jsdom)

Hard-won gotchas for this repo's Jest suite (`tests/js/`, jest-environment-jsdom 29).
Add a dated entry when you hit a new one.

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
