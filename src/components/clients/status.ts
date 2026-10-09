import type { ClientStatus } from "@/lib/types";

export const statusLabel: Record<ClientStatus, string> = { onboarding: "Onboarding", active: "Active", paused: "Paused" };
export const statusTone: Record<ClientStatus, "brand" | "neutral" | "amber"> = { onboarding: "neutral", active: "neutral", paused: "neutral" };
