"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Heading, ImageIcon, Loader2, Minus, MousePointerClick, Plus, Send, Trash2, Type, type LucideIcon } from "lucide-react";
import { Field, Input, Select, Textarea, controlClass } from "@/components/form";
import { Button } from "@/components/page-header";
import { Segmented } from "@/components/diagnostic/primitives";
import type { CampaignDraft, EmailActionState } from "@/app/agency/email/actions";
import type { EmailBlock } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";
import type { AudienceRow, CampaignRow, ContactLite, EmailClientRef } from "./data";
import { mergeTags } from "./model";
import { EmailPreview, StatusTag, relativeWhen } from "./ui";

/*
 * The campaign editor: settings and content on the left, the email as it
 * will land on the right. Everything is one draft in state; Save, Schedule
 * and Send each persist it first, so nothing typed is ever lost.
 */

export interface EditorActions {
  save: (id: string, draft: CampaignDraft) => Promise<EmailActionState>;
  schedule: (id: string, draft: CampaignDraft, whenIso: string | null) => Promise<EmailActionState>;
  send: (id: string, draft: CampaignDraft) => Promise<EmailActionState>;
  remove: (id: string) => Promise<void>;
}

const blockMeta: Record<EmailBlock["type"], { label: string; icon: LucideIcon }> = {
  heading: { label: "Heading", icon: Heading },
  text: { label: "Text", icon: Type },
  button: { label: "Button", icon: MousePointerClick },
  image: { label: "Image", icon: ImageIcon },
  divider: { label: "Divider", icon: Minus },
};

