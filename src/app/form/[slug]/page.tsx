import { openPublicWorkspace } from "@/lib/server/workspace";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { FormRunner, FormUnavailable } from "@/components/forms/runner";
import { formThemes } from "@/components/forms/model";
import { findFormBySlug } from "@/lib/data/forms";
import { findClient } from "@/lib/data/store";
import { startFormAction, submitFormAction, trackFormAction } from "@/app/agency/forms/actions";

/* Public forms: /form/<slug>. Hidden fields come from the query string (?utm_source=…). */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  if (!(await openPublicWorkspace(`form:${slug}`))) return { title: "Form not found" };
  const form = findFormBySlug(new Date(), slug);
  if (!form) return { title: "Form not found" };
  const client = findClient(new Date(), form.accountId);
  return {
    title: form.welcome.enabled && form.welcome.title ? form.welcome.title : form.name,
    description: form.welcome.body || `A short form from ${client?.account.name ?? "us"}.`,
    robots: { index: false },
  };
}


async function Page({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  await connection();
  if (!(await openPublicWorkspace(`form:${slug}`))) notFound();
  const now = new Date();
  const form = findFormBySlug(now, slug);
  if (!form) notFound();
  const brand = findClient(now, form.accountId)?.account.name;
  if (form.status !== "live") {
    return form.status === "closed" ? (
      <FormUnavailable theme={form.theme} brand={brand} title="This form is closed" body="It's no longer taking responses. Thanks for stopping by." />
    ) : (
      <FormUnavailable theme={form.theme} brand={brand} title="This form isn't open yet" body="Check back soon." />
    );
  }
  const hidden: Record<string, string> = {};
  for (const key of form.hiddenFields) {
    const v = sp[key];
    if (typeof v === "string") hidden[key] = v.slice(0, 200);
  }
  const embed = sp.embed === "1";
  return (
    <div className="h-dvh">
      <FormRunner
        form={{ id: form.id, slug: form.slug, name: form.name, welcome: form.welcome, questions: form.questions, endings: form.endings, theme: form.theme, scoring: form.scoring, hiddenFields: form.hiddenFields }}
        brand={embed ? undefined : brand}
        mode="live"
        hidden={hidden}
        actions={{ start: startFormAction, track: trackFormAction.bind(null, slug), submit: submitFormAction }}
      />
    </div>
  );
}

export default function PublicFormPage(props: Props) {
  return (
    <Suspense fallback={<div className="h-dvh" style={{ backgroundColor: formThemes.paper.bg }} />}>
      <Page {...props} />
    </Suspense>
  );
}
