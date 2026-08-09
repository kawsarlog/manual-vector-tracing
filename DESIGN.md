# Design System — Manual Vector Tracing

## Visual theme

Clean precision studio: light workspace surfaces, ink-dark type, committed green accent. Feels like a soft-proof desk under even studio light — calm, exact, production-trusted. Not dark-mode SaaS; not cream editorial.

## Color (OKLCH + hex anchors)

| Token | OKLCH | Hex | Role |
|-------|-------|-----|------|
| `--ink` | oklch(0.21 0.03 255) | `#111827` | Primary text, footer, dark bars |
| `--ink-soft` | oklch(0.38 0.02 250) | `#3A4550` | Secondary body |
| `--blue` | oklch(0.55 0.14 150) | `#159447` | Brand accent / CTAs / emphasis |
| `--blue-deep` | oklch(0.47 0.13 150) | `#117A3A` | CTA hover |
| `--blue-soft` | oklch(0.96 0.03 150) | `#E7F6EE` | Soft fills, trust pills |
| `--surface` | oklch(0.99 0.005 250) | `#F7F9FC` | Alternating section bg |
| `--white` | oklch(1 0 0) | `#FFFFFF` | Main canvas |
| `--line` | oklch(0.90 0.01 250) | `#E2E8F0` | Hairline borders |

Accent usage: committed (~15–25% of interactive/emphasis surface), not an all-green drench.

## Typography

- **Headings:** Poppins (600–800) — matches wireframe commitment; strong, industrial-service clarity.
- **Body:** Source Sans 3 (400–600) — readable long-form without defaulting to Inter.
- Modular scale via `clamp()`; heading tracking ≥ `-0.03em`; `text-wrap: balance` on h1–h3.

## Layout

- Max content width ~1120–1200px; horizontal padding `clamp(1.25rem, 4vw, 2.5rem)`.
- Hero: brand logo-level presence + one headline + short support + CTA group + before/after visual (one composition).
- Section rhythm: generous vertical padding; one purpose per section.
- Cards only where interaction or grouping needs a container (FAQ accordion, quote form, testimonial quotes). Prefer open grids for “why choose” and industries.

## Components

- **Primary button:** filled `--blue`, white label, slight radius (~8px), upload metaphor OK.
- **Secondary:** text/link with arrow, or outline ink.
- **Nav:** sticky white bar; logo left; links; Get Free Quote CTA right.
- **Before/After:** interactive slider when assets exist; SVG demo as default proof.
- **FAQ:** native details/summary or button accordion; accessible focus states.

## Motion

1. Hero before/after handle settle on load.
2. Subtle CTA hover lift (transform + shadow, ease-out-quart).
3. Soft section reveals (opacity/translate) respecting `prefers-reduced-motion`.

## Imagery

- Brand logo: `assets/logo.png`
- Before/after: real project shots when available; until then a constructed raster-vs-vector demo. No stock lifestyle photos required for this service brand.