function newBlock(type: EmailBlock["type"]): EmailBlock {
  const id = `b-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  switch (type) {
    case "heading": return { id, type, text: "" };
    case "text": return { id, type, text: "" };
    case "button": return { id, type, text: "Learn more", url: "https://" };
    case "image": return { id, type, alt: "" };
    case "divider": return { id, type };
  }
}

function tomorrowAtNine(now: Date) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Section({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 border-b border-line py-6 last:border-b-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const iconButton = "grid size-7 place-items-center rounded text-fg-3 transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-30";

export function CampaignEditor({
  campaign,
  audienceId: initialAudienceId,
  client,
  audiences,
  contacts,
  nowIso,
  actions,
}: {
  campaign: CampaignRow;
  audienceId?: string;
  client: EmailClientRef;
  audiences: AudienceRow[];
  contacts: ContactLite[];
  nowIso: string;
  actions: EditorActions;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [draft, setDraft] = useState<CampaignDraft>({
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    audienceId: initialAudienceId ?? "",
    blocks: campaign.blocks,
  });
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<EmailActionState>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"save" | "schedule" | "send" | "unschedule" | null>(null);
  const [mode, setMode] = useState<"now" | "later">(campaign.status === "scheduled" ? "later" : "now");
  const [whenLocal, setWhenLocal] = useState(campaign.scheduledFor ? toLocalInput(campaign.scheduledFor) : tomorrowAtNine(now));
  const [confirming, setConfirming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const sendable = contacts.filter((c) => c.email && !c.optedOut);
  const [previewAs, setPreviewAs] = useState(sendable[0]?.id ?? "");
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const e = state?.errors ?? {};

  const audience = audiences.find((a) => a.id === draft.audienceId);
  const person = contacts.find((c) => c.id === previewAs);

  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDirty(true);
    setConfirming(false);
  };
  const setBlock = (id: string, patch: Partial<EmailBlock>) => set("blocks", draft.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EmailBlock) : b)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...draft.blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + by, 0, b!);
    set("blocks", next);
  };

  /** Insert a merge tag at the caret of the last text field touched. */
  const insertTag = (tag: string) => {
    const el = lastField.current;
    if (!el) return;
    const startAt = el.selectionStart ?? el.value.length;
    const endAt = el.selectionEnd ?? el.value.length;
    const value = el.value.slice(0, startAt) + tag + el.value.slice(endAt);
    const key = el.dataset.field!;
    if (key === "subject" || key === "previewText") set(key, value);
    else {
      const [id, prop] = key.split(":");
      setBlock(id!, { [prop!]: value } as Partial<EmailBlock>);
    }
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(startAt + tag.length, startAt + tag.length);
    });
  };
  const track = { onFocus: (ev: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (lastField.current = ev.currentTarget) };

  const run = (kind: NonNullable<typeof busy>, fn: () => Promise<EmailActionState>) => {
    setBusy(kind);
    start(async () => {
      const r = await fn();
      setState(r);
      if (r?.ok) setDirty(false);
      setBusy(null);
      setConfirming(false);
    });
  };

  const scheduledIso = whenLocal ? new Date(whenLocal).toISOString() : null;
  const subjectLeft = 150 - draft.subject.length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 bg-rail px-5 pb-5 pt-6 text-rail-fg md:px-8">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className="truncate">{draft.name || "Untitled campaign"}</span>
            <StatusTag status={campaign.status} />
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-rail-fg-2">
            <Link href="/agency/email" className="text-rail-fg hover:underline">
              Email
            </Link>
            <span aria-hidden>·</span>
            <Link href={`/agency/clients/${client.slug}`} className="hover:underline">
              {client.name}
            </Link>
            <span aria-hidden>·</span>
            <span role="status">{pending && busy === "save" ? "Saving…" : dirty ? "Unsaved changes" : state?.ok && state.message ? state.message : "All changes saved"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={pending || !dirty} onClick={() => run("save", () => actions.save(campaign.id, draft))}>
            {busy === "save" ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : <Check className="size-3.5" strokeWidth={2} />}
            Save draft
          </Button>
        </div>
      </header>

      {state && !state.ok && state.message && (
        <p role="alert" className="mx-5 mt-4 rounded border border-red/25 bg-red-soft/60 px-3 py-2 text-sm text-red md:mx-8">
          {state.message}
        </p>
      )}

      <div className="grid gap-x-10 px-5 md:px-8 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Section
            title="Audience"
            aside={
              <Link href={`/agency/email/audiences?client=${client.slug}`} className="text-xs text-fg-2 hover:text-fg">
                Manage audiences
              </Link>
            }
          >
            <Field label="Send to" htmlFor="audienceId" error={e.audienceId}>
              <Select id="audienceId" value={draft.audienceId} onChange={(ev) => set("audienceId", ev.target.value)} aria-invalid={!!e.audienceId}>
                <option value="">Pick an audience</option>
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCount(a.reach.sendable)})
                  </option>
                ))}
              </Select>
            </Field>
            {audience && (
              <p className="text-sm text-fg-2">
                <span className="num font-semibold text-fg">{formatCount(audience.reach.sendable)}</span> {audience.reach.sendable === 1 ? "person gets" : "people get"} this email.
                {(audience.reach.optedOut > 0 || audience.reach.noEmail > 0) && (
                  <span className="text-fg-3">
                    {" "}
                    Skipped: {[audience.reach.optedOut && `${audience.reach.optedOut} opted out of email`, audience.reach.noEmail && `${audience.reach.noEmail} with no address`].filter(Boolean).join(", ")}.
                  </span>
                )}
                <span className="mt-0.5 block text-xs text-fg-3">{audience.summary}</span>
              </p>
            )}
          </Section>

          <Section title="Sender and subject">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Campaign name" htmlFor="name" hint="Only your team sees this." error={e.name} className="sm:col-span-2">
                <Input id="name" value={draft.name} onChange={(ev) => set("name", ev.target.value)} aria-invalid={!!e.name} />
              </Field>
              <Field label="From name" htmlFor="fromName" error={e.fromName}>
                <Input id="fromName" value={draft.fromName} onChange={(ev) => set("fromName", ev.target.value)} aria-invalid={!!e.fromName} />
              </Field>
              <Field label="From address" htmlFor="fromEmail" error={e.fromEmail}>
                <Input id="fromEmail" type="email" value={draft.fromEmail} onChange={(ev) => set("fromEmail", ev.target.value)} aria-invalid={!!e.fromEmail} />
              </Field>
              <Field label="Subject" htmlFor="subject" error={e.subject} className="sm:col-span-2">
                <Input id="subject" data-field="subject" value={draft.subject} maxLength={150} onChange={(ev) => set("subject", ev.target.value)} {...track} placeholder="What the inbox shows first" aria-invalid={!!e.subject} />
                <span className={cn("num -mt-0.5 self-end text-2xs", subjectLeft < 20 ? "text-amber" : "text-fg-3")}>{draft.subject.length}/150</span>
              </Field>
              <Field label="Preview text" htmlFor="previewText" hint="The grey line after the subject in most inboxes." className="sm:col-span-2">
                <Input id="previewText" data-field="previewText" value={draft.previewText} maxLength={200} onChange={(ev) => set("previewText", ev.target.value)} {...track} />
              </Field>
            </div>
          </Section>

          <Section
            title="Content"
            aside={
              <span className="flex flex-wrap items-center justify-end gap-1 text-xs text-fg-3">
                Insert
                {mergeTags.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => insertTag(t.tag)}
                    className="inline-flex h-6 items-center rounded-[4px] border border-line-strong bg-surface px-1.5 text-2xs font-medium text-fg-2 hover:border-fg-3 hover:text-fg"
                  >
                    {t.label}
                  </button>
                ))}
              </span>
            }
          >
            {e.blocks && <p className="text-xs text-red">{e.blocks}</p>}
            <ol className="flex flex-col rounded border border-line bg-surface">
              {draft.blocks.map((b, i) => {
                const meta = blockMeta[b.type];
                const Icon = meta.icon;
                return (
                  <li key={b.id} className="flex flex-col gap-2 border-b border-line px-3.5 py-3 last:border-b-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-fg-3">
                      <Icon className="size-3.5" strokeWidth={1.75} />
                      {meta.label}
                      <div className="-my-1 ml-auto flex items-center gap-0.5">
                        <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className={iconButton}>
                          <ArrowUp className="size-3.5" strokeWidth={2} />
                        </button>
                        <button type="button" aria-label="Move down" disabled={i === draft.blocks.length - 1} onClick={() => move(i, 1)} className={iconButton}>
                          <ArrowDown className="size-3.5" strokeWidth={2} />
                        </button>
                        <button type="button" aria-label={`Remove ${meta.label.toLowerCase()}`} onClick={() => set("blocks", draft.blocks.filter((x) => x.id !== b.id))} className={cn(iconButton, "hover:text-red")}>
                          <Trash2 className="size-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                    {b.type === "heading" && <Input aria-label="Heading" data-field={`${b.id}:text`} value={b.text} onChange={(ev) => setBlock(b.id, { text: ev.target.value })} {...track} placeholder="Say the one thing" className="font-semibold" />}
                    {b.type === "text" && <Textarea aria-label="Text" data-field={`${b.id}:text`} value={b.text} onChange={(ev) => setBlock(b.id, { text: ev.target.value })} {...track} className="min-h-[84px]" placeholder="Write like you'd talk to one person." />}
                    {b.type === "button" && (
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                        <Input aria-label="Button label" data-field={`${b.id}:text`} value={b.text} onChange={(ev) => setBlock(b.id, { text: ev.target.value })} {...track} />
                        <Input aria-label="Button link" type="url" value={b.url} onChange={(ev) => setBlock(b.id, { url: ev.target.value })} placeholder="https://" />
                      </div>
                    )}
                    {b.type === "image" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input aria-label="Image description" value={b.alt} onChange={(ev) => setBlock(b.id, { alt: ev.target.value })} placeholder="Describe the image" />
                        <Input aria-label="Caption" data-field={`${b.id}:caption`} value={b.caption ?? ""} onChange={(ev) => setBlock(b.id, { caption: ev.target.value })} {...track} placeholder="Caption (optional)" />
                      </div>
                    )}
                    {b.type === "image" && <span className="text-2xs text-fg-3">Image upload arrives with file storage. The description is what screen readers and blocked-image inboxes show.</span>}
                  </li>
                );
              })}
              {draft.blocks.length === 0 && <li className="px-3.5 py-6 text-center text-sm text-fg-3">The email is empty. Add a block below.</li>}
            </ol>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-fg-3">Add</span>
              {(Object.keys(blockMeta) as EmailBlock["type"][]).map((t) => {
                const Icon = blockMeta[t].icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("blocks", [...draft.blocks, newBlock(t)])}
                    className="inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-surface px-2 text-xs font-medium text-fg-2 transition-colors duration-150 hover:border-fg-3 hover:text-fg"
                  >
                    <Plus className="size-3" strokeWidth={2.25} />
                    <Icon className="size-3.5" strokeWidth={1.75} />
                    {blockMeta[t].label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Send">
            {campaign.status === "scheduled" && campaign.scheduledFor && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-brand/25 bg-brand-soft/50 px-3.5 py-2.5 text-sm">
                <span>
                  Scheduled for <span className="num font-medium">{relativeWhen(campaign.scheduledFor, now)}</span>
                </span>
                <button type="button" disabled={pending} onClick={() => run("unschedule", () => actions.schedule(campaign.id, draft, null))} className="text-xs font-medium text-fg-2 hover:text-fg">
                  {busy === "unschedule" ? "Unscheduling…" : "Unschedule"}
                </button>
              </div>
            )}
            <div role="radiogroup" aria-label="When" className="grid gap-2 sm:grid-cols-2">
              {(["now", "later"] as const).map((m) => (
                <label key={m} className={cn("cursor-pointer rounded border px-3.5 py-2.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand", mode === m ? "border-fg bg-surface-2" : "border-line-strong bg-surface hover:border-fg-3")}>
                  <input type="radio" name="when" checked={mode === m} onChange={() => (setMode(m), setConfirming(false))} className="sr-only" />
                  <span className="block text-sm font-medium">{m === "now" ? "Send now" : "Schedule"}</span>
                  <span className="block text-xs text-fg-3">{m === "now" ? "Goes out the moment you confirm." : "Pick a day and time in your clock."}</span>
                </label>
              ))}
            </div>
            {mode === "later" && (
              <Field label="Send at" htmlFor="scheduledFor" error={e.scheduledFor}>
                <input id="scheduledFor" type="datetime-local" value={whenLocal} onChange={(ev) => setWhenLocal(ev.target.value)} className={cn(controlClass, "num max-w-[260px]")} aria-invalid={!!e.scheduledFor} />
              </Field>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {mode === "now" ? (
                confirming ? (
                  <>
                    <Button disabled={pending} onClick={() => run("send", () => actions.send(campaign.id, draft))}>
                      {busy === "send" ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> : <Send className="size-3.5" strokeWidth={2} />}
                      Yes, send to {formatCount(audience?.reach.sendable ?? 0)}
                    </Button>
                    <button type="button" onClick={() => setConfirming(false)} className="text-sm text-fg-2 hover:text-fg">
                      Cancel
                    </button>
                    <span className="text-xs text-fg-3">A sent email can&apos;t be recalled.</span>
                  </>
                ) : (
                  <Button disabled={pending || !audience || audience.reach.sendable === 0} onClick={() => setConfirming(true)}>
                    <Send className="size-3.5" strokeWidth={2} />
                    Send to {formatCount(audience?.reach.sendable ?? 0)} {audience?.reach.sendable === 1 ? "person" : "people"}
                  </Button>
                )
              ) : (
                <Button disabled={pending || !audience || !whenLocal} onClick={() => run("schedule", () => actions.schedule(campaign.id, draft, scheduledIso))}>
                  {busy === "schedule" && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
                  {campaign.status === "scheduled" ? "Update schedule" : "Schedule"}
                </Button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-fg-3">
              Contacts who unsubscribed or are marked do-not-email are always skipped. Each recipient gets the email on their contact timeline. Delivery is simulated until a sending domain is connected.
            </p>
          </Section>

          <div className="flex items-center gap-3 pb-8 pt-2">
            {confirmDelete ? (
              <>
                <span className="text-sm text-fg-2">Delete this {campaign.status === "scheduled" ? "scheduled campaign" : "draft"}?</span>
                <button type="button" onClick={() => start(() => actions.remove(campaign.id))} className="text-sm font-medium text-red hover:underline">
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-sm text-fg-2 hover:text-fg">
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-red">
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                Delete {campaign.status === "scheduled" ? "campaign" : "draft"}
              </button>
            )}
          </div>
        </div>

        <aside className="min-w-0 pb-8 lg:sticky lg:top-0 lg:max-h-screen lg:self-start lg:overflow-y-auto lg:py-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-6 lg:border-t-0 lg:pt-0">
            <h2 className="text-sm font-semibold">Preview</h2>
            <div className="flex items-center gap-2">
              {sendable.length > 0 && (
                <select aria-label="Preview as" value={previewAs} onChange={(ev) => setPreviewAs(ev.target.value)} className="h-7 max-w-[180px] rounded border border-line-strong bg-surface px-2 text-xs text-fg focus:border-brand focus:outline-none">
                  {sendable.slice(0, 30).map((c) => (
                    <option key={c.id} value={c.id}>
                      As {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              )}
              <Segmented
                tone="paper"
                label="Device"
                value={device}
                onChange={setDevice}
                options={[
                  { value: "desktop", label: "Desktop" },
                  { value: "phone", label: "Phone" },
                ]}
              />
            </div>
          </div>
          <EmailPreview {...draft} clientName={client.name} location={client.location} firstName={person?.firstName} lastName={person?.lastName} mobile={device === "phone"} />
        </aside>
      </div>
    </>
  );
}
