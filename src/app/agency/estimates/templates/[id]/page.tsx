import { openWorkspace } from "@/lib/server/workspace";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { TemplateForm } from "@/components/estimates/template-form";
import { fieldClientRefs, priceBooks, resolveClient } from "@/components/field/data";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { DEFAULT_TERMS, findTemplate } from "@/lib/data/estimate-kit";
import { deleteTemplateAction, saveTemplateAction } from "../../kit-actions";

export const metadata = { title: "Estimate template" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ client?: string }> };

async function Editor({ params, searchParams }: Props) {
  const [{ id }, { client }] = await Promise.all([params, searchParams]);
  await connection();
  await openWorkspace();
  const now = new Date();
  const clients = fieldClientRefs(now);
  const template = id === "new" ? undefined : findTemplate(now, id);
  if (id !== "new" && !template) notFound();
  const c = template ? clients.find((x) => x.id === template.accountId) : (resolveClient(clients, client) ?? clients[0]);
  if (!c) notFound();
  const books = priceBooks(now, [c], "item");
  const addOnBooks = priceBooks(now, [c], "addon");
  return (
    <>
      <PageHeader
        title={template ? template.name : "New template"}
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/agency/estimates/library?client=${c.id}&tab=templates`} className="inline-flex items-center gap-1 text-rail-fg hover:underline">
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Templates
            </Link>
            <span aria-hidden>·</span>
            <span>{c.name}</span>
            {template && (
              <>
                <span aria-hidden>·</span>
                <span className="num">Used {template.uses} times</span>
              </>
            )}
          </span>
        }
      />
      <div className="bg-surface">
        <TemplateForm
          action={saveTemplateAction.bind(null, template?.id ?? null)}
          remove={template ? deleteTemplateAction.bind(null, template.id, c.id) : undefined}
          client={{ id: c.id, name: c.name, taxRateBps: c.taxRateBps }}
          template={template}
          book={books[c.id] ?? []}
          addOnBook={addOnBooks[c.id] ?? []}
          defaultTerms={DEFAULT_TERMS}
        />
      </div>
    </>
  );
}

export default function TemplatePage(props: Props) {
  return (
    <Shell current="/agency/estimates">
      <Suspense fallback={<div className="h-14 bg-rail" />}>
        <Editor {...props} />
      </Suspense>
    </Shell>
  );
}
