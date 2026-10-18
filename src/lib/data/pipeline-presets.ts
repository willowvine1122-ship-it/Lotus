import type { ClientRecord, Pipeline, PipelineStage } from "@/lib/types";

/* The stages a new client's first pipeline starts with, by mode. Editable per client in Opportunities. */

export const marketingStages: PipelineStage[] = [
  { id: "new", name: "New lead" },
  { id: "contacted", name: "Contacted" },
  { id: "booked", name: "Booked" },
  { id: "showed", name: "Showed" },
  { id: "won", name: "Won", outcome: "won" },
  { id: "lost", name: "Lost", outcome: "lost" },
];

export const fundraisingStages: PipelineStage[] = [
  { id: "prospect", name: "Prospect" },
  { id: "first", name: "First gift" },
  { id: "repeat", name: "Repeat donor" },
  { id: "monthly", name: "Monthly donor", outcome: "won" },
  { id: "lapsed", name: "Lapsed", outcome: "lost" },
];

export function pipelineFor(c: ClientRecord): Pipeline {
  return c.mode === "marketing"
    ? { id: `${c.account.id}-pipeline`, accountId: c.account.id, name: "Leads", stages: marketingStages }
    : { id: `${c.account.id}-pipeline`, accountId: c.account.id, name: "Donors", stages: fundraisingStages };
}
