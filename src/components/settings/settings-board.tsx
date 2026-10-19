"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { Avatar, SectionTitle, Tag } from "@/components/diagnostic/primitives";
import { TopBar } from "@/components/field/ui";
import { CheckboxChip, Field, FormNotice, Input, Select, SubmitButton } from "@/components/form";
import { timeZones } from "@/components/clients/client-form";
import type { AccountState } from "@/app/account/actions";
import type { Assignee } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Agency settings in four tabs: your own profile, the agency's details,
 * the team (people, roles, client logins and invites) and the providers
 * that send for real once their keys are set.
 */

export type SettingsTab = "profile" | "agency" | "team" | "providers";
type Action = (prev: AccountState, formData: FormData) => Promise<AccountState>;
type Role = "owner" | "admin" | "member" | "client";

export interface Integration {
  name: string;
  purpose: string;
  envVars: string[];
  live: boolean;
  /** What happens while it is off. */
  off: string;
}

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: Role;
  accountIds: string[];
  lastLoginAt: string | null;
  person: Assignee;
  clients: number;
}

export interface InviteRow {
  id: string;
  email: string;
  name: string;
  role: Exclude<Role, "owner">;
  account_ids: string[];
  expires_at: string;
}

const roleLabel: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Team member", client: "Client login" };
const roleHelp: Record<Exclude<Role, "owner">, string> = {
  admin: "Everything, including the team, billing and agency details.",
  member: "Every client and module. Can't change the team or agency details.",
  client: "Only their own dashboard: results, reviews and reports.",
};

const tabs: { key: SettingsTab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "agency", label: "Agency" },
  { key: "team", label: "Team" },
  { key: "providers", label: "Providers" },
];

function since(iso: string | null, nowIso: string) {
  if (!iso) return "Never signed in";
  const days = Math.floor((Date.parse(nowIso) - Date.parse(iso)) / 86400000);
  return days <= 0 ? "Active today" : days === 1 ? "Active yesterday" : `Active ${days} days ago`;
}

export function SettingsBoard(props: {
  tab: SettingsTab;
  me: { userId: string; name: string; email: string; role: Role };
  agency: { name: string; timeZone: string; website: string; phone: string; brandColor: string };
  members: MemberRow[];
  invites: InviteRow[];
  clients: { id: string; name: string }[];
  integrations: Integration[];
  nowIso: string;
  actions: {
    profile: Action;
    password: Action;
    agency: Action;
    invite: Action;
    revoke: (id: string) => Promise<void>;
    setMember: (userId: string, role: Exclude<Role, "owner">, accountIds: string[]) => Promise<AccountState>;
    remove: (userId: string) => Promise<AccountState>;
  };
}) {
  const { tab, me, members, integrations } = props;
  const live = integrations.filter((i) => i.live).length;
  const staff = members.filter((m) => m.role !== "client").length;
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Settings" meta={`${staff} on the team · ${live} of ${integrations.length} providers connected`} />
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-line px-5 md:px-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/agency/settings?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-2.5 py-2.5 text-sm whitespace-nowrap", t.key === tab ? "border-brand font-medium text-fg" : "border-transparent text-fg-3 hover:text-fg")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-6 md:px-6">
        {tab === "profile" && <Profile me={me} actions={props.actions} />}
        {tab === "agency" && <AgencyDetails agency={props.agency} canEdit={me.role === "owner" || me.role === "admin"} action={props.actions.agency} />}
        {tab === "team" && <Team {...props} />}
        {tab === "providers" && <Providers integrations={integrations} />}
      </div>
    </div>
  );
}

function Profile({ me, actions }: { me: { name: string; email: string; role: Role }; actions: { profile: Action; password: Action } }) {
  const [profile, saveProfile] = useActionState(actions.profile, null);
  const [pw, savePw] = useActionState(actions.password, null);
  return (
    <div className="grid max-w-[880px] gap-10 lg:grid-cols-2">
      <form action={saveProfile} className="flex flex-col gap-4" noValidate>
        <SectionTitle sub={`You're the ${roleLabel[me.role].toLowerCase()} of this agency.`}>Your profile</SectionTitle>
        <Field label="Name" htmlFor="name" error={profile?.errors?.name}>
          <Input id="name" name="name" defaultValue={me.name} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="email" hint="You sign in with this." error={profile?.errors?.email}>
          <Input id="email" name="email" type="email" defaultValue={me.email} autoComplete="email" />
        </Field>
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        </div>
        <FormNotice state={profile} />
      </form>
      <form action={savePw} className="flex flex-col gap-4" noValidate>
        <SectionTitle sub="Changing it signs you out on every other device.">Password</SectionTitle>
        <Field label="Current password" htmlFor="current" error={pw?.errors?.current}>
          <Input id="current" name="current" type="password" autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="next" hint="At least 10 characters." error={pw?.errors?.next}>
          <Input id="next" name="next" type="password" autoComplete="new-password" />
        </Field>
        <div>
          <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
        </div>
        <FormNotice state={pw} />
      </form>
    </div>
  );
}

