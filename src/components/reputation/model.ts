import type { Review, ReviewRequest, ReviewRequestChannel, ReviewRequestTrigger, ReviewSource } from "@/lib/types";

/* Shared helpers for the reputation screens. Plain module. */

export interface ClientRef {
  id: string;
  name: string;
  slug: string;
  mode: "marketing" | "fundraising";
}

export const sourceLabel: Record<ReviewSource, string> = { google: "Google", facebook: "Facebook" };
export const channelLabel: Record<ReviewRequestChannel, string> = { sms: "Text", email: "Email" };
export const triggerLabel: Record<ReviewRequestTrigger, string> = { job: "After job", appointment: "After appointment", donation: "After gift", manual: "Sent by hand" };
export const requestStatusLabel: Record<ReviewRequest["status"], string> = { sent: "Sent", opened: "Opened", reviewed: "Reviewed" };

export function averageRating(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
}

export function daysBetween(iso: string, now: Date) {
  return (now.getTime() - new Date(iso).getTime()) / 86400000;
}

/** Reviews in the last `n` days and the `n` before that. */
export function windowed(reviews: Review[], now: Date, n: number) {
  const cur = reviews.filter((r) => daysBetween(r.at, now) < n);
  const prev = reviews.filter((r) => {
    const d = daysBetween(r.at, now);
    return d >= n && d < 2 * n;
  });
  return { cur, prev };
}

/** Average rating per trailing week, oldest first, for the trend chart. */
export function weeklyRating(reviews: Review[], now: Date, weeks = 12): { label: string; avg: number | null; count: number }[] {
  const out: { label: string; avg: number | null; count: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7 + 1);
    const start = new Date(end.getTime() - 7 * 86400000);
    const inWeek = reviews.filter((r) => {
      const t = new Date(r.at).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    out.push({ label: start.toISOString().slice(0, 10), avg: averageRating(inWeek), count: inWeek.length });
  }
  return out;
}

/** Cumulative average per week, so sparse weeks do not whipsaw the line. */
export function rollingRating(reviews: Review[], now: Date, weeks = 12): { label: string; avg: number | null }[] {
  const out: { label: string; avg: number | null }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7 + 1);
    const start = new Date(end.getTime() - 90 * 86400000);
    const inWindow = reviews.filter((r) => {
      const t = new Date(r.at).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    out.push({ label: new Date(end.getTime() - 86400000).toISOString().slice(0, 10), avg: averageRating(inWindow) });
  }
  return out;
}

export function distribution(reviews: Review[]): { stars: 5 | 4 | 3 | 2 | 1; count: number }[] {
  return ([5, 4, 3, 2, 1] as const).map((stars) => ({ stars, count: reviews.filter((r) => r.rating === stars).length }));
}

export function fillTemplate(message: string, first: string, client: string) {
  return message.replace(/\{first\}/g, first).replace(/\{client\}/g, client);
}
