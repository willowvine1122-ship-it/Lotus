---
name: Lotus
description: Agency operating system; a departure board for every client, read top to bottom in seconds.
colors:
  rail: "#0b1220"
  rail-2: "#182540"
  rail-line: "#243556"
  rail-fg: "#ffffff"
  rail-fg-2: "#c7cfdf"
  bg: "#f8f7f4"
  surface: "#ffffff"
  surface-2: "#f1efea"
  line: "#e3e0d8"
  line-strong: "#c9ccd3"
  fg: "#16181d"
  fg-2: "#3f434c"
  fg-3: "#6b7079"
  brand: "#6d3df2"
  brand-hover: "#5b2fd6"
  brand-soft: "#ebe4ff"
  red: "#d1283b"
  red-soft: "#fde4e6"
  amber: "#b86a00"
  amber-soft: "#fff0d1"
  green: "#1f8a4c"
  green-soft: "#dcf5e6"
typography:
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    letterSpacing: "normal"
    fontFeature: "\"tnum\" 1, \"cv11\" 1"
  body-sm:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  caption:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1.125rem"
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "0.06em"
  numeral:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: "1.5rem"
    letterSpacing: "-0.01em"
    fontVariation: "tabular-nums"
rounded:
  hairline: "1px"
  check: "3px"
  chip: "4px"
  mark: "5px"
  DEFAULT: "6px"
spacing:
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "3.5": "14px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.rail-fg}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.DEFAULT}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-secondary:
    backgroundColor: "{colors.rail-2}"
    textColor: "{colors.rail-fg}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.DEFAULT}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.rail-line}"
  chip-red:
    backgroundColor: "{colors.red-soft}"
    textColor: "{colors.red}"
    typography: "{typography.caption}"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "24px"
  chip-amber:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber}"
    typography: "{typography.caption}"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "24px"
  chip-green:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green}"
    typography: "{typography.caption}"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "24px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.rail-fg-2}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.DEFAULT}"
    padding: "6px 10px"
  nav-item-active:
    backgroundColor: "{colors.rail-2}"
    textColor: "{colors.rail-fg}"
  page-header:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-fg}"
    typography: "{typography.headline}"
    padding: "24px 32px 20px"
  board-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    padding: "14px 32px"
  board-row-hover:
    backgroundColor: "{colors.surface-2}"
  brand-mark:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.rail-fg}"
    rounded: "{rounded.mark}"
    size: "28px"
---

# Design System: Lotus

## Overview

**Creative North Star: "The Departure Board"**

Lotus is read the way a traveller reads a railway departure board: one aligned table, scanned top to bottom in seconds, delays at the top in red, each row telling you status, the number that matters, and the next action. The screen is framed by a single deep ink field (the left rail and the page header band are one colour, one frame) and everything inside that frame sits on paper. Nothing is boxed; rows are separated by hairline rules and columns by a grid that every row shares, so the eye reads down a column rather than across a card.

The palette is deliberately quiet so the three signal colours can speak. Red, amber and green are the only colours with meaning on the paper, and they mean exactly one thing each: needs action, watch, on track. Lotus violet is the brand, not a signal: it appears on the mark in the rail and on the one primary action per screen, and nowhere else. Density is high but calm, because the type is a single grotesk at a tight, fixed scale and every number is tabular.

The build rejects the category default of same-size metric cards with sparklines, drop-shadowed panels, and the GoHighLevel pattern of many competing surfaces. Depth is nearly absent by design; the one shadow in the system is a one-pixel lift on the primary button.

**Key Characteristics:**
- One ink frame (rail plus header band) around a paper work area; no second dark surface anywhere
- Three-state signal palette with soft fills for chips and strong tints for text, bars and delta
- Violet reserved for the brand mark and the primary action
- One family, Geist, at a fixed 1.2-ratio rem scale, tabular numerals on every figure
- Hairline rules and shared column grids in place of cards
- The board row: leading status column, aligned figures, 7-day strip, truncated latest note, and an inline service notice under flagged rows

## Colors

A near-black ink frame, warm paper inside it, and three signal colours that are only ever used for health.

