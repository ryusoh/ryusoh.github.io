## 2024-05-18 - [Accessibility: Resolving Contrast Failures due to Opacity]

**Learning:** Hard-coding opacity in inline styles (`opacity: 0.5`) on links to dim them can severely reduce contrast against background colors (e.g., from 5.9:1 dropping to 2.46:1, failing WCAG AA) and will block CSS `:hover` states unless removed or styled with `!important`. A better pattern is to set the default dim opacity via a stylesheet and transition it to `opacity: 1` on `:hover` and `:focus`. This maintains the intended aesthetic dimness but restores full contrast upon interaction without violating inline specificity.
**Action:** When inspecting visually dim interactive elements, check for inline `opacity` rules. Migrate these to external stylesheets to ensure hover/focus states can override them smoothly, improving both accessibility and the sensation of interactivity.

## 2025-02-28 - [Accessibility: Parity for Sighted Users on Icon-Only Buttons]

**Learning:** When using identical or ambiguous icon-only buttons adjacent to each other (e.g., two Instagram links leading to different profiles), providing an `aria-label` solves the issue for screen reader users, but sighted mouse users have no way to distinguish between them before clicking.
**Action:** Always add native `title` attributes to icon-only buttons alongside `aria-label`s to ensure visual tooltips are available, providing parity in understanding the button's specific destination or action.
