import type {
  ClientRecord,
  FundraisingClient,
  FundraisingDay,
  Health,
  MarketingClient,
  MarketingDay,
} from "./types";

/*
 * Derived numbers for the Daily Diagnostic. Everything the board and the
 * client panel show is computed here from the raw daily series, so the
 * table, the tiles and the charts can never disagree with each other.
 */

export type RangeDays = 7 | 14 | 30 | 60 | 90;

export function lastN<T>(days: T[], n: number, offset = 0): T[] {
  const end = days.length - offset;
  return days.slice(Math.max(0, end - n), Math.max(0, end));
}

/** Relative change, null when there is nothing to compare against. */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/* ---------------------------- marketing ---------------------------- */

export interface MarketingSummary {
  spendCents: number;
  leads: number;
  appointments: number;
  showed: number;
  closed: number;
  leadCostCents: number | null;
  aptCostCents: number | null;
  bookRate: number | null;
  showRate: number | null;
  estRevenueCents: number;
  roi: number | null;
}

export function summarizeMarketing(days: MarketingDay[], avgJobValueCents: number): MarketingSummary {
  const spendCents = sum(days.map((d) => d.spendCents));
  const leads = sum(days.map((d) => d.leads));
  const appointments = sum(days.map((d) => d.appointments));
  const showed = sum(days.map((d) => d.showed));
  const closed = sum(days.map((d) => d.closed));
  const estRevenueCents = closed * avgJobValueCents;
  return {
    spendCents,
    leads,
    appointments,
    showed,
    closed,
    leadCostCents: ratio(spendCents, leads),
    aptCostCents: ratio(spendCents, appointments),
    bookRate: ratio(appointments, leads),
    showRate: ratio(showed, appointments),
    estRevenueCents,
    roi: ratio(estRevenueCents, spendCents),
  };
}

export interface Pacing {
  /** 1 = exactly on pace for the month. */
  pct: number;
  spentCents: number;
  budgetCents: number;
  projectedCents: number;
  dayOfMonth: number;
  daysInMonth: number;
}

/** Month-to-date spend (or raised) against a monthly budget (or goal). */
export function pacing(points: { day: string; value: number }[], budgetCents: number, now: Date): Pacing {
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const spentCents = sum(points.filter((p) => p.day.startsWith(monthKey)).map((p) => p.value));
  const elapsed = Math.max(1, dayOfMonth - 1); // series ends yesterday
  const expected = (budgetCents * elapsed) / daysInMonth;
  return {
    pct: expected > 0 ? spentCents / expected : 0,
    spentCents,
    budgetCents,
    projectedCents: Math.round((spentCents / elapsed) * daysInMonth),
    dayOfMonth,
    daysInMonth,
  };
}

/** Budget pacing: both over- and underspend are off. Goal pacing: only behind is off. */
export function pacingTone(pct: number, kind: "budget" | "goal" = "budget"): Health {
  if (kind === "goal") return pct >= 0.9 ? "green" : pct >= 0.7 ? "amber" : "red";
  if (pct >= 0.9 && pct <= 1.1) return "green";
  if (pct >= 0.7 && pct <= 1.35) return "amber";
  return "red";
}

/** Rolling-window cost series: window sum of cost / window sum of count. */
export function rollingCost(
  days: { day: string; cost: number; count: number }[],
  window = 7,
): (number | null)[] {
  return days.map((_, i) => {
    if (i < window - 1) return null;
    const slice = days.slice(i - window + 1, i + 1);
    const cost = sum(slice.map((d) => d.cost));
    const count = sum(slice.map((d) => d.count));
    return count > 0 ? cost / count : null;
  });
}

export function rollingMean(values: number[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return sum(slice) / slice.length;
  });
}

/* --------------------------- fundraising --------------------------- */

export interface FundraisingSummary {
  raisedCents: number;
  donations: number;
  newDonors: number;
  newRecurring: number;
  avgGiftCents: number | null;
  recurringShare: number | null;
  raisedPerDayCents: number;
}

export function summarizeFundraising(days: FundraisingDay[]): FundraisingSummary {
  const raisedCents = sum(days.map((d) => d.raisedCents));
  const donations = sum(days.map((d) => d.donations));
  const newDonors = sum(days.map((d) => d.newDonors));
  const newRecurring = sum(days.map((d) => d.newRecurring));
  return {
    raisedCents,
    donations,
    newDonors,
    newRecurring,
    avgGiftCents: ratio(raisedCents, donations),
    recurringShare: ratio(newRecurring, donations),
    raisedPerDayCents: days.length ? raisedCents / days.length : 0,
  };
}