### Primary
- **Lotus Violet** (`brand`): the brand mark in the rail and the one primary button on a page header ("Add client"). Also the focus ring (2px outline, 2px offset) and the text-selection fill via `brand-soft`. It never codes data.
- **Lotus Violet, pressed** (`brand-hover`): hover state of the primary button only.
- **Violet Wash** (`brand-soft`): `::selection` background; otherwise unused.

### Secondary
The signal set. Each colour has a strong tint for text, bars and icons and a soft tint for chip fills.
- **Delay Red** (`red` / `red-soft`): needs action. Chip fill and text, alert sentence, last trend bar, negative delta, the "1 needs action" count in the header band, and the tinted notice on the client page (`red-soft` at 60% with a `red` border at 20%).
- **Watch Amber** (`amber` / `amber-soft`): watch. Same roles as red for amber-health clients and the "to watch" count.
- **On-Time Green** (`green` / `green-soft`): on track. Chip, last trend bar, positive delta, and the filled checkbox of a done task.

### Neutral
- **Ink** (`rail`): the left rail and the page header band. The only committed colour field on the screen.
- **Ink, raised** (`rail-2`): active nav item fill and the secondary button fill inside the ink frame.
- **Ink rule** (`rail-line`): hairlines inside the rail (under the mark, above the agency name) and the secondary button border.
- **Rail text** (`rail-fg` / `rail-fg-2`): white for the active item, the page title, links and button labels in ink; muted blue-grey for inactive nav items and header meta.
- **Paper** (`bg`): the page ground below the board and around the content.
- **Data ground** (`surface`): white; the board and client list sit on it so figures read at maximum contrast.
- **Second surface** (`surface-2`): warm off-white; row hover (at 70%) and the green-health notice fill.
- **Hairline** (`line`): every row separator, column-header rule, section-title rule and metric-row rule.
- **Strong hairline** (`line-strong`): trend bars that are not the latest day, unchecked task boxes, scrollbar thumb.
- **Text** (`fg` / `fg-2` / `fg-3`): near-black for names, figures and headings; dark grey for body copy, notes and metric labels; mid grey for column headers, captions, counts of zero and empty states.

### Named Rules
**The One Frame Rule.** Rail and header band share one ink and read as a single frame. No other element on a screen may use the ink field; the work area is paper and white.

**The Three Signals Rule.** Red, amber and green mean needs action, watch and on track, and nothing else. Strong tint for text, bars, icons and deltas; soft tint only as a chip or notice fill behind the strong tint.

**The Violet Is Not A Signal Rule.** Violet appears on the brand mark and the single primary action of a page. It never colours a figure, a status or a trend.

## Typography

**Display Font:** Geist (with system-ui, sans-serif)
**Body Font:** Geist (with system-ui, sans-serif)
**Label/Mono Font:** Geist Mono is loaded (`--font-geist-mono`) but no shipped surface uses it.

**Character:** One grotesk, used plainly, at a fixed rem scale with a 1.2 ratio. The system is typographic the way a timetable is: hierarchy comes from weight, size and alignment, never from a second face. `tnum` and `cv11` are on for the whole document; the `.num` class adds `tabular-nums` and a slight negative track to every figure.

### Hierarchy
- **Headline** (600, 1.625rem / 2rem, tracking-tight): the page title in the ink header band. The only large type in the product.
- **Title** (600, 0.8125rem / 1.25rem): section titles on the client page ("Diagnostic", "Notes", "Tasks"), sitting on a hairline rule with a right-aligned caption aside.
- **Body** (400, 0.9375rem / 1.5rem): client names (at 500) and the base size for board figures. Not used for running copy.
- **Body small** (400, 0.8125rem / 1.25rem): running copy everywhere: notes, service notices, metric labels, nav items, button labels, header meta. Notices and note bodies are capped at 72ch with relaxed leading.
- **Caption** (400, 0.75rem / 1.125rem): secondary lines under names (mode), note metadata, task metadata, chip labels (at 500), the demo-data footer.
- **Label** (500, 0.6875rem / 1rem, 0.06em, uppercase): column headers of the board and client list, and the stacked field labels in the mobile board row. This is the table-head voice of a timetable and is confined to column heads.
- **Numeral** (500, 0.9375rem / 1.5rem, tabular, -0.01em): every figure on the board and in metric rows; the delta uses the same treatment at caption size.

