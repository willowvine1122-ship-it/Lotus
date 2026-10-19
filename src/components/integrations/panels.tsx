"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  Download,
  Plus,
  Send,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Field, Input } from "@/components/form";
import { SectionTitle, Tag } from "@/components/diagnostic/primitives";
import type {
  ApiKey,
  IncomingWebhook,
  IntegrationConnection,
  IntegrationLog,
  OutgoingWebhook,
} from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import {
  connectAppAction,
  createHookInAction,
  createHookOutAction,
  createKeyAction,
  deleteHookInAction,
  deleteHookOutAction,
  disconnectAppAction,
  importAction,
  revokeKeyAction,
  testEventAction,
  testHookInAction,
  testHookOutAction,
  updateHookInAction,
  updateHookOutAction,
  type IntegrationResult,
} from "@/app/agency/integrations/actions";
import {
  contactFieldLabel,
  guessKeys,
  logKindLabel,
  type AppDef,
  type ContactFieldKey,
} from "./catalog";
import {
  AppMark,
  CodeBlock,
  CopyField,
  LogStatus,
  Notice,
  dangerButton,
  inkButton,
  smallButton,
} from "./ui";

/*
 * Right-hand panels of the integrations hub: one per thing you can select
 * (an app, a webhook, a key, a log line) plus the two "new" forms.
 */

export interface PanelCtx {
  clientId: string;
  clientName: string;
  origin: string;
  now: Date;
  logs: IntegrationLog[];
  contacts: Record<string, string>;
  usage: Record<string, string[]>;
  onClose?: () => void;
}

function PanelHeader({
  title,
  sub,
  mark,
  tags,
  onClose,
  children,
}: {
  title: string;
  sub?: React.ReactNode;
  mark?: React.ReactNode;
  tags?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-line bg-surface px-5 pb-4 pt-4">
      <div className="flex items-start gap-3">
        {mark}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-6 tracking-tight">
            {title}
          </h2>
          {sub && <p className="truncate text-xs text-fg-3">{sub}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            title="Close (Esc)"
            className="grid size-7 shrink-0 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        )}
      </div>
      {tags && (
        <div className="flex flex-wrap items-center gap-1.5">{tags}</div>
      )}
      {children}
    </header>
  );
}

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<IntegrationResult | null>(null);
  const run = (
    fn: () => Promise<IntegrationResult>,
    after?: (r: IntegrationResult) => void,
  ) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      after?.(r);
    });
  return { pending, result, setResult, run };
}

