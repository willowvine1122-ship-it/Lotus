"use client";

import Link from "next/link";
import { Avatar, SectionTitle, Tag } from "@/components/diagnostic/primitives";
import { TopBar } from "@/components/field/ui";
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
    <div className="flex min-h-screen flex-col">
      <TopBar
        title="Settings"
        meta={`${team.length} on the agency team · ${live} of ${integrations.length} providers connected`}
      />
      <div className="grid gap-10 px-5 py-6 md:px-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] [&>section]:min-w-0">
        <section>
          <div className="border-b border-line pb-2">
            <SectionTitle sub="Everyone here sees every client. Who is assigned to a client is set on that client's Team tab.">
              Agency team
            </SectionTitle>
          </div>
          <ul>
            {team.map((a) => (
              <li
                key={a.name}
                className="flex h-[52px] items-center gap-3 border-b border-line"
              >
                <Avatar person={a} size="md" />
                <span className="flex-1 text-sm font-medium">{a.name}</span>
                <span className="num text-xs text-fg-2">
                  {clientsPerMember[a.name] ?? 0} clients
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-3">
            Sign-in and invitations arrive with Supabase auth. Until then the
            team is fixed.
          </p>
        </section>
        <section>
          <div className="border-b border-line pb-2">
            <SectionTitle sub="Set the key in the environment and restart. Nothing leaves the machine while a provider is in demo mode.">
              Providers
            </SectionTitle>
          </div>
          <ul>
            {integrations.map((i) => (
              <li
                key={i.name}
                className="grid gap-x-4 gap-y-1 border-b border-line py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{i.name}</div>
                  <div className="num truncate text-xs text-fg-3">
                    {i.envVar}
                  </div>
                </div>
                <div className="min-w-0 text-sm text-fg-2">
                  <div>{i.purpose}</div>
                  {!i.live && <div className="text-xs text-fg-3">{i.demo}</div>}
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 self-start whitespace-nowrap text-xs font-medium",
                    i.live ? "text-green" : "text-fg-2",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      i.live ? "bg-green" : "bg-fg-3",
                    )}
                  />
                  {i.live ? "Connected" : "Demo mode"}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-b border-line pb-2">
            <SectionTitle
              sub="Point Twilio, Resend and Meta replies at this address. Each reply lands in the Inbox as the contact and can start an automation."
              aside={<Tag tone="neutral">Webhook</Tag>}
            >
              Inbound messages
            </SectionTitle>
          </div>
          <pre className="mt-3 overflow-x-auto rounded border border-line bg-surface-2/50 px-3 py-2 font-mono text-xs leading-5 text-fg">{`POST ${inboundUrl}\n{ "channel": "sms", "from": "+1 555 010 0100", "body": "Yes, book me in" }`}</pre>
          <p className="mt-2 text-xs text-fg-3">
            Triggers and templates live in{" "}
            <Link
              href="/agency/automations"
              className="text-fg-2 underline hover:text-fg"
            >
              Automations
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