Unused steps in the scale (`lg` 1.125rem, `xl` 1.375rem) exist in the stylesheet and are available for the next surface; the shipped build does not use them.

### Named Rules
**The Tabular Rule.** Any number that can be compared down a column is set with `.num`: tabular figures, 500 weight, -0.01em. A proportional figure in a column is a defect.

**The One Face Rule.** Geist only. Weight (400 / 500 / 600) and size carry the hierarchy; no italics, no second family, no display sizes beyond the headline.

## Layout

The shell is a fixed 224px ink rail on the left (desktop, `md` and up) with the content column filling the rest; on mobile the rail becomes a top bar with the mark, name and icon-only nav. Content gutters are 20px on mobile and 32px from `md` up, and the header band, column headers and rows all share those gutters so the left edge of the status column lines up with the page title.

The board is a CSS grid with one column template shared by the header row and every data row: `112px | minmax(180px,1.4fr) | minmax(90px,0.8fr) | minmax(96px,0.7fr) | minmax(100px,0.9fr) | 112px | minmax(160px,1.6fr) | 56px` (status, client, money, count, rate, 7-day, latest note, tasks), with 16px column gaps. Money, count, rate and tasks are right-aligned. Below `md` the row collapses to a two-column grid: status and client span both columns, the three figures stack with uppercase labels above them, and the note is hidden on flagged rows because the service notice carries it. The client list uses the same device with a four-column template (`minmax(200px,1.5fr) | 140px | 120px | 80px`).

The service notice under a flagged row is indented to the client column (`2rem + 112px + 1rem`) on desktop so the alert text starts under the client name, and is capped at 72ch.

The client page is a two-column grid from `lg`: the main column (`minmax(0,1fr)`) carries Diagnostic and Notes stacked with 32px between sections; a 300px aside carries Tasks; 40px column gap, 24px vertical padding. Metric rows sit in a two-column `dl` from `sm` with 48px between columns, 10px vertical padding per row.

Vertical rhythm: column header rows 8px, board rows 14px, metric and task rows 10px, note rows 12px, header band 24px top and 20px bottom. All spacing is on the 2px/4px Tailwind scale; the steps actually used are 6, 8, 10, 12, 14, 16, 20, 24, 32 and 40px.

## Elevation & Depth

Flat. Depth is carried by tone, not shadow: the ink frame sits visually behind the white data ground, the paper page ground is a half-step warmer than the white board, and a row lifts on hover by tinting to the second surface at 70%. No panel, row, chip or notice casts a shadow. The single exception is the primary button, which carries a one-pixel ambient lift so it reads as pressable against the ink band.

### Shadow Vocabulary
- **Button lift** (`box-shadow: 0 1px 2px rgb(16 24 40 / 0.06), 0 1px 1px rgb(16 24 40 / 0.04)`): the primary button only.

### Named Rules
**The Flat Paper Rule.** Surfaces are flat. Separation is a hairline (`line`) or a change of ground (`bg` to `surface` to `surface-2`), never a shadow or a border box. The only shadow in the product is on the primary button.

## Shapes

Small, squared-off radii that keep the timetable's rectilinear character. The default radius is 6px (buttons, nav items, the client-page notice). Chips are 4px, the brand mark 5px, task checkboxes 3px, and the trend bars and the chip's status square are 1px, which reads as a crisp block rather than a dot. Nothing is a pill and nothing is a circle.

Borders are hairlines (1px, `line`) used as rules under rows and section titles, not as outlines around containers. The two bordered containers in the build are the secondary button (ink rule, inside the frame) and the client-page notice (signal colour at 20% around a soft fill). Icons are Lucide strokes at 1.75 (2 for the arrow and plus inside buttons and links), 16px in rows and nav, 14px inside meta links.

## Components

### Buttons
Compact, 32px tall, with a 6px radius and a 13px medium label; an icon leads the label with a 6px gap.
- **Shape:** squared-off (6px)
- **Primary:** violet fill, white text, 0 12px padding, button lift shadow; hover shifts to pressed violet. One per page header; it always routes somewhere (ButtonLink).
- **Secondary:** raised-ink fill with an ink-rule border, white text; hover fills with the ink rule. Lives inside the ink frame beside the primary.
- **Hover / Focus:** 150ms colour transition; focus is the global 2px violet outline with 2px offset. Disabled is 50% opacity with a not-allowed cursor.

