## 2026-03-11 - Native Lazy Loading on Image Heavy Pages

**Learning:** Found that the portfolio pages (p1/, p2/, p3/) are extremely image-heavy, loading up to ~16MB of images concurrently without native lazy loading on the `<img>` tags. The site relies heavily on a block-navigation component that depends on intersecting viewports, but fetching all these high-res (approx 1MB each) images at once blocks critical bandwidth and parse time.
**Action:** Always add `loading="lazy"` to below-the-fold `<img ...>` tags to massively defer offscreen image network requests, significantly improving Initial Load Time and reducing unnecessary bandwidth usage.
