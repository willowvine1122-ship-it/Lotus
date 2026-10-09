---
version: 1
slug: "src-app-agency-page-tsx"
primary_target: "src/app/agency/page.tsx"
related_targets: ["src/app/agency/clients/page.tsx","src/app/agency/clients/[slug]/page.tsx"]
---

# Agency workspace: Daily Diagnostic board and client detail

Scope: /agency (board), /agency/clients, /agency/clients/[slug]. Mode: Operate.

Audience and job: the Lotus agency team, first thing in the morning and in the internal client meeting. Task: see every client's state at once, know who needs action, read the latest internal note, and get to the client's detail. Content: demo clients in two modes (marketing, fundraising), yesterday's metrics, 7-day trend, alerts, AI summary, notes, tasks. Constraints: must read as a working product, cleaner than GoHighLevel; all client data is synthetic and labelled.

Candidates considered (ordered by resonance): 1 media-plan trading sheet, 2 national weather-service daily forecast page, 3 league standings table, 4 fund factsheet / research note, 5 Swiss railway departure board and timetable, 6 hospital rounds chart (literal reading of "Diagnostic"), 7 nonprofit impact report. The roll ran degraded (no challengers reachable) and assigned candidate 5.

## Direction contract

THESIS: The Daily Diagnostic is a departure board: one aligned table of every client, read top to bottom in seconds, delays at the top in red, each row telling you status, the number that matters, and the next action. It refuses the category default of a grid of same-size metric cards with sparklines.

OWN-WORLD: Timetable grammar. One grotesk family (Geist) at a tight scale with tabular numerals everywhere; hairline rules, no card chrome. Committed palette: a deep ink-blue rail and page header band carrying the brand (Lotus violet appears only on the mark and primary actions), white data ground, warm off-white second surface, and a strict three-state signal set: red (needs action), amber (watch), green (on time). Density is high but aligned to a column grid shared by every row. Signature move: the board itself, rows with a leading status column and an inline disruption strip under delayed rows, like a timetable's service notice.

STORY: The team opens Lotus, scans the board, sees two clients flagged, reads the one-line cause and the CMO's note inline, clicks through to act. Clients in good standing take one row each and no more attention.

FIRST VIEWPORT: Dark rail on the left (brand mark, six nav items, agency name at the bottom). Page header band in the same ink: "Daily Diagnostic", the date, and a count strip (4 clients · 1 needs action · 1 watch). Below, the board: column headers (Status, Client, Spend or Raised, Leads or Donations, Cost per booking or Avg gift, 7-day, Latest note, Tasks), rows sorted red, amber, green. Flagged rows carry a second line: alert text and the summary sentence. Primary action per row is the client name link; the header has one "Add client" button in violet.

FORM: Swiss railway departure board / timetable, candidate 5 of 7, seed key 0faa79ea (degraded roll, no challengers).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.


## Revision 2 (2026-10-09, founder reference)

The founder supplied screenshots of a Daily Diagnostic they consider the bar (workfuel; copies under /mnt/project-files/lotus/design-reference/). The frame of the direction stands (ink rail, paper ground, Geist with tabular numerals, three signals, hairlines), but the composition changed from a single board to master table plus persistent client panel:

FIRST VIEWPORT: slim ink top bar (title, date, search, Marketing | Fundraising switch, range, Add client). KPI strip of four bordered tiles. A real `<table>` with sortable columns (client with status dot, New badge and note count; lead cost with change and count; apt cost; book rate; budget pacing gauge with budget; spend; est ROI; 30-day sparkline). The selected row drives a 384px right panel, sticky and scrollable: header (status, name, open link, tags, location, local time, days active, assignees), diagnosis box when flagged, 2x2 tiles, spend / pacing / est revenue rows, rolling 7-day performance line chart with series and range switches, daily volume columns, year over year placeholder, trend tiles, month or week metrics table, notes feed. Fundraising mirrors it: raised, avg gift, donations, new monthly, goal pacing, raised by country bars.

Charts use two reserved series colours (blue #2f6fed, orange #e8731c; validated as a categorical pair) that appear nowhere else in the UI. Lead/raised series is orange on marketing cost charts and blue elsewhere: orange = lead cost and leads, blue = apt cost and apts; fundraising: blue = raised, orange = avg gift.