### Chips
The status chip: a 24px, 4px-radius block in the soft signal tint with the strong tint for text, a 6px square of the text colour leading the word.
- **Style:** `red-soft`/`red` "Needs action", `amber-soft`/`amber` "Watch", `green-soft`/`green` "On track"; 12px medium, 8px horizontal padding, never wraps.
- **State:** no interactive states. A compact variant drops the word and keeps it for screen readers. Used in the board status column, the client list, and inline beside the client name in the header band.

### Cards / Containers
There are no cards. Content sits directly on the white data ground or the paper page ground, separated by hairline rules.
- **Corner Style:** none for rows and sections; 6px for the one notice box on the client page.
- **Background:** `surface` for the board and list; `bg` for the page around them.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px `line` rule under each row, column-header row and section title.
- **Internal Padding:** rows 14px vertical at the page gutters; metric and task rows 10px; the client-page notice 12px 16px.

### Inputs / Fields
Not shipped. The task checkbox is the only form-like control: a 16px, 3px-radius square with a strong-hairline border on white; done state fills green with a white 12px check at stroke 3 and strikes the title in `fg-3`.

### Navigation
The rail: 224px wide, ink, with the mark and "Lotus" (16px semibold, tracking-tight) above an ink rule, six items below, and "Lotus agency" in caption muted text pinned under a rule at the bottom.
- **Item:** 13px, 16px Lucide icon at 1.75 stroke, 6px 10px padding, 6px radius; inactive in `rail-fg-2`, hover tints `rail-2` at 60% and brightens to white, active (`aria-current="page"`) is solid `rail-2` with white text. 150ms transition.
- **Mobile:** the rail becomes a top bar (16px 12px padding) with icon-only items in a horizontal scroll; labels stay for screen readers.

### Page Header Band
Ink band in the same colour as the rail, 24px top and 20px bottom padding at the page gutters. Left: the headline title with an optional 13px `rail-fg-2` meta line underneath (date, counts, mode, or a back link in white with a 14px arrow). Right, bottom-aligned: the actions slot carrying the primary button. The meta line uses "·" separators and tints a count red or amber (at 500) when it is non-zero.

### Board Row (signature)
One client per row on the shared column grid, 14px vertical padding, hairline rule below, hover tint to `surface-2` at 70%.
- **Status column** leads with the chip (or "No data" in caption muted).
- **Client**: name at 15px/500 as the only link (hover underline), mode in caption muted beneath.
- **Figures**: three right-aligned numerals at 15px/500 tabular.
- **7-day**: the trend strip and the delta side by side.
- **Latest note**: 13px, author at 500 in `fg`, body truncated to one line with the full text in `title`; "No notes" in muted.
- **Tasks**: open count right-aligned, 0 in muted.
- **Service notice**: on red or amber rows only, a second line under the row indented to the client column: a 16px triangle icon in the signal colour, the alert sentences joined with " · " in the signal colour at 500, then the summary in `fg-2`, then the latest note on its own line with the author at 500. Capped at 72ch, relaxed leading, no box. Rows sort red, amber, green.

### Trend Strip and Delta
Seven 5px-wide bars, 3px apart, 1px radius, scaled to a 20px max height with a 2px floor; the first six are `line-strong`, the last is the row's signal colour. Beside it the delta: a signed percentage at caption size, 500, tabular, green when good, red when bad, muted "±0%" when flat. `goodWhenUp` flips the polarity for cost metrics.

### Metric Row
On the client page, a `dl` row with the label in 13px `fg-2` on the left and the numeral right-aligned on a baseline, 10px vertical padding, hairline rule below. The last row swaps the numeral for the trend strip and delta.

## Do's and Don'ts

