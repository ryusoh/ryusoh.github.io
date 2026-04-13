## 2024-05-18 - [Accessibility: Resolving Contrast Failures due to Opacity]

**Learning:** Hard-coding opacity in inline styles (`opacity: 0.5`) on links to dim them can severely reduce contrast against background colors (e.g., from 5.9:1 dropping to 2.46:1, failing WCAG AA) and will block CSS `:hover` states unless removed or styled with `!important`. A better pattern is to set the default dim opacity via a stylesheet and transition it to `opacity: 1` on `:hover` and `:focus`. This maintains the intended aesthetic dimness but restores full contrast upon interaction without violating inline specificity.
**Action:** When inspecting visually dim interactive elements, check for inline `opacity` rules. Migrate these to external stylesheets to ensure hover/focus states can override them smoothly, improving both accessibility and the sensation of interactivity.

## 2025-02-28 - [Accessibility: Screen Reader Clarity vs Minimalist Aesthetics]

**Learning:** When using icon-only buttons, providing an `aria-label` on the anchor tag is crucial for screen reader users. However, if the icon itself is implemented via a font (like FontAwesome `<i class="fa..."></i>`), screen readers may attempt to read the icon element redundantly or confusingly. While adding native visual `title` attributes can provide parity for sighted users, it often conflicts with strict minimalist design requirements.
**Action:** Always add `aria-hidden="true"` to purely visual decorative child elements (like FontAwesome `<i>` tags) inside labeled interactive elements. This ensures screen readers only announce the intended `aria-label` on the parent, improving the non-visual UX without compromising minimalist aesthetic constraints that prohibit visible hover tooltips.

## 2024-05-20 - [Accessibility: Screen Reader Clarity vs Layout Tables]

**Learning:** Using an HTML `<table>` element purely for layout purposes (such as aligning navigation links alongside a category label) will cause screen readers to announce it as a data table with rows and columns, creating a confusing and verbose experience for non-visual users.
**Action:** Always add `role="presentation"` (or `role="none"`) to layout tables. This strips away the table semantics so that assistive technologies treat the contents as normal layout elements, significantly improving the non-visual user experience without altering the visual structure or relying on new CSS layouts.

## 2026-03-16 - Escape Route

**Learning:** Users often expect standard "Escape" keys to exit immersive, gallery-style views, similar to closing a modal or lightbox. Providing explicit keyboard navigation out of these isolated views reduces friction significantly for keyboard users.
**Action:** When creating standalone visual projects or deeply nested immersive layouts, ensure `Escape` is bound to navigating "Back" to the main context and exposed via `aria-keyshortcuts`.

## 2026-11-20 - [Accessibility: HTML5 Semantic Landmarks]

**Learning:** Replacing non-semantic wrapper `<div>` and `<section>` elements with HTML5 `<main>` tags, and wrapping layout-based navigation structures with `<nav aria-label="...">` tags drastically improves the ability of screen reader users to navigate web pages using standard keyboard shortcuts (e.g., landmark navigation).
**Action:** When inspecting a document's HTML structure, ensure that primary content and primary navigation regions are wrapped in semantic landmarks like `<main>` and `<nav>`. Additionally, remember to add these new elements to CSS resets (e.g., `main, nav { display: block; }`) to maintain visual layout consistency.

## 2026-11-20 - [Accessibility: Skip-to-content Targets]

**Learning:** "Skip to content" links (with visually hidden `.sr-only` classes) are great for keyboard users, but if the target element (like `<main id="main">`) is not inherently focusable, some browsers will scroll the viewport but fail to move the actual focus. When the user presses Tab again, focus jumps back to the top of the page.
**Action:** Always add `tabindex="-1"` to the target element of a skip link. This makes the element programmatically focusable without adding it to the normal tab order, ensuring focus is reliably transferred so the next Tab keypress moves into the main content.

## 2026-11-22 - [Hide Focus Ring on Skip Link Targets]

**Learning:** When using `tabindex="-1"` to make non-interactive layout elements programmatically focusable (like `<main>` for 'Skip to content' targets), browsers often apply a default focus ring. This ring is visually confusing as the element is not interactive.
**Action:** Pair the `tabindex="-1"` attribute on layout targets with a global CSS rule like `[tabindex="-1"]:focus { outline: none !important; }` to prevent default focus rings, ensuring a clean visual experience while maintaining accessibility.

## 2026-11-23 - [UX/Accessibility: target="_blank" and mailto: links]

**Learning:** Opening a new tab merely to trigger an email client is an unnecessary friction point and a known anti-pattern. Applying `target="_blank"` to `mailto:` links spawns a confusing blank tab that users must manually close. Furthermore, external links lacking an explicit indication that they open in a new tab can disorient screen reader users due to sudden context switching.
**Action:** Always avoid applying `target="_blank"` to `mailto:` links. For any external links that correctly open in a new tab using `target="_blank"`, strictly append `(opens in a new tab)` to their `aria-label` to ensure predictability for screen reader users.

## 2025-02-28 - [Accessibility: Skip-to-content Visibility]

**Learning:** When styling 'Skip to content' links (often with `.sr-only-focusable`), transitioning from `position: absolute` (with `.sr-only` constraints) to `position: static` on `:focus` causes the newly visible element to push down the entire layout. This creates a jarring visual jump for keyboard users and can temporarily break page layouts until focus moves again.
**Action:** When styling the `:active` and `:focus` states for skip-to-content links, retain `position: absolute` but apply a high `z-index`, contrasting background/text colors, and padding. This ensures the link appears as a highly visible, floating overlay button that does not disrupt the surrounding document flow. Additionally, ensure target elements with `tabindex="-1"` receive an `outline: none !important;` rule to prevent the browser's default focus ring from enveloping the entire content area upon successful skip.

## 2026-04-13 - [Design Inspiration: Brand Colors and Accent Unification]

**Learning:** When adopting a specific brand identity or design inspiration (e.g., Lando Norris's signature neon lime green `#D2FF00`), applying it cohesively across all interactive elements (hover states, social icons, custom cursor borders, and accessibility focus rings) creates a polished and unified user experience. Using high-contrast accent colors against dark themes significantly improves visibility and engagement without overwhelming the layout.
**Action:** When updating a site's primary accent color, ensure the change is propagated comprehensively. Update `css/main_style.css` (for hovers, links, and `:focus-visible`) and `css/cursor.css` (for custom interactive elements) to maintain a cohesive visual language.
