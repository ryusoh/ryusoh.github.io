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
- **Fallback: Alibaba Cloud OSS bucket, Hangzhou region, public read,**
  accessed via the default endpoint URL
  `https://<bucket>.oss-cn-hangzhou.aliyuncs.com/assets/img/...`.
    - Region choice: any eastern mainland region is equivalent for a
      nationwide audience (same Alibaba backbone/peering, same mainland
      pricing); Hangzhou chosen because the site owner lives there, which
      marginally speeds up admin uploads/syncs.
    - Default endpoint URLs need **no ICP filing** (ICP only applies when
      binding a custom domain to mainland hosting/CDN).
    - Measured TTFB from Shanghai: **69 ms** to `oss-cn-shanghai`
      (vs ~600–900 ms to GitHub Pages). Tencent COS Shanghai measured
      222 ms — acceptable alternative.
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
   (~10 min via Alipay/ID). Enable OSS. ✅ Done 2026-10-09.
2. **Create bucket**: region `oss-cn-hangzhou`, standard storage, local
   redundancy (LRS — the mirror is rebuildable from git, and ZRS is a
   one-way, pricier option), **public read**, versioning off. ✅ Done
   2026-10-09: `https://lyeutsaon.oss-cn-hangzhou.aliyuncs.com`
   (Block Public Access disabled, 公共读 ACL, Referer whitelist
   `*.lyeutsaon.com` + empty referer + query-string truncation, billing
   alerts 50/80/100% of ¥100 + low-balance alert).
3. **Sync script**: ✅ `scripts/sync-mirror.sh` (`make sync-mirror`) —
   uploads only `*.avif`/`*.webp` (derived tiers; see "Cost guardrails"
   #3), idempotent via `aliyun oss cp -r -u --include`. Prerequisites:
   `brew install aliyun-cli` (installed 2026-10-09) and
   `aliyun configure` with a RAM AccessKey scoped to the bucket,
   region `cn-hangzhou`. ✅ Done 2026-10-09: RAM user `oss-mirror-sync`
   (policy `tpl-oss-bucket-put-object` + a bucket-level `ListObjects`
   statement — the CLI's `-u` check needs it); first sync uploaded 782
   tier files, 202 MB in 66 s. Mirror verified 2026-10-09: object URL
   returns 200 with empty or `*.lyeutsaon.com` referer, 403 for foreign
   referers (anti-hotlink works), 404 for missing objects.
4. **Generator + fallback wiring**: ✅ Done 2026-10-09.
    - `scripts/build-page.mjs` emits
      `data-fallbacks='["<oss-origin>/assets/img/<pageId>/<base>-1200.webp"]'`
      on every gallery `<img>` (origin constant `MIRROR_ORIGIN`).
    - `js/loader/imageFallback.js` strips sibling `<source>` elements and
      `srcset`/`sizes` on fallback — required because setting `img.src`
      inside `<picture>` re-runs source selection and would re-pick the
      failed origin.
    - Tests: `tests/js/loader/imageFallback.test.js` (picture stripping)
      and `tests/js/page-builder.test.js` (generated markup carries the
      fallback + CSP origin).
5. **CSP update**: ✅ Done 2026-10-09 — the OSS origin added to `img-src`
   in `index.html` and the portfolio template; pages regenerated via
   `make page ID=pN` for all six (regeneration also covers the template
   CSP).
6. **Verify**: `make precommit-fix` green (814 tests); mirror fetch matrix
   verified (200/403/404 — see item 3). **Remaining:** push the fallback
   commits, then from a mainland connection (VPN off) force a primary
   failure (e.g. block `www.lyeutsaon.com` in /etc/hosts or devtools) and
   confirm gallery images load from the mirror; ideally have the original
   reporter retest at ~22:00.
7. **Deploy cadence**: re-run `make sync-mirror` whenever `make images`
   regenerates tiers or new pages are added (`make page ID=pN`).

Note for verification runs from a mainland connection: `github.com` git
operations (push/fetch) are blocked/unstable on a direct connection while
GitHub Pages keeps serving fine — do git operations with the VPN on, and
site/mirror probing with it off.

## Side findings (cleaned up 2026-10-06)

- Deleted unreferenced `assets/img/mobile_background.{webp,avif,jpg}`
  (~3.4 MB) — all breakpoints in `css/main_style.css` use
  `desktop_background.*`.
- Removed `fonts.googleapis.com` / `fonts.gstatic.com` from the CSP
  style-src/font-src in `index.html` and the portfolio template (nothing
  fetches from them since the Google Fonts links were dropped).
