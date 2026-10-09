# Lotus

Agency operating system: everything an agency needs to run clients in one place.
CRM, inbox, funnels and automations under the hood, with two client modes
(**digital marketing** and **digital fundraising**) and an agency-only
**Daily Diagnostic** that tells the team every morning which client needs attention.

## Status

Foundation. This commit contains:

- Next.js 16 app (App Router, TypeScript, Tailwind v4)
- Database schema for agencies, client sub-accounts, memberships, contacts,
  daily diagnostics, notes and tasks, with row-level security
  (`supabase/migrations/0001_foundation.sql`)
- Agency workspace UI: Daily Diagnostic board, client list, client detail
  with diagnostic, notes and tasks
- Demo data so the app runs with no backend configured

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase credentials the app shows demo
clients. To use a real database, create a Supabase project, run the migration
in `supabase/migrations/`, copy `.env.example` to `.env.local` and fill in the
URL and anon key.

## Structure

```
src/app/agency/            agency workspace (diagnostic board, clients)
src/components/            UI pieces (diagnostic card, sparkline, sidebar)
src/lib/data/              data access, demo fallback
src/lib/supabase/          server and browser Supabase clients
supabase/migrations/       database schema
```

## Roadmap

See the research doc in the project for the full plan. Next up: auth and
onboarding, the marketing mode ad-metrics feed (Meta and Google Ads), the
fundraising mode donation checkout and donor CRM, then funnels, inbox and
automations.
