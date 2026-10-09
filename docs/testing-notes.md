# Testing notes (Jest + jsdom)

Hard-won gotchas for this repo's Jest suite (`tests/js/`, jest-environment-jsdom 30).
Add a dated entry when you hit a new one.

## 2026-10-09 — Never couple unit tests to production galleries (`p1`–`p6`); use synthetic fixtures (`p99` / `p98`)

**Problem:** Tests in `tests/js/gaze.test.js` and `tests/js/sequence-skill.test.js`
originally asserted against living production galleries (`p3`, `p5`), hardcoding
exact image counts (e.g. 12 images, 11 transitions) and specific filenames
(`DSCF9004-3.jpg`, `DSCF9159.jpg`). When an artist curates, adds, replaces, or
sequences photos in a production portfolio, these tests immediately break even
though the underlying code has no regression. Furthermore, temporary builder
tests colliding on the same fixture ID risk deleting test assets during teardown.

**Fix:** Partition gallery identifiers strictly into three tiers:

1. **Production Galleries (`p1`–`p6`)**: Living portfolio content. **Never**
   write unit or integration tests that hardcode image counts, filenames, or
   transitions against these. Acceptance tests may scan them only for site-wide
   structural invariants (e.g., banner presence, mobile overflow, dock markup).
2. **Canonical Synthetic Fixture (`p99`)**: Permanent, version-controlled fixture
   at `assets/img/p99/`. Contains synthetic images with known dimensions and
   calibrated tonal profiles (`test1.jpg` Exhalation $L^* \approx 14$, `test2.jpg`
   Inhalation $L^* \approx 87$, `test3.jpg` Mid-tone $L^* \approx 51$, and
   `test_outtake.jpg`), along with static `index.md` and `commentary.json`. All
   unit tests for sequence analysis, gaze estimation, and report generation must
   target `p99`. When invoking report generation CLI scripts in tests, always
   pass `--report <scratchPath>` to avoid dirtying `assets/img/p99/` with SVG
   artifacts.
3. **Ephemeral Builder Workspace (`p98`)**: Reserved exclusively for dynamic
   page-builder tests (`tests/js/page-builder.test.js`) that create and teardown
   temporary HTML, markdown, and image directories.
4. **Asset & Acceptance Filters**: `scripts/build-images.mjs`,
   `scripts/generate-thumbhashes.mjs`, and all acceptance test scanners must
   explicitly filter out both `p99` and `p98` so synthetic test assets are never
   built into production tiers or crawled as public portfolio entries.

## 2026-10-09 — `vm.runInContext` suites accrue zero coverage; extend the "coverage helper" test

**Problem:** Suites like `tests/js/preloader.test.js` load the source via
`vm.createContext` + `vm.runInContext` (to control the sandbox). Istanbul only
instruments code that goes through Jest's `require`/transform pipeline, so
behavior exercised through the vm context reports **0%** — the file's coverage
comes entirely from a trailing `describe('coverage helper')` test that does
`require('../../js/<file>.js')` (instrumented) and pokes the branches. New
branches added to the source show up as uncovered lines even when vm-based
tests exercise them.