/* ------------------------------ periods ----------------------------- */

export interface Period<T> {
  key: string;
  label: string;
  days: T[];
}

const monthShort = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short" });

/** Calendar months present in the series, newest first, at most `limit`. */
export function byMonth<T extends { day: string }>(days: T[], limit = 3): Period<T>[] {
  const groups = new Map<string, T[]>();
  for (const d of days) {
    const key = d.day.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limit)
    .map(([key, ds]) => ({ key, label: `${monthShort(ds[0].day)} ’${key.slice(2, 4)}`, days: ds }));
}

/** Trailing 7-day blocks ending yesterday, newest first. */
export function byWeek<T extends { day: string }>(days: T[], limit = 4): Period<T>[] {
  const out: Period<T>[] = [];
  for (let i = 0; i < limit; i++) {
    const ds = lastN(days, 7, i * 7);
    if (ds.length === 0) break;
    const first = ds[0].day;
    const label = new Date(`${first}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    out.push({ key: first, label: `Wk of ${label}`, days: ds });
  }
  return out;
}

/* ------------------------------ health ------------------------------ */

export function assessMarketing(c: Omit<MarketingClient, "health" | "alerts">, now: Date): { health: Health; alerts: string[] } {
  const cur = summarizeMarketing(lastN(c.days, 7), c.avgJobValueCents);
  const prev = summarizeMarketing(lastN(c.days, 7, 7), c.avgJobValueCents);
  const alerts: string[] = [];
  let health: Health = "green";
  const bump = (h: Health) => {
    if (h === "red" || (h === "amber" && health === "green")) health = h;
  };

  const cpl = change(cur.leadCostCents, prev.leadCostCents);
  if (cpl !== null && cpl > 0.35) {
    alerts.push(`Lead cost up ${Math.round(cpl * 100)}% vs prior 7 days`);
    bump("red");
  } else if (cpl !== null && cpl > 0.15) {
    alerts.push(`Lead cost up ${Math.round(cpl * 100)}% vs prior 7 days`);
    bump("amber");
  }
  if (cur.leads === 0 && cur.spendCents > 0) {
    alerts.push("Spend with no leads in 7 days");
    bump("red");
  }
  const leadsChange = change(cur.leads, prev.leads);
  if (leadsChange !== null && leadsChange < -0.3) {
    alerts.push(`Leads down ${Math.round(-leadsChange * 100)}%`);
    bump("amber");
  }
  const p = pacing(c.days.map((d) => ({ day: d.day, value: d.spendCents })), c.monthlyBudgetCents, now);
  const tone = pacingTone(p.pct);
  if (tone !== "green") {
    alerts.push(p.pct > 1 ? `Pacing ${Math.round(p.pct * 100)}% of budget` : `Underspending, pacing ${Math.round(p.pct * 100)}%`);
    bump(tone === "red" ? "red" : "amber");
  }
  return { health, alerts };
}

export function assessFundraising(c: Omit<FundraisingClient, "health" | "alerts">, now: Date): { health: Health; alerts: string[] } {
  const cur = summarizeFundraising(lastN(c.days, 7));
  const prev = summarizeFundraising(lastN(c.days, 7, 7));
  const alerts: string[] = [];
  let health: Health = "green";
  const bump = (h: Health) => {
    if (h === "red" || (h === "amber" && health === "green")) health = h;
  };
  const raised = change(cur.raisedCents, prev.raisedCents);
  if (raised !== null && raised < -0.35) {
    alerts.push(`Raised down ${Math.round(-raised * 100)}% vs prior 7 days`);
    bump("red");
  } else if (raised !== null && raised < -0.15) {
    alerts.push(`Raised down ${Math.round(-raised * 100)}% vs prior 7 days`);
    bump("amber");
  }
  const gift = change(cur.avgGiftCents, prev.avgGiftCents);
  if (gift !== null && gift < -0.25) {
    alerts.push(`Average gift down ${Math.round(-gift * 100)}%`);
    bump("amber");
  }
  const p = pacing(c.days.map((d) => ({ day: d.day, value: d.raisedCents })), c.monthlyGoalCents, now);
  if (p.pct < 0.7) {
    alerts.push(`Behind goal, pacing ${Math.round(p.pct * 100)}%`);
    bump("amber");
  }
  return { health, alerts };
}

export function isMarketing(c: ClientRecord): c is MarketingClient {
  return c.mode === "marketing";
}
