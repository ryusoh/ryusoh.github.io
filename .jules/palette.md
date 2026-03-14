## 2024-05-18 - [Accessibility: Resolving Contrast Failures due to Opacity]

**Learning:** Hard-coding opacity in inline styles (`opacity: 0.5`) on links to dim them can severely reduce contrast against background colors (e.g., from 5.9:1 dropping to 2.46:1, failing WCAG AA) and will block CSS `:hover` states unless removed or styled with `!important`. A better pattern is to set the default dim opacity via a stylesheet and transition it to `opacity: 1` on `:hover` and `:focus`. This maintains the intended aesthetic dimness but restores full contrast upon interaction without violating inline specificity.
**Action:** When inspecting visually dim interactive elements, check for inline `opacity` rules. Migrate these to external stylesheets to ensure hover/focus states can override them smoothly, improving both accessibility and the sensation of interactivity.

## 2025-02-28 - [Accessibility: Screen Reader Clarity vs Minimalist Aesthetics]

**Learning:** When using icon-only buttons, providing an `aria-label` on the anchor tag is crucial for screen reader users. However, if the icon itself is implemented via a font (like FontAwesome `<i class="fa..."></i>`), screen readers may attempt to read the icon element redundantly or confusingly. While adding native visual `title` attributes can provide parity for sighted users, it often conflicts with strict minimalist design requirements.
**Action:** Always add `aria-hidden="true"` to purely visual decorative child elements (like FontAwesome `<i>` tags) inside labeled interactive elements. This ensures screen readers only announce the intended `aria-label` on the parent, improving the non-visual UX without compromising minimalist aesthetic constraints that prohibit visible hover tooltips.
