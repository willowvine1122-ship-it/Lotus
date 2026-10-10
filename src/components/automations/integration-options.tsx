"use client";

import { createContext, useContext, useMemo } from "react";
import type { Pipeline } from "@/lib/types";
import type { NameLookup } from "./model";

/*
 * What the client has wired up outside automations (connected apps,
 * webhooks, forms), handed to the builder once so the trigger and step
 * editors can offer them without threading props through every node.
 */

export interface IntegrationOptions {
  connectedApps: string[];
  hooksIn: { id: string; name: string }[];
  hooksOut: { id: string; name: string; url: string }[];
  forms: { id: string; name: string }[];
  /** The client's pipelines, for opportunity triggers. */
  pipelines?: Pipeline[];
}

const empty: IntegrationOptions = { connectedApps: [], hooksIn: [], hooksOut: [], forms: [] };
const Ctx = createContext<IntegrationOptions | null>(null);

export function IntegrationOptionsProvider({ value, children }: { value: IntegrationOptions; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIntegrationOptions(): IntegrationOptions {
  return useContext(Ctx) ?? empty;
}

/** Name lookups for summaries; undefined outside a provider so summaries stay generic. */
export function useNames(): NameLookup {
  const o = useContext(Ctx);
  return useMemo(() => {
    if (!o) return {};
    const hooks = new Map([...o.hooksIn, ...o.hooksOut].map((h) => [h.id, h.name]));
    const forms = new Map(o.forms.map((f) => [f.id, f.name]));
    const pipelines = new Map((o.pipelines ?? []).map((p) => [p.id, p]));
    return { hook: (id: string) => hooks.get(id), form: (id: string) => forms.get(id), pipeline: (id: string) => pipelines.get(id) };
  }, [o]);
}
