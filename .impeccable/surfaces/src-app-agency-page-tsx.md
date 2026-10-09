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
