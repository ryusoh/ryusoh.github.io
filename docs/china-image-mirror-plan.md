# Mainland China image mirror — findings and action plan

Status: **documented, not yet implemented** (pending bucket registration).
Date of investigation: 2026-10-06.

## Problem

A mainland China visitor (mobile, no VPN, ~22:00–23:00 CST evening peak)
reported gallery pages `p1/`–`p6/` loading with text but **no images** —
broken-image icons showing the alt captions. The homepage rendered fine,
including its background photo.

## Root cause (confirmed by measurement)

All site assets — including ~406 MB of photos — are served same-origin from
GitHub Pages (Fastly IPs) via `www.lyeutsaon.com`. GitHub Pages is not
hard-blocked in China but is throttled/unstable, worst at evening peak.
Measured from a Shanghai connection (VPN off, Oriental Cable Network):

| Measurement                   | Result                                 |
| ----------------------------- | -------------------------------------- |
| `www.lyeutsaon.com` HTML      | 200 OK, ~1 s                           |
| Single 45 KB gallery AVIF     | 200 OK but ~0.6–0.9 s TTFB per request |
| 10 gallery images, 6 parallel | aggregate ~0.8 MB/s                    |
| 6.2 MB AVIF, single stream    | ~1.5 MB/s sustained                    |
| google.com                    | timeout (blocked, expected)            |

Why the homepage photo survived but gallery images failed (same evening,
first visit — no service-worker cache involved):

1. Homepage background is one 385 KB request preloaded at navigation start
   (`index.html` head), alone, during the fresh-connection grace window.
2. A gallery page needs ~20 foreground images + (pre-fix) ~150 background
   preloads from `js/preloader.js` — 170 probabilistic requests on a marginal
   link; failures have no retry, so each becomes a permanent broken icon.
3. GFW connection resets kill all in-flight HTTP/2 streams at once → many
   broken icons appearing simultaneously.

## Fixes already shipped (2026-10-06)

- `perf(gallery): remove unused render-blocking Google Fonts links` —
  the Open Sans / Noto Serif `<link>`s were referenced by no CSS; they
  render-blocked for users who cannot reach `fonts.googleapis.com`.
- `perf(preloader): skip cross-page preloading on slow connections` —
  `js/preloader.js` now skips the ~150 cross-page image preloads when
  `navigator.connection.saveData` or `effectiveType` ∈ slow-2g/2g/3g.

These reduce self-inflicted load but **cannot fix the throttled origin** —
that requires the mirror below.

## Chosen architecture: object-storage mirror as image fallback

- **Primary stays GitHub Pages** — overseas visitors see zero change
  (EdgeOne full-site CDN was rejected: independent reviews rate its
  EU/Americas performance "average", and its free plan is raffle-gated).
- **Fallback: Alibaba Cloud OSS bucket, Shanghai region, public read,**
  accessed via the default endpoint URL
  `https://<bucket>.oss-cn-shanghai.aliyuncs.com/assets/img/...`.
    - Default endpoint URLs need **no ICP filing** (ICP only applies when
      binding a custom domain to mainland hosting/CDN).
    - Measured TTFB from Shanghai: **69 ms** (vs ~600–900 ms to GitHub Pages).
      Tencent COS Shanghai measured 222 ms — acceptable alternative.
    - Gallery `<img>` tags gain `data-fallbacks` entries pointing at the
      mirror; `js/loader/imageFallback.js` retries there only when the
      primary fails. Only failing (typically mainland, peak-hour) requests
      ever touch the mirror.

## Cost (2026 pricing, pay-as-you-go)

- Storage ¥0.09/GB/month → 406 MB ≈ **¥0.04/month**.
- Outbound traffic ¥0.50/GB (08:00–24:00), ¥0.25/GB (00:00–08:00);
  inbound free. Mirror only serves _failed_ requests (~15 MB per fully
  failed gallery view): 100 such views/month ≈ **¥0.8**, 1,000 ≈ ¥7.5.
