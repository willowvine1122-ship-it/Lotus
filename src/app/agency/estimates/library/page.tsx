import { Suspense } from "react";
import { connection } from "next/server";
import { EstimateLibrary } from "@/components/estimates/library";
import { fieldClientRefs, resolveClient } from "@/components/field/data";
import { Shell } from "@/components/shell";
import { listPriceBook, listTemplates } from "@/lib/data/estimate-kit";
import { deletePriceItemAction, savePriceItemAction } from "../kit-actions";

export const metadata = { title: "Price book and templates" };

const actions = { saveItem: savePriceItemAction, deleteItem: deletePriceItemAction };

async function Library({ searchParams }: { searchParams: Promise<{ client?: string; tab?: string }> }) {
  const { client, tab } = await searchParams;
  await connection();
  const now = new Date();
  const clients = fieldClientRefs(now);
  const c = resolveClient(clients, client) ?? clients[0];
  if (!c) return <p className="px-6 py-12 text-sm text-fg-3">No clients run field service yet.</p>;
  return (
    <EstimateLibrary
      key={c.id}
      clients={clients.map((x) => ({ id: x.id, name: x.name, slug: x.slug, taxRateBps: x.taxRateBps }))}
      clientId={c.id}
      items={listPriceBook(now, c.id)}
      templates={listTemplates(now, c.id).map((t) => ({ id: t.id, name: t.name, title: t.title, options: t.options, addOns: t.addOns, depositPct: t.depositPct, validDays: t.validDays, uses: t.uses, updatedAt: t.updatedAt }))}
      tab={tab === "templates" ? "templates" : "book"}
      nowIso={now.toISOString()}
      actions={actions}
    />
  );
}

export default function EstimateLibraryPage({ searchParams }: { searchParams: Promise<{ client?: string; tab?: string }> }) {
  return (
    <Shell current="/agency/estimates">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
