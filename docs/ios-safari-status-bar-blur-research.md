# iOS Safari status-bar / address-bar blur gap research

## Question

On iOS Safari, when a page is scrolled into the minimal/full-screen state, page content becomes visible behind the system status bar. Opening the mobile header menu shows the menu's gaussian blur below the status bar, but the status-bar area itself stays un-blurred, causing a visual break. Do other sites see this, and what is the accepted workaround?

## Short answer

Yes — this is a known iOS Safari / WebKit issue, especially visible since iOS 26's "Liquid Glass" transparent toolbars. Web content **cannot directly paint or blur into the system status-bar / address-bar area**. The accepted workarounds are:

1. Add a small, fixed `position: fixed` strip at the very top of the page with a solid `background-color` so Safari samples it and tints the status bar to match.
2. Because Safari 26+ ignores `<meta name="theme-color">` as a color source but still watches it for changes, a runtime `"+fe"` meta-tag nudge can force Safari to re-sample tinting sources after the menu opens.
3. Backdrop-filter on web elements does **not** extend into the system chrome; it only blurs page pixels that the element itself covers.

## Evidence

### 1. WebKit treats the address-bar / status-bar area as outside the web viewport

WebKit Bug 300965 documents that on iOS 26 a native `<dialog>` `::backdrop` does not extend below the address bar, and a `backdrop-filter` overlay does not affect the see-through toolbar area either:

> "Emulated dialog with backdrop-filter does not affect those areas at all."
> "The address bar on iOS 26 Safari is a design decision that I am not arguing against. But it IS broken in implementation. It needs to be env(safe-area)."

Source: [WebKit Bug 300965](https://bugs.webkit.org/show_bug.cgi?id=300965)

### 2. Safari 26 derives toolbar tints from fixed/sticky element `background-color`

Safari 15–18 used `<meta name="theme-color">`. Safari 26+ ignores that value and samples the page instead:

> "Safari 26 scans for `position: fixed` or `position: sticky` elements near the viewport edges and reads two properties: `background-color` on the element itself [and] `backdrop-filter` on the element itself. It uses these to compute the tint color for the nearest toolbar."

Source: [Jahir Fiquitiva — How to correctly tint Safari's toolbar in iOS 26](https://jahir.dev/blog/safari-toolbar)

Empirical thresholds for an element to be sampled:

| Criterion         | iOS value                                                |
| ----------------- | -------------------------------------------------------- |
| Distance from top | ≤ 4 px                                                   |
| Width             | ≥ 80 % of viewport                                       |
| Height            | > 4 px (11 px+ recommended for reliable scroll behavior) |

Source: [Mage POS — Safari 26 Status Bar Tinting — How It Actually Works](https://www.ianfebisastrataruna.my.id/en/article/safari-26-status-bar-tinting-how-it-actually-works)

### 3. A fixed top strip is the practical fix

A fixed strip with a solid background forces Safari to tint the status bar:

> "In your CSS stylesheet, add a `body::before` pseudo element that styles the area behind the status bar. For the height, use the `env(safe-area-inset-top)` environment variable, which covers that exact area on iOS at the top behind the status bar."

Source: [Daniel Pietzsch — How to create a blurry status bar for PWAs on iOS](https://danielpietzsch.com/articles/how-to-create-a-blurry-status-bar-for-pwas-on-ios)

A real-element variant is preferred here because pseudo-elements on fixed/sticky parents are reported as not sampled by Safari's tinting observer:

> "What Does NOT Get Sampled: Pseudo-elements (`::before`, `::after`) on fixed/sticky elements."

Source: [Mage POS — Safari 26 Status Bar Tinting](https://www.ianfebisastrataruna.my.id/en/article/safari-26-status-bar-tinting-how-it-actually-works)

### 4. The previous "negative-top blur div" workaround no longer works

A fixed `div` positioned above the viewport (e.g. `top: -80px`) used to blur the status-bar area, but the author notes:

> "Update August 2026: This workaround no longer works on recent iOS versions. WebKit changed how standalone PWAs handle the status bar area. The fixed overlay positioned outside the viewport no longer renders under the status bar."

Source: [Muffin Man — Apply blur to iOS status bar in PWA](https://muffinman.io/blog/pwa-ios-status-bar-blur/)

### 5. Runtime re-sampling needs a `<meta name="theme-color">` nudge

Safari 26 has a live observer for `background-color` changes on qualifying elements, but it misses several transitions. Changing the `theme-color` meta value still wakes the observer:

> "Even though Safari 26 ignores `<meta name="theme-color">` for the source of the tint, changing the meta tag's `content` attribute still pokes Safari's internal observer and forces a full re-sample of all DOM tinting sources."
> "The proven 3-step pattern: set meta content → append `"fe"` suffix → restore clean value."

Source: [Mage POS — Safari 26 Status Bar Tinting](https://www.ianfebisastrataruna.my.id/en/article/safari-26-status-bar-tinting-how-it-actually-works)

## Implications for this site

- The mobile menu (`#cont.is-expanded`) uses `backdrop-filter: blur(25px)` and a semi-transparent black background. That blur only affects page pixels that the menu box actually covers; it cannot reach the system status bar.
- Adding a fixed top strip with `background-color: rgba(0, 0, 0, 0.5)` (or a solid dark color) when the menu opens gives Safari a sampled color source and should tint the status bar dark.
- Adding the same `backdrop-filter` to that strip will blur the top edge of the page content, which is the part of the page that shows through the transparent toolbar.
- A `theme-color` nudge in JavaScript should be triggered when the menu opens, so Safari re-samples the newly visible strip instead of keeping the previous tint.

## Open questions / what could not be verified

- The exact iOS version on the test device is unknown. The behavior described matches iOS 26 Liquid Glass, but older iOS versions with `black-translucent` had a similar (less severe) effect.
- Whether Safari reliably re-samples a newly `display: block`-ed fixed strip without the meta-tag nudge can only be confirmed on a real device.
- Whether a fixed full-viewport overlay (modal-style) would trigger Safari's own "full-screen overlay" heuristic and force the chrome to a solid color has not been tested on this site.