### Do:
- **Do** keep the rail and header band in one ink (`rail`) and everything inside the frame on `surface` or `bg`.
- **Do** put every status in the leading column as a chip, and sort rows red, amber, green.
- **Do** set every figure with `.num` (tabular, 500, -0.01em) and right-align figures in columns.
- **Do** separate rows and sections with 1px `line` rules and share one grid template between a header row and its data rows.
- **Do** carry alerts as an inline service notice under the row (icon, alert sentence in the signal colour, summary, note), capped at 72ch.
- **Do** use violet only for the brand mark and the single primary action of a page.
- **Do** keep uppercase 0.06em labels to column headers and mobile field labels.
- **Do** use 6px as the default radius and nothing larger.

### Don't:
- **Don't** put metrics in cards or boxed panels; the board is a table, not a dashboard of tiles.
- **Don't** use red, amber or green for anything other than client health, delta direction or a done task.
- **Don't** add a second dark surface inside the work area, or tint a row with ink.
- **Don't** introduce a second typeface, italics, or sizes above the 1.625rem headline.
- **Don't** add shadows to rows, chips, notices or panels; the primary button lift is the only shadow.
- **Don't** use pills or circles; radii stay at 6px or below and the status dot is a 1px-radius square.
- **Don't** write an uppercase label above a title as a kicker; the label style belongs to column heads only.

## Revision 2: Daily Diagnostic as master table + client panel (2026-10-09)

The founder supplied a reference Daily Diagnostic (workfuel; copies in the project files under lotus/reference/) and made it the bar. This revision supersedes the "no cards" and "square status dot" rules above for the Daily Diagnostic; the ink frame, the paper ground, Geist with tabular numerals, the three signals and the 6px radius all stand.

