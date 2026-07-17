# JS typing strategy

Why this repo type-checks JS via `jsconfig.json` + `checkJs` instead of
migrating to TypeScript, and how the whitelist grows.

## TL;DR

- **No `.js` → `.ts` migration.** This repo loads plain `<script>` tags with
  **no bundler and no build step** (see `AGENTS.md`); introducing `.ts` would
  force one. Not worth it for a single-maintainer static site.
- **The cheap alternative:** `jsconfig.json` with `"strict": true` and
  `checkJs`, applied to a small, incrementally-growing `include` whitelist.
  JSDoc annotations only — no `.ts`, no runtime change.
- Wired into `make type` (part of `make check`), the `tsc` pre-commit hook, and
  CI (`.github/workflows/ci.yml`) — all **blocking**. Since the whitelist
  starts small, this never fails on an unannotated file outside it; it only
  fails if a whitelisted file regresses.

## Status (2026-07-17) — infra bootstrapped

- Whitelist seeded with `js/config.js` (trivial, 0 strict errors).
- `window.PortfolioConfig` needed an ambient `Window` augmentation —
  `js/types/globals.d.ts` (type-only, never shipped) declares it. Add further
  first-party globals there as the whitelist grows into files that assign to
  `window.*`.
- Everything outside the whitelist is unchecked. Expand it incrementally: add
  a file's path to `include` and bring it to zero strict errors in the same
  change, one file at a time.

## Rules (matches `js/types/globals.d.ts` and the fund repo's precedent)

- **Never** use `any`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, or an
  `eslint-disable` to silence a strict error — type it correctly or leave the
  file out of the whitelist.
- **Never add `@types/node`** — this is browser-only code; Node ambient types
  aren't needed and can drag in unrelated globals.
- `js/vendor/**` is permanently excluded (third-party, not ours to type).
- Shared/global type declarations go in `js/types/*.d.ts` (type-only, `.d.ts`
  files are never served to the browser).

## Expanding the whitelist

1. Run `npx tsc -p jsconfig.json` — if it's clean, pick the first-party file
   with the fewest strict errors (check the full-repo scan by temporarily
   setting `include` to `["js/types/*.d.ts", "js/**/*.js"]` with
   `js/vendor` excluded, tally errors per file, then revert).
2. Add that file's path to `include` in `jsconfig.json`.
3. Fix every strict error with JSDoc (`@param`, `@returns`, `@typedef`) —
   never suppress.
4. Confirm `npx tsc -p jsconfig.json` exits 0 and `make check` is green.
