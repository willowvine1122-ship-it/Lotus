import type {
  Opportunity,
  OpportunityStatus,
  Pipeline,
  PipelineStage,
} from "@/lib/types";

/* Shared, framework-free helpers for the opportunity screens. */

export interface ContactRef {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
}

export const statusLabel: Record<OpportunityStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  abandoned: "Abandoned",
};

const DAY = 86400000;

export function daysIn(o: Opportunity, now: Date) {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(o.stageEnteredAt).getTime()) / DAY),
  );
}

/**
 * Health of an open opportunity by time in its stage: amber past the
 * pipeline's limit, red at twice it. Closed ones have no health.
 */
export function staleTone(
  o: Opportunity,
  p: Pipeline | undefined,
  now: Date,
): "red" | "amber" | null {
  if (o.status !== "open") return null;
  const limit = p?.staleDays ?? 14;
  const d = daysIn(o, now);
  return d >= limit * 2 ? "red" : d >= limit ? "amber" : null;
}

export function stageFor(p: Pipeline | undefined, id: string): PipelineStage {
  return p?.stages.find((s) => s.id === id) ?? { id, name: "Removed stage" };
}

export function probabilityOf(p: Pipeline | undefined, o: Opportunity) {
  if (o.status === "won") return 100;
  if (o.status !== "open") return 0;
  return stageFor(p, o.stageId).probability ?? 0;
}

export function weighted(p: Pipeline | undefined, os: Opportunity[]) {
  return os.reduce((a, o) => a + (o.valueCents * probabilityOf(p, o)) / 100, 0);
}

export function sumValue(os: Opportunity[]) {
  return os.reduce((a, o) => a + o.valueCents, 0);
}

export function daysBetween(a: string, b: string) {
  return Math.max(
    0,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY),
  );
}

/** Win rate over opportunities closed in the window: won / (won + lost). Abandoned do not count against it. */
export function winRate(os: Opportunity[], now: Date, days = 90) {
  const since = new Date(now.getTime() - days * DAY).toISOString();
  const closed = os.filter(
    (o) =>
      (o.status === "won" || o.status === "lost") &&
      (o.closedAt ?? "") >= since,
  );
  const won = closed.filter((o) => o.status === "won");
  return {
    rate: closed.length ? won.length / closed.length : null,
    won: won.length,
    closed: closed.length,
    avgDays: won.length
      ? Math.round(
          won.reduce(
            (a, o) => a + daysBetween(o.createdAt, o.closedAt ?? o.updatedAt),
            0,
          ) / won.length,
        )
      : null,
  };
}

/** Time spent in each stage, from the history, for one opportunity. */
export function stageDurations(o: Opportunity, now: Date): Map<string, number> {
  const out = new Map<string, number>();
  const moves = o.history.filter((e) => e.stageId);
  moves.forEach((e, i) => {
    const end =
      moves[i + 1]?.at ??
      (o.status === "open" || o.status === "abandoned"
        ? now.toISOString()
        : (o.closedAt ?? now.toISOString()));
    out.set(
      e.stageId!,
      (out.get(e.stageId!) ?? 0) +
        (new Date(end).getTime() - new Date(e.at).getTime()) / DAY,
    );
  });
  return out;
}

export function csvEscape(v: string | number | undefined) {
  const s = v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
