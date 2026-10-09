import Link from "next/link";
import { Avatar, Tag } from "@/components/diagnostic/primitives";
import { PageHeader } from "@/components/page-header";
import type { Assignee } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Agency settings: who is on the team and which providers are live. Read-only
 * until auth lands; keys are set in the environment, never typed in here.
 */

export interface Integration {
  name: string;
  purpose: string;
  envVar: string;
  live: boolean;
  demo: string; // what happens while it is off
}

export function SettingsBoard({
  team,
  clientsPerMember,
  integrations,
  inboundUrl,
}: {
  team: Assignee[];
  clientsPerMember: Record<string, number>;
  integrations: Integration[];
  inboundUrl: string;
}) {
  const live = integrations.filter((i) => i.live).length;
  return (
    <div className="bg-surface">
      <PageHeader
        className="items-center pb-3 pt-3 md:flex-nowrap"
        title={<span className="text-lg leading-6">Settings</span>}
        meta={<span className="num">{team.length} on the agency team · {live} of {integrations.length} providers connected</span>}
      />
      <div className="grid gap-10 px-5 py-6 md:px-6 xl:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold">Agency team</h2>
          <p className="text-xs text-fg-3">Everyone here sees every client. Change who is assigned to a client from the Team tab on that client.</p>
          <ul className="mt-2">
            {team.map((a) => (
              <li key={a.name} className="flex items-center gap-3 border-b border-line py-3">
                <Avatar person={a} size="md" />
                <span className="flex-1 text-sm font-medium">{a.name}</span>
                <span className="num text-xs text-fg-2">{clientsPerMember[a.name] ?? 0} clients</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-3">Sign-in and invitations arrive with Supabase auth. Until then the team is fixed.</p>
        </section>
        <section>
          <h2 className="text-sm font-semibold">Providers</h2>
          <p className="text-xs text-fg-3">Set the key in the environment and restart. Nothing leaves the machine while a provider is in demo mode.</p>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                {["Provider", "Used for", "Status"].map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 text-left text-2xs font-medium uppercase tracking-[0.06em] text-fg-3 first:pl-0 last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.name} className="border-b border-line">
                  <td className="py-2.5 pr-3 align-top">
                    <div className="font-medium">{i.name}</div>
                    <div className="num text-xs text-fg-3">{i.envVar}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top text-fg-2">
                    <div>{i.purpose}</div>
                    {!i.live && <div className="text-xs text-fg-3">{i.demo}</div>}
                  </td>
                  <td className="py-2.5 pl-3 align-top">
                    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", i.live ? "text-green" : "text-fg-2")}>
                      <span aria-hidden className={cn("size-1.5 rounded-full", i.live ? "bg-green" : "bg-fg-3")} />
                      {i.live ? "Connected" : "Demo mode"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 rounded border border-line bg-surface-2/50 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Inbound messages</h3>
              <Tag tone="neutral">Webhook</Tag>
            </div>
            <p className="mt-1 text-xs text-fg-2">Point Twilio, Resend and Meta replies at this address. Each reply lands in the Inbox as the contact and can start an automation.</p>
            <pre className="num mt-2 overflow-x-auto rounded bg-rail px-3 py-2 text-xs text-rail-fg">{`POST ${inboundUrl}\n{ "channel": "sms", "from": "+1 555 010 0100", "body": "Yes, book me in" }`}</pre>
            <p className="mt-2 text-xs text-fg-3">
              Triggers and templates live in <Link href="/agency/automations" className="text-fg-2 underline hover:text-fg">Automations</Link>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