/** The newest log lines for one app, hook or key. */
function RecentLog({
  ctx,
  entries,
  empty,
}: {
  ctx: PanelCtx;
  entries: IntegrationLog[];
  empty: string;
}) {
  if (!entries.length) return <p className="text-xs text-fg-3">{empty}</p>;
  return (
    <ol className="flex flex-col">
      {entries.slice(0, 8).map((l) => (
        <li key={l.id} className="border-b border-line py-2.5 last:border-b-0">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {l.title}
            </span>
            <LogStatus log={l} />
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-2">{l.detail}</p>
          <p className="num mt-0.5 text-2xs text-fg-3">
            {timeAgo(l.at, ctx.now)}
            {l.contactId && ctx.contacts[l.contactId] && (
              <>
                {" · "}
                <Link
                  href={`/agency/contacts/${l.contactId}`}
                  className="text-fg-2 hover:underline"
                >
                  {ctx.contacts[l.contactId]}
                </Link>
              </>
            )}
          </p>
          {l.payload && (
            <details className="group mt-1.5">
              <summary className="cursor-pointer list-none text-2xs font-medium text-fg-3 hover:text-fg [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show payload</span>
                <span className="hidden group-open:inline">Hide payload</span>
              </summary>
              <pre className="num mt-1.5 max-h-56 overflow-auto rounded border border-line bg-surface-2/60 px-3 py-2 text-[11.5px] leading-[1.55] text-fg-2">
                {l.payload}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}

function UsedBy({ names, noun }: { names?: string[]; noun: string }) {
  if (!names?.length)
    return (
      <p className="text-xs text-fg-3">No workflow uses this {noun} yet.</p>
    );
  return (
    <p className="text-xs leading-relaxed text-fg-2">
      Used by{" "}
      {names.length === 1 ? "the workflow" : `${names.length} workflows:`}{" "}
      <span className="font-medium text-fg">{names.join(", ")}</span>.
    </p>
  );
}

/* --------------------------------- app --------------------------------- */

export function AppPanel({
  app,
  connection,
  ctx,
}: {
  app: AppDef;
  connection?: IntegrationConnection;
  ctx: PanelCtx;
}) {
  const [label, setLabel] = useState("");
  const [confirm, setConfirm] = useState(false);
  const { pending, result, setResult, run } = useAction();
  const entries = ctx.logs.filter((l) => l.ref === app.id);
  const connected = !!connection;

  return (
    <div className="flex flex-col">
      <PanelHeader
        title={app.name}
        sub={`${app.category} · ${ctx.clientName}`}
        mark={<AppMark appId={app.id} size="lg" />}
        onClose={ctx.onClose}
        tags={
          connected ? (
            <Tag tone="neutral">Connected</Tag>
          ) : (
            <span className="inline-flex h-5 items-center rounded-[4px] border border-dashed border-line-strong px-1.5 text-2xs font-medium text-fg-3">
              Not connected
            </span>
          )
        }
      >
        {connected && (
          <p className="text-xs text-fg-2">
            Signed in as{" "}
            <span className="font-medium text-fg">
              {connection.accountLabel}
            </span>{" "}
            · by {connection.connectedBy}{" "}
            {timeAgo(connection.connectedAt, ctx.now)}
          </p>
        )}
      </PanelHeader>

      <div className="flex flex-col gap-6 px-5 py-5">
        <p className="max-w-[60ch] text-sm leading-relaxed text-fg-2">
          {app.blurb}
        </p>

        {!connected && (
          <form
            className="flex flex-col gap-3 rounded border border-line bg-surface-2/40 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                connectAppAction({
                  accountId: ctx.clientId,
                  appId: app.id,
                  accountLabel: label,
                }),
              );
            }}
          >
            <SectionTitle
              sub={`The ${app.name} account Lotus uses for ${ctx.clientName}.`}
            >
              Connect {app.name}
            </SectionTitle>
            <Field label={app.accountPrompt} htmlFor={`acct-${app.id}`}>
              <Input
                id={`acct-${app.id}`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={app.accountPlaceholder}
                maxLength={120}
              />
            </Field>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={pending} className={inkButton}>
                <Zap className="size-3.5" strokeWidth={1.75} />
                {pending ? "Connecting…" : `Connect ${app.name}`}
              </button>
            </div>
            <p className="text-2xs leading-relaxed text-fg-3">
              Sign-in with {app.name} switches on once Lotus is registered with
              them. Until then the connection runs in demo mode: events you send
              as tests are real, and actions are recorded here instead of
              delivered.
            </p>
          </form>
        )}

        <Notice result={result} />

        {app.triggers.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle sub="Pick these as the trigger of a workflow.">
              Starts a workflow when
            </SectionTitle>
            <ul className="flex flex-col">
              {app.triggers.map((t) => (
                <li
                  key={t.key}
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-fg-3">{t.summary}</div>
                  </div>
                  {connected && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          testEventAction({
                            accountId: ctx.clientId,
                            event: `${app.id}.${t.key}`,
                          }),
                        )
                      }
                      className={smallButton}
                    >
                      <Send className="size-3.5" strokeWidth={1.75} />
                      Send a test
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {app.actions.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle sub="Add these as steps in any workflow.">
              Workflow steps
            </SectionTitle>
            <ul className="flex flex-col">
              {app.actions.map((a) => (
                <li
                  key={a.key}
                  className="border-b border-line py-2.5 last:border-b-0"
                >
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="text-xs text-fg-3">
                    {a.fields.map((f) => f.label).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/agency/automations/new?client=${ctx.clientId}`}
            className={smallButton}
          >
            <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
            Use in a workflow
          </Link>
          {connected && app.importLabel && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  importAction({ accountId: ctx.clientId, appId: app.id }),
                )
              }
              className={smallButton}
            >
              <Download className="size-3.5" strokeWidth={1.75} />
              {app.importLabel}
            </button>
          )}
        </div>

        {connected && (
          <section className="flex flex-col gap-2">
            <SectionTitle sub="Last 30 days">Activity</SectionTitle>
            <RecentLog
              ctx={ctx}
              entries={entries}
              empty={`Nothing has come in from or gone out to ${app.name} yet.`}
            />
          </section>
        )}

        {connected && (
          <section className="flex flex-col gap-2 border-t border-line pt-5">
            <UsedBy names={ctx.usage[app.id]} noun="app" />
            {confirm ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-fg-2">
                  {ctx.usage[app.id]?.length
                    ? "Those workflows will fail at this step."
                    : "Disconnect?"}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        disconnectAppAction({
                          accountId: ctx.clientId,
                          appId: app.id,
                        }),
                      () => {
                        setConfirm(false);
                        setResult(null);
                      },
                    )
                  }
                  className={cn(dangerButton, "border-red/40 text-red")}
                >
                  Disconnect {app.name}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="text-xs font-medium text-fg-3 hover:text-fg"
                >
                  Keep it
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className={cn(dangerButton, "self-start")}
              >
                Disconnect
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- incoming webhook --------------------------- */

const fieldKeys = Object.keys(contactFieldLabel) as ContactFieldKey[];

export function HookInPanel({
  hook,
  ctx,
  onDeleted,
}: {
  hook: IncomingWebhook;
  ctx: PanelCtx;
  onDeleted: () => void;
}) {
  const url = `${ctx.origin}/api/hooks/${hook.token}`;
  const [name, setName] = useState(hook.name);
  const [tags, setTags] = useState(hook.tags.join(", "));
  const [mapping, setMapping] = useState<Record<string, string>>({
    ...hook.mapping,
  });
  const [confirm, setConfirm] = useState(false);
  const { pending, result, run } = useAction();
  const dirty =
    name !== hook.name ||
    tags !== hook.tags.join(", ") ||
    fieldKeys.some((k) => (mapping[k] ?? "") !== (hook.mapping[k] ?? ""));
  const entries = ctx.logs.filter((l) => l.ref === hook.id);
  const curl = `curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '{"first_name":"Dana","last_name":"Whitfield","email":"dana@example.com","phone":"+1 555 010 2233"}'`;

  return (
    <div className="flex flex-col">
      <PanelHeader
        title={hook.name}
        sub={`Incoming webhook · ${ctx.clientName}`}
        onClose={ctx.onClose}
        tags={<Tag tone="neutral">Receiving</Tag>}
      >
        <CopyField value={url} label="webhook URL" />
      </PanelHeader>
      <div className="flex flex-col gap-6 px-5 py-5">
        <section className="flex flex-col gap-2">
          <SectionTitle sub="Paste the URL into any tool that can send a webhook: a website form, Typeform, Jotform, Zapier, another CRM.">
            How it works
          </SectionTitle>
          <p className="text-xs leading-relaxed text-fg-2">
            Each POST (JSON or form data) creates the contact, or fills in the
            one with the same email or phone, logs it on their timeline, and
            starts every workflow set to “Webhook received”.
          </p>
          <CodeBlock code={curl} label="curl example" />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => testHookInAction({ id: hook.id }))}
              className={smallButton}
            >
              <Send className="size-3.5" strokeWidth={1.75} />
              Send a test
            </button>
            <Link
              href={`/agency/automations/new?client=${ctx.clientId}`}
              className={smallButton}
            >
              <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
              Start a workflow from it
            </Link>
          </div>
          <Notice result={result} />
        </section>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              updateHookInAction({
                id: hook.id,
                name,
                tags: tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                mapping,
              }),
            );
          }}
        >
          <SectionTitle sub="Leave a field empty and Lotus looks for the usual names. Use dots for nested keys: contact.email.">
            Fields
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {fieldKeys.map((k) => (
              <Field
                key={k}
                label={contactFieldLabel[k]}
                htmlFor={`${hook.id}-${k}`}
              >
                <Input
                  id={`${hook.id}-${k}`}
                  value={mapping[k] ?? ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [k]: e.target.value })
                  }
                  placeholder={guessKeys[k][0]}
                  className="num"
                  maxLength={80}
                />
              </Field>
            ))}
          </div>
          <Field label="Name" htmlFor={`${hook.id}-name`}>
            <Input
              id={`${hook.id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field
            label="Tags to add"
            htmlFor={`${hook.id}-tags`}
            hint="Comma-separated. Added to every contact this webhook touches."
          >
            <Input
              id={`${hook.id}-tags`}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={300}
            />
          </Field>
          {dirty && (
            <button
              type="submit"
              disabled={pending}
              className={cn(inkButton, "self-start")}
            >
              Save changes
            </button>
          )}
        </form>

        <section className="flex flex-col gap-2">
          <SectionTitle sub="Last 30 days">Received</SectionTitle>
          <RecentLog
            ctx={ctx}
            entries={entries}
            empty="Nothing has been posted yet. Send a test to see one arrive."
          />
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-5">
          <UsedBy names={ctx.usage[hook.id]} noun="webhook" />
          {confirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-2">
                Anything still posting here will get a 404.
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => deleteHookInAction({ id: hook.id }), onDeleted)
                }
                className={cn(dangerButton, "border-red/40 text-red")}
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                Delete webhook
              </button>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="text-xs font-medium text-fg-3 hover:text-fg"
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className={cn(dangerButton, "self-start")}
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Delete
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------------------- outgoing webhook --------------------------- */

export function HookOutPanel({
  hook,
  ctx,
  onDeleted,
}: {
  hook: OutgoingWebhook;
  ctx: PanelCtx;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(hook.name);
  const [url, setUrl] = useState(hook.url);
  const [confirm, setConfirm] = useState(false);
  const { pending, result, run } = useAction();
  const dirty = name !== hook.name || url !== hook.url;
  const entries = ctx.logs.filter((l) => l.ref === hook.id);
  const verify = `// Node: check the X-Lotus-Signature header
const [t, v1] = header.split(",").map((p) => p.split("=")[1]);
const expected = crypto.createHmac("sha256", SECRET)
  .update(\`\${t}.\${rawBody}\`).digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));`;

  return (
    <div className="flex flex-col">
      <PanelHeader
        title={hook.name}
        sub={`Outgoing webhook · ${ctx.clientName}`}
        onClose={ctx.onClose}
        tags={<Tag tone="neutral">Sending</Tag>}
      >
        <p className="num truncate text-xs text-fg-2">POST {hook.url}</p>
      </PanelHeader>
      <div className="flex flex-col gap-6 px-5 py-5">
        <section className="flex flex-col gap-2">
          <SectionTitle sub="Add a “Send to a webhook” step to any workflow.">
            How it works
          </SectionTitle>
          <p className="text-xs leading-relaxed text-fg-2">
            Lotus posts the contact as JSON (name, email, phone, tags, stage,
            value and the client) the moment the step runs. Each request is
            signed with the secret below so the receiver can check it came from
            Lotus.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => testHookOutAction({ id: hook.id }))}
              className={smallButton}
            >
              <Send className="size-3.5" strokeWidth={1.75} />
              {pending ? "Sending…" : "Send a test"}
            </button>
            <Link
              href={`/agency/automations?client=${ctx.clientId}`}
              className={smallButton}
            >
              <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
              Open workflows
            </Link>
          </div>
          <Notice result={result} />
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle sub="Sent as X-Lotus-Signature: t=…,v1=HMAC-SHA256(secret, t.body)">
            Signing secret
          </SectionTitle>
          <CopyField value={hook.secret} label="signing secret" secret />
          <CodeBlock code={verify} label="verification example" />
        </section>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateHookOutAction({ id: hook.id, name, url }));
          }}
        >
          <SectionTitle>Settings</SectionTitle>
          <Field
            label="Name"
            htmlFor={`${hook.id}-name`}
            error={result?.errors?.name}
          >
            <Input
              id={`${hook.id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field
            label="URL"
            htmlFor={`${hook.id}-url`}
            error={result?.errors?.url}
          >
            <Input
              id={`${hook.id}-url`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="num"
              maxLength={500}
              inputMode="url"
            />
          </Field>
          {dirty && (
            <button
              type="submit"
              disabled={pending}
              className={cn(inkButton, "self-start")}
            >
              Save changes
            </button>
          )}
        </form>

        <section className="flex flex-col gap-2">
          <SectionTitle sub="Last 30 days, with the receiver's response">
            Deliveries
          </SectionTitle>
          <RecentLog
            ctx={ctx}
            entries={entries}
            empty="Nothing sent yet. Send a test to check the receiver answers."
          />
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-5">
          <UsedBy names={ctx.usage[hook.id]} noun="webhook" />
          {confirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-2">
                {ctx.usage[hook.id]?.length
                  ? "Those workflows will fail at this step."
                  : "Delete it?"}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => deleteHookOutAction({ id: hook.id }), onDeleted)
                }
                className={cn(dangerButton, "border-red/40 text-red")}
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                Delete webhook
              </button>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="text-xs font-medium text-fg-3 hover:text-fg"
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className={cn(dangerButton, "self-start")}
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Delete
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ new webhook ------------------------------ */

export function NewHookPanel({
  ctx,
  onCreated,
}: {
  ctx: PanelCtx;
  onCreated: (id: string) => void;
}) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const { pending, result, run } = useAction();
  return (
    <div className="flex flex-col">
      <PanelHeader
        title="New webhook"
        sub={ctx.clientName}
        onClose={ctx.onClose}
      />
      <form
        className="flex flex-col gap-5 px-5 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              direction === "in"
                ? createHookInAction({
                    accountId: ctx.clientId,
                    name,
                    tags: tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                : createHookOutAction({ accountId: ctx.clientId, name, url }),
            (r) => r.ok && r.id && onCreated(r.id),
          );
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Direction</legend>
          {[
            {
              v: "in" as const,
              label: "Incoming",
              hint: "Another tool posts to Lotus. Creates or updates a contact and can start workflows.",
            },
            {
              v: "out" as const,
              label: "Outgoing",
              hint: "A workflow step posts the contact from Lotus to your URL.",
            },
          ].map((o) => (
            <label
              key={o.v}
              className={cn(
                "flex cursor-pointer gap-2.5 rounded border px-3 py-2.5",
                direction === o.v
                  ? "border-rail bg-surface"
                  : "border-line-strong hover:border-fg-3",
              )}
            >
              <input
                type="radio"
                name="direction"
                checked={direction === o.v}
                onChange={() => setDirection(o.v)}
                className="mt-0.5 size-3.5 accent-[var(--rail)]"
              />
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-fg-3">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field
          label="Name"
          htmlFor="hook-name"
          error={result?.errors?.name}
          hint={
            direction === "in"
              ? "What will post to it: “Website contact form”."
              : "Where it goes: “Ops dashboard”."
          }
        >
          <Input
            id="hook-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            aria-invalid={!!result?.errors?.name || undefined}
          />
        </Field>
        {direction === "out" ? (
          <Field label="URL" htmlFor="hook-url" error={result?.errors?.url}>
            <Input
              id="hook-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/lotus"
              className="num"
              inputMode="url"
              maxLength={500}
              aria-invalid={!!result?.errors?.url || undefined}
            />
          </Field>
        ) : (
          <Field
            label="Tags to add"
            htmlFor="hook-tags"
            hint="Optional, comma-separated."
          >
            <Input
              id="hook-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Website form"
              maxLength={300}
            />
          </Field>
        )}
        {result && !result.ok && !result.errors && <Notice result={result} />}
        <button
          type="submit"
          disabled={pending}
          className={cn(inkButton, "self-start")}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          {pending
            ? "Creating…"
            : direction === "in"
              ? "Create and get the URL"
              : "Create webhook"}
        </button>
      </form>
    </div>
  );
}

/* -------------------------------- API keys ------------------------------- */

export function apiDocs(origin: string, key = "lts_your_key") {
  return {
    list: `curl ${origin}/api/v1/contacts?limit=20 \\\n  -H "Authorization: Bearer ${key}"`,
    create: `curl -X POST ${origin}/api/v1/contacts \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"first_name":"Dana","email":"dana@example.com","tags":["API"]}'`,
  };
}

export function KeyPanel({ apiKey, ctx }: { apiKey: ApiKey; ctx: PanelCtx }) {
  const [confirm, setConfirm] = useState(false);
  const { pending, run } = useAction();
  const docs = apiDocs(ctx.origin);
  const entries = ctx.logs.filter((l) => l.ref === apiKey.id);
  return (
    <div className="flex flex-col">
      <PanelHeader
        title={apiKey.label}
        sub={`API key · ${ctx.clientName}`}
        onClose={ctx.onClose}
        tags={
          apiKey.revokedAt ? (
            <span className="inline-flex h-5 items-center rounded-[4px] border border-dashed border-line-strong px-1.5 text-2xs font-medium text-fg-3">
              Revoked
            </span>
          ) : (
            <Tag tone="neutral">Active</Tag>
          )
        }
      >
        <p className="num text-xs text-fg-2">
          {apiKey.prefix}… · made by {apiKey.createdBy}{" "}
          {timeAgo(apiKey.createdAt, ctx.now)}
          {apiKey.lastUsedAt
            ? ` · last used ${timeAgo(apiKey.lastUsedAt, ctx.now)}`
            : " · never used"}
        </p>
      </PanelHeader>
      <div className="flex flex-col gap-6 px-5 py-5">
        <section className="flex flex-col gap-2">
          <SectionTitle
            sub={`Reads and writes ${ctx.clientName}'s contacts only.`}
          >
            Use it
          </SectionTitle>
          <CodeBlock code={docs.list} label="list example" />
          <CodeBlock code={docs.create} label="create example" />
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle sub="Last 30 days">Calls</SectionTitle>
          <RecentLog ctx={ctx} entries={entries} empty="No calls yet." />
        </section>
        {!apiKey.revokedAt && (
          <section className="flex flex-col gap-2 border-t border-line pt-5">
            {confirm ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-fg-2">
                  Anything using it stops working at once.
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => revokeKeyAction({ id: apiKey.id }),
                      () => setConfirm(false),
                    )
                  }
                  className={cn(dangerButton, "border-red/40 text-red")}
                >
                  Revoke key
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="text-xs font-medium text-fg-3 hover:text-fg"
                >
                  Keep it
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className={cn(dangerButton, "self-start")}
              >
                Revoke
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function NewKeyPanel({
  ctx,
  onCreated,
}: {
  ctx: PanelCtx;
  onCreated: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState<{ id: string; raw: string } | null>(
    null,
  );
  const { pending, result, run } = useAction();
  if (secret) {
    const docs = apiDocs(ctx.origin, secret.raw);
    return (
      <div className="flex flex-col">
        <PanelHeader
          title={label || "New key"}
          sub={`API key · ${ctx.clientName}`}
          onClose={ctx.onClose}
          tags={<Tag tone="neutral">Active</Tag>}
        />
        <div className="flex flex-col gap-5 px-5 py-5">
          <p
            role="status"
            className="rounded border border-amber/25 bg-amber-soft/60 px-3 py-2 text-xs leading-relaxed text-amber"
          >
            Copy the key now. Lotus keeps only a fingerprint of it, so it
            can&apos;t be shown again.
          </p>
          <CopyField value={secret.raw} label="API key" />
          <CodeBlock code={docs.list} label="list example" />
          <CodeBlock code={docs.create} label="create example" />
          <button
            type="button"
            onClick={() => onCreated(secret.id)}
            className={cn(smallButton, "self-start")}
          >
            I&apos;ve copied it
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <PanelHeader
        title="New API key"
        sub={ctx.clientName}
        onClose={ctx.onClose}
      />
      <form
        className="flex flex-col gap-5 px-5 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createKeyAction({ accountId: ctx.clientId, label }),
            (r) =>
              r.ok &&
              r.id &&
              r.secret &&
              setSecret({ id: r.id, raw: r.secret }),
          );
        }}
      >
        <p className="text-xs leading-relaxed text-fg-2">
          A key lets your own scripts and other software read and create{" "}
          {ctx.clientName}&apos;s contacts through the Lotus API.
        </p>
        <Field
          label="What will use it"
          htmlFor="key-label"
          error={result?.errors?.label}
        >
          <Input
            id="key-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Reporting script"
            maxLength={60}
            aria-invalid={!!result?.errors?.label || undefined}
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className={cn(inkButton, "self-start")}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          {pending ? "Creating…" : "Create key"}
        </button>
      </form>
    </div>
  );
}

/* --------------------------------- log ---------------------------------- */

export function LogPanel({
  entry,
  source,
  ctx,
}: {
  entry: IntegrationLog;
  source: string;
  ctx: PanelCtx;
}) {
  return (
    <div className="flex flex-col">
      <PanelHeader
        title={entry.title}
        sub={`${logKindLabel[entry.kind]} · ${source}`}
        onClose={ctx.onClose}
        tags={<LogStatus log={entry} />}
      >
        <p className="num text-xs text-fg-2">
          {new Date(entry.at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          · {timeAgo(entry.at, ctx.now)}
        </p>
      </PanelHeader>
      <div className="flex flex-col gap-5 px-5 py-5">
        <p
          className={cn(
            "text-sm leading-relaxed",
            entry.status === "failed" ? "text-red" : "text-fg-2",
          )}
        >
          {entry.detail}
        </p>
        {entry.contactId && ctx.contacts[entry.contactId] && (
          <Link
            href={`/agency/contacts/${entry.contactId}`}
            className={cn(smallButton, "self-start")}
          >
            <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
            {ctx.contacts[entry.contactId]}
          </Link>
        )}
        {entry.payload ? (
          <section className="flex flex-col gap-2">
            <SectionTitle>Payload</SectionTitle>
            <pre className="num max-h-[60vh] overflow-auto rounded border border-line bg-surface-2/60 px-3 py-2.5 text-[12px] leading-[1.6] text-fg-2">
              {entry.payload}
            </pre>
          </section>
        ) : (
          <p className="text-xs text-fg-3">No payload recorded.</p>
        )}
      </div>
    </div>
  );
}
