import {
  byMonth,
  byWeek,
  change,
  lastN,
  pacing,
  rollingCost,
  rollingMean,
  summarizeFundraising,
  summarizeMarketing,
  type FundraisingSummary,
  type MarketingSummary,
  type Pacing,
  type Period,
  type RangeDays,
} from "@/lib/diagnostic";
import type { ClientRecord, FundraisingClient, FundraisingDay, MarketingClient, MarketingDay } from "@/lib/types";

/* View models for the board and panel. Pure functions of (client, range, now). */

export interface MarketingRow {
  mode: "marketing";
  client: MarketingClient;
  cur: MarketingSummary;
  prev: MarketingSummary;
  leadCostChange: number | null;
  aptCostChange: number | null;
  leadsChange: number | null;
  pacing: Pacing;
  spark: number[];
  isNew: boolean;
}

export interface FundraisingRow {
  mode: "fundraising";
  client: FundraisingClient;
  cur: FundraisingSummary;
  prev: FundraisingSummary;
  raisedChange: number | null;
  giftChange: number | null;
  donationsChange: number | null;
  pacing: Pacing;
  spark: number[];
  isNew: boolean;
}

export type Row = MarketingRow | FundraisingRow;

const daysSince = (iso: string, now: Date) => Math.round((now.getTime() - new Date(`${iso}T12:00:00`).getTime()) / 86400000);

export function buildRow(c: ClientRecord, range: RangeDays, now: Date): Row {
  const isNew = daysSince(c.startedOn, now) <= 30;
  if (c.mode === "marketing") {
    const cur = summarizeMarketing(lastN(c.days, range), c.avgJobValueCents);
    const prev = summarizeMarketing(lastN(c.days, range, range), c.avgJobValueCents);
    return {
      mode: "marketing",
      client: c,
      cur,
      prev,
      leadCostChange: change(cur.leadCostCents, prev.leadCostCents),
      aptCostChange: change(cur.aptCostCents, prev.aptCostCents),
      leadsChange: change(cur.leads, prev.leads),
      pacing: pacing(c.days.map((d) => ({ day: d.day, value: d.spendCents })), c.monthlyBudgetCents, now),
      spark: lastN(c.days, 30).map((d) => d.leads),
      isNew,
    };
  }
  const cur = summarizeFundraising(lastN(c.days, range));
  const prev = summarizeFundraising(lastN(c.days, range, range));
  return {
    mode: "fundraising",
    client: c,
    cur,
    prev,
    raisedChange: change(cur.raisedCents, prev.raisedCents),
    giftChange: change(cur.avgGiftCents, prev.avgGiftCents),
    donationsChange: change(cur.donations, prev.donations),
    pacing: pacing(c.days.map((d) => ({ day: d.day, value: d.raisedCents })), c.monthlyGoalCents, now),
    spark: lastN(c.days, 30).map((d) => d.raisedCents),
    isNew,
  };
}

/* ------------------------------ panel ------------------------------- */

export interface CostSeries {
  labels: string[];
  a: (number | null)[];
  b: (number | null)[];
}

/** Rolling 7-day lead cost and appointment cost over the last `n` days. */
export function marketingCostSeries(days: MarketingDay[], n: number): CostSeries {
  const window = 7;
  const slice = lastN(days, n + window - 1);
  const lead = rollingCost(slice.map((d) => ({ day: d.day, cost: d.spendCents, count: d.leads })), window);
  const apt = rollingCost(slice.map((d) => ({ day: d.day, cost: d.spendCents, count: d.appointments })), window);
  const start = Math.max(0, slice.length - n);
  return { labels: slice.slice(start).map((d) => d.day), a: lead.slice(start), b: apt.slice(start) };
}

/** Rolling 7-day raised per day and average gift over the last `n` days. */
export function fundraisingSeries(days: FundraisingDay[], n: number): CostSeries {
  const window = 7;
  const slice = lastN(days, n + window - 1);
  const raised = rollingMean(slice.map((d) => d.raisedCents), window);
  const gift = rollingCost(slice.map((d) => ({ day: d.day, cost: d.raisedCents, count: d.donations })), window);
  const start = Math.max(0, slice.length - n);
  return { labels: slice.slice(start).map((d) => d.day), a: raised.slice(start), b: gift.slice(start) };
}

export interface TrendPair {
  label: string;
  before: number | null;
  after: number | null;
}

export function trendPairs(days: MarketingDay[], avgJob: number): { leadCost: TrendPair[]; aptCost: TrendPair[] } {
  const pair = (n: number) => ({
    cur: summarizeMarketing(lastN(days, n), avgJob),
    prev: summarizeMarketing(lastN(days, n, n), avgJob),
  });
  const w = pair(7);
  const m = pair(30);
  return {
    leadCost: [
      { label: "7D", before: w.prev.leadCostCents, after: w.cur.leadCostCents },
      { label: "30D", before: m.prev.leadCostCents, after: m.cur.leadCostCents },
    ],
    aptCost: [
      { label: "7D", before: w.prev.aptCostCents, after: w.cur.aptCostCents },
      { label: "30D", before: m.prev.aptCostCents, after: m.cur.aptCostCents },
    ],
  };
}

export function fundraisingTrendPairs(days: FundraisingDay[]): { raised: TrendPair[]; gift: TrendPair[] } {
  const pair = (n: number) => ({ cur: summarizeFundraising(lastN(days, n)), prev: summarizeFundraising(lastN(days, n, n)) });
  const w = pair(7);
  const m = pair(30);
  return {
    raised: [
      { label: "7D", before: w.prev.raisedCents, after: w.cur.raisedCents },
      { label: "30D", before: m.prev.raisedCents, after: m.cur.raisedCents },
    ],
    gift: [
      { label: "7D", before: w.prev.avgGiftCents, after: w.cur.avgGiftCents },
      { label: "30D", before: m.prev.avgGiftCents, after: m.cur.avgGiftCents },
    ],
  };
}

export function periods<T extends { day: string }>(days: T[], by: "month" | "week"): Period<T>[] {
  return by === "month" ? byMonth(days, 3) : byWeek(days, 4);
}
