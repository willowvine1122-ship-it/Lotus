"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Field, FormNotice, Input, Select, SubmitButton } from "@/components/form";
import type { ElementResult } from "@/app/agency/elements/actions";
import { defaultConfig, elementGroups, elementKinds, kindOf } from "@/lib/elements";
import type { DonationElementType } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ElementLive } from "./data";
import { ElementPreview } from "./preview";
import { ElementView } from "./render";
import { elementIcon } from "./ui";

/*
 * New element: every type as a small working sample, grouped the way
 * Fundraise Up groups them, with the client, campaign and name on the
 * right and a full preview of the pick in context.
 */

export interface PickerClient {
  id: string;
  name: string;
  campaigns: { id: string; title: string; status: string }[];
}

export function NewElement({ clients, lives, initialClientId, initialType, nowIso, action }: { clients: PickerClient[]; lives: Record<string, ElementLive>; initialClientId?: string; initialType?: DonationElementType; nowIso: string; action: (prev: ElementResult | null, fd: FormData) => Promise<ElementResult> }) {
  const [state, formAction] = useActionState(action, null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [type, setType] = useState<DonationElementType>(initialType ?? "donate_button");
  const [clientId, setClientId] = useState(initialClientId ?? clients[0]?.id ?? "");
  const client = clients.find((c) => c.id === clientId) ?? clients[0];
  const [campaignId, setCampaignId] = useState(client?.campaigns[0]?.id ?? "");
  const campaign = client?.campaigns.find((c) => c.id === campaignId) ?? client?.campaigns[0];
  const live = campaign ? lives[campaign.id] : undefined;
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const shownName = named ? name : kindOf(type).label;

  const configFor = (t: DonationElementType) => (live ? defaultConfig(t, { title: live.campaign.title, amounts: live.campaign.amounts, impact: live.campaign.impact }) : defaultConfig(t));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-rail px-5 pb-5 pt-5 text-rail-fg md:px-6">
        <Link href="/agency/elements" className="inline-flex items-center gap-1 text-xs text-rail-fg hover:underline">
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          Elements
        </Link>
        <h1 className="mt-1 text-xl font-semibold leading-7 tracking-tight">New element</h1>
        <p className="mt-0.5 text-xs text-rail-fg-2">Pick what to place on the site. Every sample below works; click one to choose it.</p>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1 px-5 py-5 md:px-6">
          {elementGroups.map((g) => (
            <section key={g} className="mb-7 last:mb-0">
              <h2 className="mb-2.5 text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{g}</h2>
              <div role="radiogroup" aria-label={g} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {elementKinds
                  .filter((k) => k.group === g)
                  .map((k) => {
                    const Icon = elementIcon[k.type];
                    const on = k.type === type;
                    const cfg = configFor(k.type);
                    return (
                      <div
                        key={k.type}
                        role="radio"
                        tabIndex={0}
                        aria-checked={on}
                        aria-label={k.label}
                        onClick={() => setType(k.type)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setType(k.type);
                          }
                        }}
                        className={cn("group flex cursor-pointer flex-col overflow-hidden rounded border bg-surface text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-[border-color,box-shadow] duration-150", on ? "border-rail shadow-[0_0_0_1px_var(--rail)]" : "border-line hover:border-line-strong")}
                      >
                        <span inert className="relative flex h-[164px] items-center justify-center overflow-hidden border-b border-line bg-[#fbfaf8] px-4">
                          {live && (
                            <span className={cn("pointer-events-none block shrink-0 origin-center", scaleFor[k.type])}>
                              <ElementView type={k.type} c={cfg} live={live} now={now} onDonate={() => {}} onClose={k.placement === "overlay" && k.type !== "sticky_button" ? () => {} : undefined} form={k.type === "donation_form" ? <DemoForm /> : undefined} />
                            </span>
                          )}
                        </span>
                        <span className="flex items-start gap-2.5 px-3.5 py-3">
                          <Icon className={cn("mt-0.5 size-4 shrink-0", on ? "text-fg" : "text-fg-3")} strokeWidth={1.75} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{k.label}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">{k.blurb}</span>
                          </span>
                        </span>
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>

        <aside className="border-t border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0 2xl:w-[460px]">
          <form action={formAction} className="flex flex-col gap-4 px-5 py-5">
            <input type="hidden" name="type" value={type} />
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{kindOf(type).group}</p>
              <h2 className="text-lg font-semibold tracking-tight">{kindOf(type).label}</h2>
            </div>
            {live && <ElementPreview type={type} config={configFor(type)} live={live} nowIso={nowIso} compact />}
            <Field label="Client" htmlFor="accountId" error={state?.errors?.accountId}>
              <Select
                id="accountId"
                name="accountId"
                value={client?.id ?? ""}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setCampaignId(clients.find((c) => c.id === e.target.value)?.campaigns[0]?.id ?? "");
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Campaign" htmlFor="campaignId" hint="Gifts made through the element go to this campaign." error={state?.errors?.campaignId}>
              <Select id="campaignId" name="campaignId" value={campaign?.id ?? ""} onChange={(e) => setCampaignId(e.target.value)}>
                {client?.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.status !== "live" ? ` (${c.status})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name" htmlFor="name" hint="Only your team sees this." error={state?.errors?.name}>
              <Input
                id="name"
                name="name"
                value={shownName}
                onChange={(e) => {
                  setNamed(true);
                  setName(e.target.value);
                }}
                maxLength={80}
              />
            </Field>
            <FormNotice state={state && !state.ok && !state.errors ? state : null} />
            <SubmitButton pendingLabel="Creating…" className="w-full justify-center">
              Create and customise
            </SubmitButton>
          </form>
        </aside>
      </div>
    </div>
  );
}

/** How big each sample is drawn so the whole element fits its card. */
const scaleFor: Record<DonationElementType, string> = {
  donate_button: "scale-100",
  sticky_button: "scale-100",
  stat_counter: "scale-[0.8]",
  button_group: "w-[360px] scale-[0.5]",
  image_card: "w-[380px] scale-[0.36]",
  goal_meter: "w-[380px] scale-[0.62]",
  donation_form: "w-[420px] scale-[0.56]",
  donation_levels: "w-[640px] scale-[0.36]",
  impact_slider: "w-[380px] scale-[0.42]",
  recent_donations: "w-[380px] scale-[0.36]",
  message_bar: "w-[560px] scale-[0.5]",
  popup: "scale-[0.31]",
  social_proof: "scale-[0.78]",
};

/** A still of the checkout's first step for the picker card. */
function DemoForm() {
  return (
    <div className="rounded border border-line bg-surface p-5">
      <p className="text-base font-semibold">Choose your gift</p>
      <div className="mt-3 grid h-10 grid-cols-2 rounded bg-surface-2 p-0.5 text-sm font-medium">
        <span className="grid place-items-center text-fg-2">Give once</span>
        <span className="grid place-items-center rounded-[4px] bg-rail text-rail-fg">Monthly</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["$25", "$50", "$100"].map((a, i) => (
          <span key={a} className={cn("num grid h-12 place-items-center rounded border text-base font-semibold", i === 1 ? "border-rail bg-rail text-rail-fg" : "border-line-strong")}>
            {a}
          </span>
        ))}
      </div>
      <span className="mt-3 grid h-11 place-items-center rounded bg-brand text-base font-medium text-white">Give $50 monthly</span>
    </div>
  );
}
