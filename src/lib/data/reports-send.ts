import type { ReportSend } from "@/lib/types";
import { deliverEmail } from "./email";
import { findClient, getReportConfig, sendReportNow } from "./store";

/* The weekly report email: one message per recipient through the email module, then the send is recorded for the board. */

export function sendReport(now: Date, accountId: string): { send: ReportSend; delivered: number } | undefined {
  const cfg = getReportConfig(now, accountId);
  const client = findClient(now, accountId);
  if (!cfg || !client) return undefined;
  const subject = `${client.account.name}: your results, last ${cfg.range} days`;
  let delivered = 0;
  for (const to of cfg.recipients) {
    deliverEmail(now, { accountId, to, subject, kind: "report" });
    delivered += 1;
  }
  const send = sendReportNow(now, accountId);
  return send ? { send, delivered } : undefined;
}
