import type { ClientRecord, ReportConfig, ReputationSettings } from "@/lib/types";

/* What a new client's review requests and weekly report start as. */

export function defaultReputationSettings(c: ClientRecord): ReputationSettings {
  return {
    accountId: c.account.id,
    autoAfter: { job: c.mode === "marketing", appointment: false, donation: c.mode === "fundraising" },
    channel: c.mode === "marketing" ? "sms" : "email",
    delayHours: c.mode === "marketing" ? 2 : 24,
    googleUrl: "",
    facebookUrl: undefined,
    message: c.mode === "marketing" ? "Hi {first}, thanks for choosing {client}. Would you leave us a quick review? It takes a minute and helps a lot." : "Hi {first}, thank you for your gift to {client}. If you have a minute, a short review helps others trust us too.",
  };
}

export function defaultReportConfig(c: ClientRecord): ReportConfig {
  return {
    accountId: c.account.id,
    enabled: false,
    range: 30,
    sections: c.mode === "marketing" ? ["summary", "performance", "volume", "months", "reviews", "note"] : ["summary", "performance", "volume", "months", "countries", "note"],
    recipients: c.clientMembers.map((m) => m.email),
    weekday: 1,
    hour: 8,
  };
}
