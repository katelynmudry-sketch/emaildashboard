# Header Restructure — Design Spec

## Context

`components/Dashboard.tsx` header (currently ~lines 1104–1500) has two rows:

- **Row A**: logo/wordmark/subtitle (left) · mode pills (center) · utility links Sent/Log/Settings/Sign out (right)
- **Row B**: left cluster = PlantHeader, TallyTicket, MiniStats, AccountToggle; right cluster = batch picker + Refresh, Compose, Roast, conditional "Connect work Gmail", roast text output, TODO widget

Reference mockup: `docs/plans/header-mockup.html`. Two issues to address:

1. **Bug**: Party mode pill's active state has `color: m.accentHex` and `background: m.activeBg`, both `#FF1F6E` — active "Party" text is invisible (pink on pink).
2. **Restructure**: rearrange header into the layout shown in the mockup.

This is a **layout-only** change. No new visual styles are introduced except the one-line pill text-color fix. Every relocated element keeps its existing mode-conditional styling (colors, copy, borders, shadows) for zen/party/wabi-sabi exactly as-is.

## New Layout

### Row A — two columns

- **Left column**: existing logo + wordmark (`EMAIL PARTY`) + subtitle stack, unchanged. `AccountToggle` (existing component, existing styles/behavior) is placed directly below this stack.
- **Right column** (right-aligned, stacked vertically):
  - Top: utility links row — Sent · Log · divider · Settings · Sign out (existing buttons, unchanged styling, just relocated)
  - Bottom: mode pills (Party / Basic AF / Zen), unchanged except the bug fix below

### Bug fix — Party pill active text color

In the mode pill `.map()` (around Dashboard.tsx:1192–1224), when `isActive && m.id === "party"`, set `color: "#FFFFFF"` instead of `m.accentHex`. Zen and Basic AF active states already resolve to readable combos (white bg + accent text, or transparent + dark text) and are untouched.

### Row B — stats row

- **Left cluster**: PlantHeader, TallyTicket, MiniStats (urgent/today/fyi) — unchanged. `AccountToggle` removed from here (moved to Row A left column).
- **Right cluster**: batch picker ("per refresh" + 30/50/100) + Refresh button, as a unit — unchanged styling. The conditional "Connect work Gmail" button stays here too (adjacent to batch/refresh), since it's a rare/conditional utility action and this is its current logical home.

### New row — Compose/Roast + TODO

- **Left**: Compose button + Roast button, stacked horizontally — unchanged styling/copy per mode.
- **Right**: TODO widget — unchanged styling.
- **Roast text output** (the quote shown after clicking Roast): full-width below this row, same conditional (`roast && appState === "ready"`) and styling as currently, just relocated to sit under the row that triggers it.

## Mode coverage

All three modes (zen / party / wabi-sabi) must render correctly post-restructure. Since every element retains its exact current mode-conditional inline styles and copy, verification is primarily: confirm nothing was dropped/duplicated during relocation, and confirm the Party pill fix doesn't affect zen/wabi-sabi pill rendering.

## Responsive behavior

Preserve existing `flex-wrap` patterns. Row A right column uses `flex-direction: column; align-items: flex-end` (per mockup), wrapping to full width on narrow viewports same as today's Row A right cluster.

## Testing

Manual verification in the running dev app: toggle through Party / Basic AF / Zen via the mode pills (now in Row A right column) and confirm:
- Party pill active state shows white text on pink fill (bug fixed)
- AccountToggle renders correctly under the wordmark in all 3 modes
- Stats row, batch/refresh, Compose/Roast/TODO row, and roast text all render and function correctly in all 3 modes
- Layout doesn't break on narrow viewports