function AgencyDetails({ agency, canEdit, action }: { agency: { name: string; timeZone: string; website: string; phone: string; brandColor: string }; canEdit: boolean; action: Action }) {
  const [state, save] = useActionState(action, null);
  const zones = timeZones.some(([z]) => z === agency.timeZone) ? timeZones : ([[agency.timeZone, agency.timeZone], ...timeZones] as const);
  return (
    <form action={save} className="flex max-w-[640px] flex-col gap-4" noValidate>
      <SectionTitle sub={canEdit ? "Shown to clients on their dashboard, reports and invites." : "Only the owner or an admin can change these."}>Agency details</SectionTitle>
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2 disabled:opacity-70">
        <Field label="Agency name" htmlFor="agency-name" error={state?.errors?.name} className="sm:col-span-2">
          <Input id="agency-name" name="name" defaultValue={agency.name} />
        </Field>
        <Field label="Time zone" htmlFor="tz" hint="Reports and the Daily Diagnostic roll over at midnight here.">
          <Select id="tz" name="timeZone" defaultValue={agency.timeZone}>
            {zones.map(([z, label]) => (
              <option key={z} value={z}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phone" htmlFor="phone" error={state?.errors?.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={agency.phone} autoComplete="tel" />
        </Field>
        <Field label="Website" htmlFor="website" error={state?.errors?.website}>
          <Input id="website" name="website" type="url" defaultValue={agency.website} placeholder="https://" />
        </Field>
        <Field label="Brand colour" htmlFor="brandColor" hint="Hex, like #6d3df2." error={state?.errors?.brandColor}>
          <Input id="brandColor" name="brandColor" defaultValue={agency.brandColor} placeholder="#6d3df2" className="num" />
        </Field>
      </fieldset>
      {canEdit && (
        <div>
          <SubmitButton pendingLabel="Saving…">Save agency details</SubmitButton>
        </div>
      )}
      <FormNotice state={state} />
    </form>
  );
}

function Team({ me, members, invites, clients, nowIso, actions }: Parameters<typeof SettingsBoard>[0]) {
  const canManage = me.role === "owner" || me.role === "admin";
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Removed client";
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] [&>section]:min-w-0">
      <section>
        <div className="border-b border-line pb-2">
          <SectionTitle sub="Staff see every client. Client logins see only the accounts listed beside them.">People</SectionTitle>
        </div>
        <ul>
          {members.map((m) => (
            <MemberItem key={m.userId} m={m} me={me} canManage={canManage} clients={clients} clientName={clientName} nowIso={nowIso} actions={actions} />
          ))}
        </ul>
        {invites.length > 0 && (
          <>
            <div className="mt-8 border-b border-line pb-2">
              <SectionTitle sub="Each link works once and expires after 7 days.">Waiting to join</SectionTitle>
            </div>
            <ul>
              {invites.map((i) => (
                <li key={i.id} className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.name || i.email}</div>
                    <div className="truncate text-xs text-fg-3">
                      {i.name ? `${i.email} · ` : ""}
                      {roleLabel[i.role]}
                      {i.role === "client" && i.account_ids.length > 0 && ` · ${i.account_ids.map(clientName).join(", ")}`}
                    </div>
                  </div>
                  <span className="num text-xs text-fg-3">Expires {new Date(i.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  {canManage && (
                    <form action={() => actions.revoke(i.id)}>
                      <button type="submit" className="text-xs text-fg-3 underline hover:text-red">
                        Withdraw
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section>
        {canManage ? (
          <InviteForm clients={clients} action={actions.invite} />
        ) : (
          <p className="text-sm text-fg-3">Ask the owner or an admin to invite people.</p>
        )}
      </section>
    </div>
  );
}

function MemberItem({
  m,
  me,
  canManage,
  clients,
  clientName,
  nowIso,
  actions,
}: {
  m: MemberRow;
  me: { userId: string };
  canManage: boolean;
  clients: { id: string; name: string }[];
  clientName: (id: string) => string;
  nowIso: string;
  actions: Parameters<typeof SettingsBoard>[0]["actions"];
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Exclude<Role, "owner">>(m.role === "owner" ? "admin" : m.role);
  const [access, setAccess] = useState<string[]>(m.accountIds);
  const [state, setState] = useState<AccountState>(null);
  const [pending, start] = useTransition();
  const editable = canManage && m.role !== "owner" && m.userId !== me.userId;
  return (
    <li className="border-b border-line py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Avatar person={m.person} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {m.name}
            {m.userId === me.userId && <span className="font-normal text-fg-3"> (you)</span>}
          </div>
          <div className="truncate text-xs text-fg-3">
            {m.email} · {since(m.lastLoginAt, nowIso)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {m.role === "client" ? (
            <span className="max-w-[200px] truncate text-xs text-fg-2">{m.accountIds.map(clientName).join(", ") || "No account"}</span>
          ) : (
            <span className="num text-xs text-fg-2">{m.clients} {m.clients === 1 ? "client" : "clients"}</span>
          )}
          <Tag tone={m.role === "owner" ? "brand" : "neutral"}>{roleLabel[m.role]}</Tag>
          {editable && (
            <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs text-fg-3 underline hover:text-fg">
              {editing ? "Close" : "Edit"}
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-3 flex flex-col gap-3 rounded border border-line bg-surface-2/40 p-3">
          <Field label="Role" htmlFor={`role-${m.userId}`} hint={roleHelp[role]}>
            <Select id={`role-${m.userId}`} value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, "owner">)}>
              <option value="admin">Admin</option>
              <option value="member">Team member</option>
              <option value="client">Client login</option>
            </Select>
          </Field>
          {role === "client" && <ClientPicker clients={clients} value={access} onChange={setAccess} />}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => setState(await actions.setMember(m.userId, role, access)))}
              className="inline-flex h-8 items-center rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(`Remove ${m.name} from the agency? They lose access straight away.`)) start(async () => setState(await actions.remove(m.userId)));
              }}
              className="text-sm text-red underline disabled:opacity-50"
            >
              Remove from agency
            </button>
          </div>
          <FormNotice state={state} />
        </div>
      )}
    </li>
  );
}

function ClientPicker({ clients, value, onChange, error }: { clients: { id: string; name: string }[]; value: string[]; onChange: (ids: string[]) => void; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Accounts they can see</legend>
      {clients.length === 0 ? (
        <p className="text-xs text-fg-3">
          Add a client first, then invite their login.{" "}
          <Link href="/agency/clients/new" className="text-brand underline">
            Add a client
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {clients.map((c) => (
            <CheckboxChip
              key={c.id}
              name="accountIds"
              value={c.id}
              label={c.name}
              checked={value.includes(c.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))}
            />
          ))}
        </div>
      )}
      {error && (
        <p className="text-xs text-red" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function InviteForm({ clients, action }: { clients: { id: string; name: string }[]; action: Action }) {
  const [state, run] = useActionState(action, null);
  const [role, setRole] = useState<Exclude<Role, "owner">>("member");
  const [access, setAccess] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  return (
    <form action={run} className="flex flex-col gap-4 rounded border border-line p-4" noValidate>
      <SectionTitle sub="They get a link to set a password and join.">Invite someone</SectionTitle>
      <Field label="Email" htmlFor="invite-email" error={state?.errors?.email}>
        <Input id="invite-email" name="email" type="email" placeholder="name@company.com" defaultValue={state?.ok ? undefined : state?.values?.email} />
      </Field>
      <Field label="Name (optional)" htmlFor="invite-name">
        <Input id="invite-name" name="name" defaultValue={state?.ok ? undefined : state?.values?.name} />
      </Field>
      <Field label="Role" htmlFor="invite-role" hint={roleHelp[role]}>
        <Select id="invite-role" name="role" value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, "owner">)}>
          <option value="member">Team member</option>
          <option value="admin">Admin</option>
          <option value="client">Client login</option>
        </Select>
      </Field>
      {role === "client" && <ClientPicker clients={clients} value={access} onChange={setAccess} error={state?.errors?.accountIds} />}
      <div>
        <SubmitButton pendingLabel="Inviting…">Send invite</SubmitButton>
      </div>
      <FormNotice state={state} />
      {state?.link && (
        <div className="flex items-center gap-2">
          <Input readOnly value={state.link} className="num text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(state.link!).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-line-strong px-3 text-sm hover:bg-surface-2"
          >
            {copied ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={2} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </form>
  );
}

function Providers({ integrations }: { integrations: Integration[] }) {
  return (
    <section className="max-w-[880px]">
      <div className="border-b border-line pb-2">
        <SectionTitle sub="Keys are set in the hosting environment (Vercel › Settings › Environment Variables), never typed in here. Each provider switches on as soon as its keys are present.">
          Providers
        </SectionTitle>
      </div>
      <ul>
        {integrations.map((i) => (
          <li key={i.name} className="grid gap-x-4 gap-y-1 border-b border-line py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <div className="text-sm font-medium">{i.name}</div>
              <div className="num truncate text-xs text-fg-3">{i.envVars.join(", ")}</div>
            </div>
            <div className="min-w-0 text-sm text-fg-2">
              <div>{i.purpose}</div>
              {!i.live && <div className="text-xs text-fg-3">{i.off}</div>}
            </div>
            <span className={cn("inline-flex items-center gap-1.5 self-start whitespace-nowrap text-xs font-medium", i.live ? "text-green" : "text-fg-2")}>
              <span aria-hidden className={cn("size-1.5 rounded-full", i.live ? "bg-green" : "bg-fg-3")} />
              {i.live ? "Connected" : "Not connected"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