**Fix:** when you add behavior to such a file, extend the coverage-helper test
with an instrumented-`require` pass over the new branches (see
`tests/js/preloader.test.js` "connection gating branches in the instrumented
copy"). Two adjacent traps: (1) the helper's first test wraps its body in
`jest.isolateModules(() => { ... })`, so appending a `test()` right after that
call leaves it nested inside the running test — jest-circus fails with "Tests
cannot be nested"; read the file tail and count what the closing `});`s
actually close before inserting. (2) In the helper, mock state like
`navigator.connection` needs `Object.defineProperty(..., configurable: true)`
plus cleanup, since the real `navigator` is shared across tests.

## 2026-08-21 — Testing ESM scripts (.mjs) from CommonJS Jest suites without VM modules

**Problem:** Jest in this repo runs under CommonJS (`jest.config.cjs`). Attempting to `await import('../../scripts/foo.mjs')` directly inside a Jest test file triggers `SyntaxError: Cannot use import statement outside a module` because Jest's runtime environment intercepts `import()` without `--experimental-vm-modules`.

**Fix:** Execute the ESM script/module in a clean Node child process using `execFileSync` with `--input-type=module`:

```js
const { execFileSync } = require('child_process');

function runEsm(code) {
    const stdout = execFileSync('node', ['--input-type=module', '-e', code], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
    return JSON.parse(stdout.trim());
}

test('invokes ESM helper cleanly', () => {
    const res = runEsm(`
        import { computeSomething } from './.agents/skills/sequence/scripts/foo.mjs';
        console.log(JSON.stringify(computeSomething()));
    `);
    expect(res).toEqual(...);
});
```

This isolates ESM loading completely from Jest's transform pipeline while allowing full hermetic assertions over module exports and JSON returns.

## 2026-08-18 — Parallel Jest worker collisions: Synthetic project fixtures & shared disk state mutation

**Problem:** In CI or multi-worker runs (`jest --coverage --maxWorkers=N`), tests execute concurrently across separate worker processes. If an E2E test (e.g. `tests/js/page-builder.test.js`) generates a synthetic portfolio directory (`p99/`, `assets/img/p99/`) or runs a compiler that modifies shared repo files (`index.html`, `p1/index.html`, `js/preloader.js`) on disk, parallel acceptance tests (`mobile-overflow.acceptance.test.js`, `thumbhash-consistency.acceptance.test.js`, `header-dock-consistency.acceptance.test.js`) will discover `p99` mid-build or mid-teardown, throwing `ENOENT: no such file or directory, open '.../p99/index.html'` or asserting against temporarily polluted `index.html` navigation links.

**Fix:**

1. **Isolate build tests**: Support a `--no-sync` or test option (e.g. `buildPage(id, { syncGlobal: false })`) so synthetic builder tests never mutate shared repository files (`index.html`, `p1/index.html`, `sitemap.xml`, `js/preloader.js`) on disk. Test navigation sync and preloader synchronization via pure in-memory unit tests.
2. **Harden page discovery helpers**: All repository page discovery functions in acceptance tests (`getProjectPages()`) must explicitly ignore synthetic test pages (`d.name.toLowerCase() !== 'p99'`) and verify `fs.existsSync(path.join(ROOT_DIR, d.name, 'index.html'))` before attempting file reads.

## 2026-07-17 — A failing `expect` mid-callback skips cleanup and leaks corrupted globals to later tests

**Problem:** A test that mutates a shared jsdom global (`window.history`,
`window.URL`, `document.readyState`, ...) at the top of an `it()`/
`jest.isolateModules()` callback, runs several `expect()` assertions, and only
restores the global in plain code _after_ those assertions is not safe. If any
assertion in the middle throws, the callback aborts immediately and the
restoration code never runs. The global stays corrupted (e.g. `window.history`
replaced by a plain `{ replaceState: fn }` object with no `pushState`) for
every subsequent test in the file, which then fail with confusing, unrelated
errors like `window.history.pushState is not a function` — nowhere near the
actual root cause.

This bit `tests/js/page-transition.test.js`: a broken assertion on a throwing
`sessionStorage` getter (see the entry below — throwing getters are bypassed,
so the expected `logWarning` call never happened) threw partway through
`'covers error handling paths'`, which skipped the `window.history =
originalHistory` restore at the end of that callback and cascaded into
failures in two unrelated later tests.

**Fix:** Wrap the assertions in `try { ... } finally { ...restore globals... }`
so restoration always runs, or restore in the `it()`'s outer `afterEach` when
possible. When you see a jsdom-global-shaped error (`X is not a function` on
`window.history`/`window.location`/etc.) in a test that never touches that
global directly, suspect a leak from an earlier test's unrestored mutation
before debugging the failing test itself.

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
- **Code under test calls `window.location.assign(...)` directly** → `assign`
  is an own, non-writable, non-configurable property on the `Location`
  instance in jsdom 26+, so `jest.spyOn(window.location, 'assign')` throws
  `Cannot assign to read only property 'assign'` and aborts the whole suite.
  Letting the real call through logs jsdom's "Not implemented: navigation" via
  `VirtualConsole`, which `jest.spyOn(console, 'error')` does **not**
  reliably suppress. Don't fight jsdom for this one — rewrite the source at
  load time so the call is mockable: read the file with `fs.readFileSync`,
  `.replace(/location\.assign/g, 'window.__SomeAssignStub')`, then `eval` the
  patched string before each test. See `loadInstrumentedScript()` in
  `page-transition.test.js` for the full pattern (also handy for asserting on
  the exact URL passed to `assign`, not just that navigation happened).

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
