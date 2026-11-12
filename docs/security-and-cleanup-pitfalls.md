# Security, error-handling, and dead-code pitfalls

Repo-specific lessons carried over from the retired Sentinel, Janitor, Bolt, and
Palette personas (see the retirement note in `docs/gates.md`). The personas
themselves remain in Git history at `c6fc301`.

## Client-side attack surface & security pitfalls

This is a static GitHub Pages site plus a service worker (`sw.js`). There is no
server, no database, no auth or session layer, and no user accounts. Concentrate
on client-side defects:

- **URL scheme checks:** `trim()` only strips whitespace; browsers ignore leading
  control characters (`\x00`–`\x1F`) when resolving a scheme. Normalize with
  `url.replace(/^[\s\u0000-\u001F]+/g, '')` before checking `javascript:`.
- **Unbounded-parse DoS:** bound length before any native parser —
  `URLSearchParams`, `new URL()` (client and `sw.js`), and `JSON.parse` of
  storage values. Cap URL length (`location.href` / `req.url` > 2000) and storage
  payloads (> 200). When fixing one instance, audit all callers of `new URL`,
  `URLSearchParams`, and `JSON.parse`.
- **Empty catches:** replace `catch {}` or `.catch(() => {})` with a defensive
  contextual log (`AppLogger` or `window.console.warn` guarded by
  `typeof window !== 'undefined' && window.console`) preserving graceful
  fallback. Always include context (e.g. `'...during image fallback init:'`) —
  a bare generic log is insufficient.
- **Fetch timeouts:** wrap external fetches (e.g. `cdnFallback.js`) with
  `AbortController` and a timeout (`~5000ms`).
- **CSP `<meta>` tags:** policy lives in HTML `<meta>` tags. Keep `script-src`
  free of `'unsafe-inline'` / `'unsafe-eval'`. Note that `X-Frame-Options` and
  `X-Content-Type-Options` are ignored by browsers in `<meta>` form — do not add
  them there.

## Dead-code removal & reference searching

- **Mandatory reference search:** search with `git grep -n <target>` across
  **all** tracked files before deleting — including `.md`, `.mjs`, `.js`,
  `.css`, `.html`, `.yml`, `Makefile`, `.agents/`, `.github/`. A symbol,
  function, or script referenced by markdown documentation, skill workflows,
  shell scripts, HTML templates, or CI configs is not dead code.
- Entry points, CLI utilities, test fixtures, and functions exposed through a
  `window.__*ForTesting` hook are not dead code just because tests or doc
  workflows are the only in-repo caller.
- When deleting production code, delete its tests in the **same commit**: the
  bot-PR hygiene gate allows test shrinkage only alongside production code
  deletions.
- Third-party code (`js/vendor/**` and `*.min.js`) is ignored — its TODOs and
  patterns are not ours. Never touch build artifacts or generated files.

## Performance & layout patterns

- **Hoist DOM layout reads out of rAF / high-frequency handlers:** cache
  `innerWidth`, `innerHeight`, and `getBoundingClientRect` on `resize` or
  `mouseenter` and read cached values in animation loops — never read layout
  inside a per-frame loop.
- **Anti-pattern — inlining `.forEach` into `for` loops in monolithic functions:**
  In JavaScript, arrow functions passed to `.forEach(...)` have their own
  cyclomatic complexity scope. Inlining them into indexed `for` loops within a
  parent function aggregates all loop and branch conditions into that single
  function, frequently tripping the complexity ratchet (> 20). Decompose into
  clean single-purpose helpers instead.
- **Canvas particle loops:** use static `fillStyle` and `globalAlpha` rather
  than per-particle `rgba(...)` string concatenation in rAF loops.
- **Continuous event listeners:** use `{ passive: true }` where `preventDefault`
  is not called.

## Accessibility & UX conventions

- **Contrast:** do not dim interactive elements with inline `opacity` — it drops
  contrast below WCAG AA (e.g. 5.9:1 → 2.46:1) and blocks `:hover`. Set dim
  states in stylesheets and restore `opacity: 1` on `:hover` and `:focus`.
- **Icon-only controls:** provide an `aria-label` on the anchor or button, and
  mark decorative icons with `aria-hidden="true"`.
- **Layout tables:** add `role="presentation"` so assistive technology does not
  announce tabular structure.
- **Semantic landmarks:** prefer `<main>` and `<nav aria-label="...">` over
  generic `<div>` or `<section>` tags; include matching `display: block` in the
  reset stylesheet.
- **Skip links:** target needs `tabindex="-1"` to receive focus; pair with
  `[tabindex="-1"]:focus { outline: none !important; }` and keep the link
  positioned absolutely with a high `z-index`.
- **External / mailto links:** never use `target="_blank"` on `mailto:`; for
  external links that open new tabs, append `(opens in a new tab)` to the
  `aria-label`.
