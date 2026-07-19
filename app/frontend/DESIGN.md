# Design System: OrzManager — People Platform Console

The single source of truth for every screen generated for the OrzManager admin
console. All new layouts, components, and pages must comply with this document.

## 1. Visual Theme & Atmosphere

A calm, daylight administrative console — the feeling of a well-organized front
desk, not a mission-control cockpit. Density is balanced (5/10): generous
whitespace around content zones, tighter rhythm inside tables and lists.
Variance is restrained-asymmetric (5/10): the shell is a classic
topbar-plus-sidebar frame, but content areas use uneven column splits
(2:1, never three equal cards). Motion is fluid but quiet (4/10): short
opacity/transform reveals, tactile button presses, nothing cinematic.
Hierarchy is communicated through weight and color, never through screaming
type sizes.

## 2. Color Palette & Roles

- **Paper White** (`#FFFFFF`) — primary background of the shell, topbar, and
  panels. The console lives on white; depth comes from borders, not shadows.
- **Mist** (`#F8FAFC`, Slate-50) — resting fill for inactive-hover navigation
  pills, empty-state icon wells, and subtle row hover.
- **Ink** (`#0F172A`, Slate-900) — primary text and the wordmark. Never pure
  black (`#000000`).
- **Steel** (`#64748B`, Slate-500) — secondary text: descriptions, hints,
  metadata, dates.
- **Hairline** (`#E2E8F0`, Slate-200) — 1px structural borders: topbar bottom
  edge, sidebar right edge, panel outlines, row dividers.
- **Signal Blue** (`#2563EB`, Blue-600) — the single accent. Active navigation
  text, primary buttons, focus rings, notification dot. Active nav pill fill is
  Signal Blue at 10% opacity over white (`#EFF6FF` effect). No other accent
  color exists anywhere in the product.

Semantic classes (Nuxt UI): `bg-default`, `bg-elevated`, `text-highlighted`,
`text-muted`, `text-dimmed`, `border-default`, `text-primary`, `bg-primary/10`.
`primary` is `blue`, `neutral` is `slate` (see `app.config.ts`).

## 3. Typography Rules

- **UI Sans:** the native system stack (`ui-sans-serif, system-ui, -apple-system,
  'Segoe UI', Roboto`) — a deliberate project constraint (no build-time font
  fetching, see `nuxt.config.ts`). Track-tight headings (`tracking-tight`),
  weight-driven hierarchy: page titles are `text-2xl font-bold`, panel titles
  `text-base font-semibold` — never larger.
- **Numbers:** always monospace with `tabular-nums` (`ui-monospace, 'SF Mono',
  Menlo`). Counts, dates in tables, and IDs align vertically.
- **Body:** `text-sm` with relaxed leading (`leading-6`), max ~65ch line length.
- **Banned:** webfont Inter, any serif face (this is a dashboard — sans only),
  gradient text, all-caps headlines above `text-xs` label size.

## 4. Component Stylings

- **Shell topbar:** 64px tall, Paper White with a Hairline bottom border,
  sticky with backdrop blur. Left: `OrzManager` wordmark in Ink, bold,
  track-tight. Right: ghost bell button carrying a Signal Blue notification
  dot, then the account avatar (opens a dropdown). No search bar until search
  exists.
- **Sidebar navigation:** 240px column with a Hairline right border. Text-only
  pills (no icons, matching the prototype), `rounded-xl`, 10px vertical
  padding. Active: `bg-primary/10 text-primary`. Hover: Mist fill. Collapses
  into a left slide-over below `lg`.
- **Buttons:** flat fills, no outer glow, no gradients. Primary = Signal Blue
  fill; secondary = neutral outline; tertiary = ghost. Active state presses
  down 1px (`translate-y`), transform-only.
- **Panels (cards):** `rounded-2xl`, 1px Hairline border, Paper White fill,
  **no drop shadow** — elevation is not needed on a flat console. Header row
  with title + optional action, Hairline divider, padded body. Stat groups are
  ONE panel with internal Hairline dividers, never three floating cards.
- **Inputs:** label above, helper below, error text below in the form's error
  color. Focus ring in Signal Blue. No floating labels.
- **Loading:** skeleton blocks matching the exact final layout. No spinners.
- **Empty states:** composed — a Mist icon well, one-line title in Ink, one
  sentence in Steel explaining how the area gets populated, optional single
  action. Never bare "No data" text.
- **Data honesty:** stat tiles render an em dash (`—`) with a hint line until a
  real value arrives from the API. Fabricated numbers are forbidden.

## 5. Layout Principles

- Shell grid: full-width topbar; below it a `max-w-[1400px]` centered row of
  sidebar + main. Main content padding `px-4 sm:px-6 lg:px-10 py-8`.
- Content sections use CSS Grid with asymmetric tracks
  (`lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`) — the 3-equal-cards row is
  banned.
- Nothing overlaps: every element owns its spatial zone; no absolute-position
  stacking.
- Full-height uses `min-h-dvh`, never `h-screen`.
- Below `768px` everything collapses to a single column; horizontal overflow
  on mobile is a critical failure. Touch targets ≥ 44px.

## 6. Motion & Interaction

- Section entrances: `fade-rise` (8px translate + opacity, ~500ms,
  `cubic-bezier(0.22, 1, 0.36, 1)`), staggered 60ms per section — defined as a
  Tailwind utility in `assets/css/main.css`.
- Hover affordances are transform/opacity/color only: quick-action arrows nudge
  right 2px, nav pills recolor in 150ms.
- Never animate `top/left/width/height`. No perpetual attention-seeking loops
  on an admin console — motion answers interaction, it does not perform.

## 7. Anti-Patterns (Banned)

- Emojis anywhere in the UI.
- Pure black `#000000`; neon or outer-glow shadows; purple/neon gradients.
- A second accent color; oversaturated fills.
- Three equal cards in a row; centered marketing-style heroes (this is a console).
- Fabricated metrics, fake round numbers, invented "system stats" panels.
- Generic placeholder names ("John Doe", "Acme") — use role-based or real data.
- AI copy clichés ("Seamless", "Elevate", "Unleash"), filler UI text
  ("Scroll to explore"), scroll chevrons.
- Circular spinners; floating labels; custom cursors; broken Unsplash links.