- Realistic total: **¥1–5/month**. No monthly minimum.
- Viral-traffic math: non-China virality costs ~¥0 on OSS (fallback never
  fires — GitHub Pages absorbs it). Worst case — 1M mainland views with
  100% fallback — ≈ ¥7,500 for that month. Guardrails below cap this risk.

## Cost guardrails (configure at bucket creation time)

1. **Referer anti-hotlink whitelist (防盗链)** on the bucket: allow only
   `*.lyeutsaon.com` (+ empty referer for direct loads). Prevents third
   parties from embedding the OSS URLs and billing their traffic to us.
2. **Billing alerts** in the Alibaba Cloud expense center: threshold alarms
   at e.g. ¥20/¥50/¥100 so a spike emails you the same day, not on the bill.
3. **Mirror the derived tiers only** (`-768`/`-1200`/`-2048` AVIF+WebP, not
   the multi-MB originals) — caps a full-fallback gallery view at ~5–10 MB
   instead of ~25 MB and roughly halves worst-case traffic. This revises
   action item 3: tiers-only is the safer default.
4. **Hard cap via account balance**: OSS has no native monthly spending
   cap (resource packs overflow into pay-as-you-go; budgets are
   alerts-only). The practical hard cap: top up the account with exactly
   the budget (e.g. ¥100), disable auto-recharge — OSS auto-suspends on
   exhausted balance (欠费停服), resuming on recharge within 15 days.
   Caveats: hourly settlement lag means a small overshoot is possible, and
   the 延停权益 grace means suspension is not instant. When suspended, the
   site degrades to GitHub-Pages-only behavior (today's status quo) — the
   primary is unaffected. Optional true automation: billing-alert webhook →
   Function Compute → set bucket ACL private; build only if China traffic
   becomes significant.

## Action items (in order)

1. **Register** Alibaba Cloud (China) account + real-name verification
   (~10 min via Alipay/ID). Enable OSS.
2. **Create bucket**: region `oss-cn-shanghai`, standard storage, local
   redundancy, **public read**, versioning off. Note the endpoint URL.
3. **Sync script** (`scripts/`): upload the **derived tiers** of
   `assets/img/` (see "Cost guardrails" #3) to the bucket, preserving
   paths. Use `ossutil` or the OSS SDK; make it idempotent (skip unchanged
   by size/etag) so it can run in CI or via `make images`.
4. **Generator + fallback wiring**:
    - `scripts/build-page.mjs` / `scripts/templates/portfolio-shell.html`:
      emit `data-fallbacks='["<oss-url>"]'` on gallery `<img>` tags
      (mirror URL derived from the primary src by origin swap).
    - Verify `js/loader/imageFallback.js` handles `<picture>`/srcset
      correctly (it swaps `img.src`; confirm srcset sources don't keep
      winning after the swap — may need to clear `srcset` on fallback).
    - Tests: extend `tests/js/` coverage for the new fallback path
      (fail-before/pass-after per repo rules).
5. **CSP update** (easy to forget): `img-src` in the CSP meta of
   `index.html` and all `p*/index.html` (via the template) currently allows
   only `'self' data:` — add the OSS origin or fallback images will be
   blocked by CSP. Then `make sync-pages`.
6. **Verify**: `make precommit-fix` green; then from a mainland connection
   (VPN off) measure a gallery page end-to-end; ideally have the original
   reporter retest at ~22:00.
7. **Deploy cadence**: re-run the sync script whenever `make images`
   regenerates tiers or new pages are added (`make page ID=pN`).

## Side findings (cleaned up 2026-10-06)

- Deleted unreferenced `assets/img/mobile_background.{webp,avif,jpg}`
  (~3.4 MB) — all breakpoints in `css/main_style.css` use
  `desktop_background.*`.
- Removed `fonts.googleapis.com` / `fonts.gstatic.com` from the CSP
  style-src/font-src in `index.html` and the portfolio template (nothing
  fetches from them since the Google Fonts links were dropped).