### Colors, added
- **Series Blue** (`chart-1`, #2f6fed) and **Series Orange** (`chart-2`, #e8731c): the only two data colours. Validated as a categorical pair with the dataviz validator (light surface). Orange is lead cost / leads / avg gift; blue is appointment cost / appointments / raised. Marks only: text beside a mark always uses text tokens. They never appear outside charts, sparklines, avatars and the country bars.
- The status dot is now an 8px circle (`red`/`amber`/`green`) leading the client name; the 24px chip survives on the client list and client page.

### Components, added
- **Top bar**: a 56px ink band (title 18px/600 with a 12px meta line; search field in `rail-2` with a `rail-line` border; Marketing | Fundraising segmented control; range select; 28px primary button).
- **KPI tile**: bordered white tile (1px `line`, 6px), 12px 16px padding; uppercase 11px label, 22px/600 tabular figure, a muted 12px aside bottom-right (red or amber when it is an attention count). Four across from xl.
- **Data table**: a real `<table>` on white. Header row uppercase 11px `fg-3` with a sort icon per column (chevrons when inactive, arrow when active, `aria-sort` set); 52px rows, hairline below, hover `surface-2` at 60%; the selected row is `brand-soft` at 40% with a 2px violet inset bar on the left (the one place violet marks state). Figure cells: 13px/500 tabular with a signed change beside it (green good, red bad, `goodWhenUp` flips for costs) and an 11px muted count beneath.
- **Pacing gauge**: 120px wide; a 2px `line-strong` track with a centre tick for "on pace" and an 8px dot (surface ring) placed at pace on a 0–200% scale, coloured by `pacingTone` (budget: green 90–110, amber 70–135, else red; goal: green ≥90, amber ≥70, else red). Percent in the tone colour above left, budget compact in muted above right.
- **Sparkline**: 72×20, 1.5px line in `chart-1` with a 5px end dot, 30 daily values, a change tag beside it.
- **Client panel**: 360/384/420px at lg/xl/2xl, white, 1px `line` on the left, sticky full-height and scrolling on its own; on mobile a right-anchored sheet over a 40% ink scrim with a close button. Sticky header (status dot, 18px/600 name, open-client icon, amber tags with a dashed "Add tag" chip, location / local time / days active in 12px, 24px initial avatars ring-2 surface overlapping 6px). Body 20px gutters, 24px between sections.
- **Diagnosis box**: red or amber soft fill at 50% with the strong tint at 25% as border; alerts joined with " · " in the signal colour at 500, summary in `fg-2`.
- **Tile (panel)**: `surface-2` at 50% with a `line` border, uppercase label, 18px/600 figure, 12px sub-line. Always a 2×2 grid.
- **Ledger row**: label uppercase 11px left, figures right, same fill as the tile; the green variant (`green-soft` 50%, `green` 25% border, label in green) is reserved for the money-in row (est. revenue & ROI, raised per day).
- **Segmented (paper)**: 28px track in `surface-2`, 2px inset; active segment is solid ink with white text. **Range chips**: 24px bordered chips, active is solid ink.
- **Line chart**: 190px tall, 44px left gutter, four nice ticks with hairline `line` gridlines, 2px round-joined lines, no area fill, a legend above when two series, 10px muted axis text, crosshair (`line-strong`) with 8px ringed dots and an HTML tooltip (white, `line` border, shadow-2) that flips side past 60% width.
- **Column chart**: 150px tall, columns ≤24px with a 2px gap and a 4px rounded data-end on a square baseline, other columns dim to 55% on hover, same tooltip.
- **Bar list** (raised by country): label left, compact value and share right, a 6px `surface-2` track with a `chart-1` fill.
- **Trend tile**: label, then one row per window (7D, 30D): before in muted, 12px arrow, after at 500, change with a diagonal arrow right-aligned.
- **Metrics table**: bordered 6px container, `surface-2` header row at 70%, 12px rows, metric names as row headers at 500, figures right-aligned tabular in `fg-2`; a By month | By week segmented control.
- **Notes feed**: date dividers (hairline, uppercase 11px date, hairline), note cards on `surface-2` at 40% with a 28px initial avatar, author at 500, relative time in muted on the right, body 13px relaxed in `fg-2`.

### Do's and Don'ts, amended
- **Do** keep tiles to the KPI strip and the client panel; the board itself stays a table.
- **Do** give every chart a legend when it has two series, a tooltip, and one axis.
- **Don't** use `chart-1` or `chart-2` for anything that is not a mark.
- **Don't** colour text in a series colour; identity comes from the swatch beside it.

## Revision 3: clients and sub-accounts (2026-10-09)

The client roster, the add-client form, the client page and the client's own view use the frame and the components above. Nothing new in colour; these are the layout rules the screens follow.

### Components, added
- **Form** (`src/components/form.tsx`): 36px controls, 1px `line-strong` border, 6px radius, violet focus ring; a 13px/500 label above, a 12px muted hint or a red error below; money inputs with a muted "$" prefix. **Form section**: a 220px label column (title 14px/600, 12px muted explanation) beside the fields, sections separated by a hairline, 32px apart. Primary action bottom-left with a text "Cancel" beside it. **Mode picker**: two bordered tiles, the chosen one in `brand-soft` with a violet border. **Checkbox chip**: 32px bordered chip with a native checkbox; checked gets the violet border and `brand-soft` fill.
- **Client page header**: the ink header carries the status dot, the name at 24px, a status tag (Onboarding in brand, Active neutral, Paused amber), a 13px meta line (back link · mode · industry · location · local time · health) and, on the right, the assignee avatars and a secondary "Client view" button. **Tabs** sit at the bottom of the ink band: 36px tall, 13px, a 2px white underline on the current tab, counts in a `rail-2` pill.
- **Work area layouts**: overview is the panel sections at 640px beside a 360px notes column; notes, tasks and team are a 640px list beside a 320px form card (white, `line` border, 16px padding); settings is the full form.
- **Task row**: 16px square checkbox (green when done), title 13px, a 12px muted line with state · assignee · due (amber "due today", red "overdue since …").
- **Member row**: 32px avatar, name with an amber "Invited … ago" tag while pending, email muted, role on the right, a trash icon that turns red on hover.
- **Client view** (`/c/[slug]`): the client's own header (initial mark in violet, client name, "Powered by Lotus", a Sign in button) over a 960px column: "Your results" at 24px with a meta line, then the same panel sections the agency sees, beside a "Your team" card. No notes, tasks, diagnosis text or internal tags.
- **Sign in**: ink left half with the mark and a 24px claim, paper right half with a 360px form; the demo-mode notice is an amber-soft box.

### Rules
- A client with no numbers yet shows "–" for rates, "No data yet" dashed boxes for charts, and a neutral pacing figure; red is never shown for the absence of data.
- Internal notes, tasks and the diagnosis never render under `/c/`.

## Revision 4: CRM (2026-10-09)

Contacts, the pipeline and the contact page reuse the board grammar (ink top bar, KPI strip, table, right panel) and the form grammar from Revision 3.

### Components, added
- **Contacts board**: top bar with title and a count line, search, a client select and an Open | Everyone select in `rail-2`, a secondary Pipeline button and the primary add button; KPI strip (Contacts, Open pipeline, Won or Monthly donors, Won value or Lifetime giving); a table of Contact (name over email or phone), Client, Stage, Source, Value, Last activity, Owner; the selected row drives the contact panel.
- **Stage tag**: every stage is a neutral tag. Amber and red stay reserved for health.
- **Contact panel**: sticky header (name with an open-page icon, company · city · client, the stage select, tags, "Added … ago"), a Details ledger (email, phone, source, value, monthly giving, owner) with an Edit link, Do-not-contact chips (ink when on), a Log form (Note | Call | Text | Email plus a body), then the activity timeline.
- **Activity timeline**: date dividers as in the notes feed; each item a `surface-2` card with a 28px ringed icon circle for the kind, title at 500, amount in tabular figures, "by · time ago" muted on the right, body relaxed in `fg-2`.
- **Pipeline board**: one 240px column per stage on `surface-2`, header with name, count and column value; cards on white with name, company or city, owner avatar, "source · time ago" and the value; the selected card has an ink border; horizontal scroll.
- **Contact page**: ink header with the name, stage tag, meta line (back, client, source, city) and the stage select on the right; activity at 640px beside a 360px details column.

### Rules
- Stage colour never encodes progress; the column position and the word do.
- Logging a call, text or email records it; sending arrives with the Inbox and the form says so.

## Revision 5: inbox (2026-10-09)

`/agency/inbox` answers the three questions: the one table is the conversation list, the panel is the contact, and the work area between them is the thread. The ink top bar carries the counts (open, unread, unassigned), search, an All | Mine | Unassigned control and the one primary action, "New message".

### Colors, added
- **Ink wash** (`--ink-100`, #e6eaf2): the fill of the team's own messages in a thread. Ink is the agency's frame, so the team's words carry a pale tint of it; the contact's messages sit on white with a `line` border. Used nowhere else.
- Channel identity is a monochrome glyph (Lucide `MessageSquare` and `Mail`; drawn WhatsApp and Facebook glyphs on the same 24px grid and 1.75 stroke) in the surrounding text colour. Brand greens and blues are never used: on paper they would read as signals.

### Components, added
- **Conversation row**: 32px neutral initial avatar (`surface-2`, `line` border; colour is reserved for the team), name 13px (600 when unread), time 11px tabular right; client line 12px muted with a 6px health dot and the assignee right; preview 13px with the channel glyph and, when unread, an 18px ink count block. Selected row is `surface-2` with a 2px ink bar on the left (no violet for state). Hairline between rows.
- **List filters**: client select (grouped Marketing / Fundraising) beside a paper Open | Unread | Closed segmented control; below, channel chips (28px, 4px radius; active is solid ink) with counts.
- **Thread**: date dividers as in the notes feed; contact messages left, team messages right on the ink wash, both 6px radius, max 520px (email 600px with the subject in 600 over a hairline); an 11px meta line under each (glyph, channel, time, author, delivery state; "Not delivered" in red with a 20% red border on the message). Internal notes are full width to 600px, dashed `line-strong` border on white, a lock and "Internal note" label.
- **Composer**: Reply | Internal note (paper segmented), "via" channel select that disables channels the contact cannot receive (no phone, no email, opted out, never wrote to the page), subject for email, a 76px textarea, a character and segment count for texts, and the violet Send. Note mode tints the composer `surface-2` and dashes the textarea. Ctrl or Cmd + Enter sends.
- **Contact panel**: 300px from 1400px wide (340px from 2xl), otherwise a right sheet behind the info button; header with 40px avatar, name 18px/600, city and since date, neutral tags; then Contact (dl rows), Client (health dot, link, "show only this client"), Channels used with counts and last time, Assigned.
- **Phone**: the list is the page; a thread opens over it with a back arrow, and the contact opens as a sheet.
