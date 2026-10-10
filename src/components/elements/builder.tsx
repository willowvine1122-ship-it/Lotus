"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, ExternalLink, Eye, Loader2, Monitor, MoreHorizontal, Pause, Play, Plus, Smartphone, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/page-header";
import { Field, Input, Select, Textarea } from "@/components/form";
import { CodeBlock, CopyField } from "@/components/integrations/ui";
import type { ElementResult } from "@/app/agency/elements/actions";
import { accentPresets, donateLink, elementSummary, installScript, isHex, isOverlay, kindOf, levelId, placeholder, stockImages } from "@/lib/elements";
import type { DonationElement, DonationElementConfig, DonationElementType, ElementLevel } from "@/lib/types";
import { cn, formatDollars, timeAgo } from "@/lib/utils";
import type { ElementLive } from "./data";
import { ElementPreview } from "./preview";
import type { DonateIntent } from "./render";
import { ElementMark, ElementStatusTag } from "./ui";

/*
 * The element builder: the element live on a stand-in page in the middle
 * (exactly what visitors get, clickable), and the editor on the right in
 * four tabs: what it says, how it looks, when it shows (overlays) and how
 * to place it. A local draft until Save; Cmd/Ctrl+S saves, and leaving
 * with edits asks first.
 */

export interface BuilderActions {
  save: (id: string, input: unknown) => Promise<ElementResult>;
  setStatus: (id: string, status: "live" | "paused") => Promise<ElementResult>;
  duplicate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

type Tab = "content" | "style" | "rules" | "place";

const inkBandButton = "inline-flex h-8 items-center gap-1.5 rounded border border-rail-line bg-rail-2 px-3 text-sm font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-line disabled:cursor-not-allowed disabled:opacity-50";

const has = (type: DonationElementType, ...ts: DonationElementType[]) => ts.includes(type);
const giving: DonationElementType[] = ["donate_button", "button_group", "image_card", "sticky_button", "donation_form", "donation_levels", "impact_slider", "message_bar", "popup", "social_proof", "recent_donations"];

const draftOf = (e: DonationElement) => ({ name: e.name, campaignId: e.campaignId, config: e.config });

export function ElementBuilder({ initial, client, campaigns, lives, origin, nowIso, actions }: { initial: DonationElement; client: { id: string; name: string; slug: string }; campaigns: { id: string; title: string; status: string }[]; lives: Record<string, ElementLive>; origin: string; nowIso: string; actions: BuilderActions }) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [el, setEl] = useState<DonationElement>(initial);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(draftOf(initial)));
  const [tab, setTab] = useState<Tab>("content");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [notice, setNotice] = useState<{ ok: boolean; message?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [intent, setIntent] = useState<DonateIntent | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(draftOf(el)) !== savedJson;
  const c = el.config;
  const live = lives[el.campaignId] ?? Object.values(lives)[0]!;
  const overlay = isOverlay(el.type);
  const kind = kindOf(el.type);

  const set = (p: Partial<DonationElementConfig>) => setEl((e) => ({ ...e, config: { ...e.config, ...p } }));

  function save(then?: () => void) {
    start(async () => {
      const res = await actions.save(el.id, draftOf(el));
      setErrors(res.errors ?? {});
      setNotice(res);
      if (res.ok) {
        setSavedJson(JSON.stringify(draftOf(el)));
        setEl((e) => ({ ...e, updatedAt: new Date().toISOString() }));
        router.refresh();
        then?.();
      } else if (res.errors) {
        const k = Object.keys(res.errors)[0] ?? "";
        if (/startsOn|endsOn|showOn|hideOn|delay|scroll/.test(k)) setTab("rules");
        else if (/accent/.test(k)) setTab("style");
        else setTab("content");
      }
    });
  }

  function setStatus(status: "live" | "paused") {
    const go = () =>
      start(async () => {
        const res = await actions.setStatus(el.id, status);
        setNotice(res);
        if (res.ok) {
          setEl((e) => ({ ...e, status }));
          router.refresh();
        }
      });
    if (dirty) save(go);
    else go();
  }

  // Cmd/Ctrl+S saves; leaving with edits asks first.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty]);

  // The preview's donate clicks say what would open, instead of opening a real checkout.
  useEffect(() => {
    if (!intent) return;
    const t = setTimeout(() => setIntent(null), 3200);
    return () => clearTimeout(t);
  }, [intent]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "content", label: "Content" },
    { key: "style", label: "Style" },
    ...(overlay ? [{ key: "rules" as const, label: "Rules" }] : []),
    { key: "place", label: "Place" },
  ];

  const preview = (
    <div className="relative">
      <ElementPreview key={`${device}:${el.type}`} type={el.type} config={c} live={live} nowIso={nowIso} interactive phone={device === "phone"} onDonate={(i) => setIntent(i)} />
      {intent && (
        <div role="status" className="absolute inset-x-0 bottom-3 mx-auto w-fit max-w-[calc(100%-24px)] rounded bg-rail px-3 py-2 text-xs text-rail-fg shadow-2">
          Opens checkout for {live.campaign.title}
          {intent.amountCents ? ` at ${formatDollars(intent.amountCents)}` : ""}
          {intent.frequency === "monthly" ? ", monthly" : intent.frequency === "one_time" ? ", one time" : ""}.
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-rail text-rail-fg">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pb-4 pt-5 md:px-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs text-rail-fg-2">
              <Link href={`/agency/elements?client=${client.slug}`} className="inline-flex items-center gap-1 text-rail-fg hover:underline">
                <ArrowLeft className="size-3.5" strokeWidth={2} />
                Elements
              </Link>
              <span aria-hidden>·</span>
              <Link href={`/agency/clients/${client.slug}`} className="truncate hover:text-rail-fg hover:underline">
                {client.name}
              </Link>
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-2.5">
              <ElementMark type={el.type} accent={c.accent} size="sm" />
              <h1 className="truncate text-xl font-semibold leading-7 tracking-tight">{el.name || "Untitled element"}</h1>
              <span className="shrink-0 rounded-[4px] bg-surface">
                <ElementStatusTag status={el.status} />
              </span>
            </div>
            <p className="num mt-0.5 text-xs text-rail-fg-2">
              {kind.label} · {dirty ? <span className="font-medium text-rail-fg">Unsaved changes</span> : `Saved ${timeAgo(el.updatedAt, now)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notice?.message && (
              <span role="status" className={cn("max-w-[40ch] truncate text-xs", notice.ok ? "text-rail-fg-2" : "font-medium text-[#ff9b8a]")}>
                {notice.message}
              </span>
            )}
            <button type="button" onClick={() => setPreviewOpen(true)} className={cn(inkBandButton, "xl:hidden")}>
              <Eye className="size-3.5" strokeWidth={2} />
              Preview
            </button>
            <button type="button" onClick={() => setStatus(el.status === "live" ? "paused" : "live")} disabled={pending} className={inkBandButton}>
              {el.status === "live" ? <Pause className="size-3.5" strokeWidth={2} /> : <Play className="size-3.5" strokeWidth={2} />}
              {el.status === "live" ? "Pause" : "Go live"}
            </button>
            <div className="relative">
              <button type="button" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)} className={cn(inkBandButton, "w-8 justify-center px-0")}>
                <MoreHorizontal className="size-4" strokeWidth={2} />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-[200px] rounded border border-line-strong bg-surface py-1 text-fg shadow-2">
                  <button type="button" role="menuitem" onClick={() => start(() => actions.duplicate(el.id))} className="flex h-8 w-full items-center gap-2.5 px-3 text-left text-sm hover:bg-surface-2">
                    <Copy className="size-3.5 text-fg-3" strokeWidth={1.75} />
                    Duplicate
                  </button>
                  <a role="menuitem" href={`/e/${el.id}`} target="_blank" rel="noreferrer" className="flex h-8 w-full items-center gap-2.5 px-3 text-left text-sm hover:bg-surface-2">
                    <ExternalLink className="size-3.5 text-fg-3" strokeWidth={1.75} />
                    Open alone
                  </a>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (window.confirm(`Delete “${el.name}”? It disappears from every site it is placed on.`)) start(() => actions.remove(el.id));
                    }}
                    className="flex h-8 w-full items-center gap-2.5 px-3 text-left text-sm text-red hover:bg-red-soft/50"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    Delete
                  </button>
                </div>
              )}
            </div>
            <Button onClick={() => save()} disabled={pending || !dirty} className="h-8">
              {pending && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
              Save
            </Button>
          </div>
        </header>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        <section aria-label="Preview" className="hidden min-w-0 flex-1 flex-col bg-surface-2/60 xl:flex">
          <div className="sticky top-0 flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-fg-3">
                {overlay ? "Shown as it floats over a page. " : "Shown on a stand-in page. "}
                Click it: nothing is charged here.
              </p>
              <div className="inline-flex rounded border border-line-strong bg-surface p-0.5" role="radiogroup" aria-label="Device">
                {(["desktop", "phone"] as const).map((d) => {
                  const Icon = d === "desktop" ? Monitor : Smartphone;
                  return (
                    <button key={d} type="button" role="radio" aria-checked={device === d} aria-label={d === "desktop" ? "Desktop" : "Phone"} onClick={() => setDevice(d)} className={cn("grid h-6 w-8 place-items-center rounded-[3px] transition-colors", device === d ? "bg-rail text-rail-fg" : "text-fg-3 hover:text-fg")}>
                      <Icon className="size-3.5" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </div>
            {preview}
          </div>
        </section>

        <aside aria-label="Editor" className="min-w-0 border-line bg-surface lg:sticky lg:top-0 lg:h-screen lg:flex-1 lg:overflow-y-auto lg:border-l xl:w-[400px] xl:flex-none 2xl:w-[440px]">
          <nav aria-label="Editor sections" className="sticky top-0 z-10 flex gap-1 border-b border-line bg-surface px-3">
            {tabs.map((t) => (
              <button key={t.key} type="button" aria-current={tab === t.key ? "true" : undefined} onClick={() => setTab(t.key)} className={cn("h-10 border-b-2 px-2.5 text-sm transition-colors duration-150", tab === t.key ? "border-rail font-medium text-fg" : "border-transparent text-fg-3 hover:text-fg")}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex flex-col gap-5 px-5 py-5">
            {tab === "content" && <ContentTab el={el} setEl={setEl} set={set} campaigns={campaigns} errors={errors} live={live} />}
            {tab === "style" && <StyleTab type={el.type} c={c} set={set} errors={errors} />}
            {tab === "rules" && <RulesTab c={c} set={set} errors={errors} />}
            {tab === "place" && <PlaceTab el={el} origin={origin} />}
          </div>
        </aside>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-30 flex flex-col bg-surface-2 xl:hidden" role="dialog" aria-modal="true" aria-label="Preview">
          <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
            <p className="text-sm font-medium">Preview</p>
            <button type="button" aria-label="Close preview" onClick={() => setPreviewOpen(false)} className="grid size-8 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg">
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{preview}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ editors ----------------------------- */

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-line pb-5 last:border-b-0 last:pb-0">
      <div>
        <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-fg-3">{title}</h2>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 text-sm">
      <span>
        {label}
        {hint && <span className="block text-xs text-fg-3">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-line-strong transition-colors duration-150 peer-checked:bg-rail peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-1 after:transition-transform after:duration-150 peer-checked:after:translate-x-4" />
    </label>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded bg-surface-2 p-0.5">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cn("h-7 flex-1 rounded-[4px] px-2 text-xs font-medium transition-colors duration-150", value === o.value ? "bg-rail text-rail-fg" : "text-fg-2 hover:text-fg")}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const dollarsIn = (cents: number) => (cents ? String(cents / 100) : "");
const centsOf = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^0-9.]/g, "")) * 100) || 0);

function MoneyField({ label, hint, value, onChange, id, error, placeholder = "Donor chooses" }: { label: string; hint?: string; value: number; onChange: (cents: number) => void; id: string; error?: string; placeholder?: string }) {
  const [text, setText] = useState(dollarsIn(value));
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-3">$</span>
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            setText(v);
            onChange(centsOf(v));
          }}
          className="num pl-7"
        />
      </div>
    </Field>
  );
}

function ContentTab({ el, setEl, set, campaigns, errors, live }: { el: DonationElement; setEl: React.Dispatch<React.SetStateAction<DonationElement>>; set: (p: Partial<DonationElementConfig>) => void; campaigns: { id: string; title: string; status: string }[]; errors: Record<string, string>; live: ElementLive }) {
  const c = el.config;
  const t = el.type;
  const err = (k: string) => errors[`config.${k}`] ?? errors[k];
  return (
    <>
      <Group title="Element">
        <Field label="Name" htmlFor="el-name" hint="Only your team sees this." error={errors.name}>
          <Input id="el-name" value={el.name} maxLength={80} onChange={(e) => setEl((x) => ({ ...x, name: e.target.value }))} />
        </Field>
        <Field label="Campaign" htmlFor="el-campaign" hint="Gifts go here, and the numbers come from here." error={errors.campaignId}>
          <Select id="el-campaign" value={el.campaignId} onChange={(e) => setEl((x) => ({ ...x, campaignId: e.target.value }))}>
            {campaigns.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.title}
                {cp.status !== "live" ? ` (${cp.status})` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </Group>

      {has(t, "button_group", "image_card", "goal_meter", "stat_counter", "donation_levels", "impact_slider", "recent_donations", "message_bar", "popup") && (
        <Group title="Words">
          <Field label={t === "message_bar" ? "Message" : t === "stat_counter" ? "Caption" : "Heading"} htmlFor="el-headline" error={err("headline")}>
            <Input id="el-headline" value={c.headline} maxLength={160} onChange={(e) => set({ headline: e.target.value })} />
          </Field>
          {has(t, "image_card", "popup") && (
            <Field label="Text" htmlFor="el-body" error={err("body")}>
              <Textarea id="el-body" value={c.body} maxLength={600} onChange={(e) => set({ body: e.target.value })} className="min-h-[84px]" />
            </Field>
          )}
          {has(t, "donate_button", "sticky_button", "image_card", "message_bar", "popup", "social_proof", "recent_donations") && (
            <Field label={t === "social_proof" ? "Link text" : "Button text"} htmlFor="el-label" hint={t === "recent_donations" ? "Leave empty for a list without a button." : undefined} error={err("label")}>
              <Input id="el-label" value={c.label} maxLength={40} onChange={(e) => set({ label: e.target.value })} />
            </Field>
          )}
        </Group>
      )}
      {has(t, "donate_button", "sticky_button", "social_proof") && (
        <Group title="Words">
          <Field label={t === "social_proof" ? "Link text" : "Button text"} htmlFor="el-label" error={err("label")}>
            <Input id="el-label" value={c.label} maxLength={40} onChange={(e) => set({ label: e.target.value })} />
          </Field>
        </Group>
      )}

      {has(t, "image_card", "popup") && <ImagePicker value={c.imageUrl} onChange={(imageUrl) => set({ imageUrl })} error={err("imageUrl")} />}

      {has(t, "button_group", "donation_levels", "impact_slider") && <LevelsEditor type={t} levels={c.levels} onChange={(levels) => set({ levels })} error={err("levels")} />}

      {giving.includes(t) && (
        <Group title="The gift" hint="What the checkout opens with.">
          <Choice
            label="How often"
            value={c.frequency}
            onChange={(frequency) => set({ frequency })}
            options={[
              { value: "campaign", label: `Campaign (${live.campaign.defaultFrequency === "monthly" ? "monthly" : "once"})` },
              { value: "one_time", label: "Once" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
          {has(t, "donate_button", "sticky_button", "image_card", "message_bar", "popup") && <MoneyField id="el-amount" label="Amount" hint="Empty lets the donor pick from the campaign's amounts." value={c.amountCents} onChange={(amountCents) => set({ amountCents })} error={err("amountCents")} />}
          {t === "button_group" && <Toggle label="Offer “Other amount”" checked={c.allowChange} onChange={(allowChange) => set({ allowChange })} />}
        </Group>
      )}

      {has(t, "goal_meter", "stat_counter") && (
        <Group title="The number">
          {t === "stat_counter" ? (
            <Field label="Show" htmlFor="el-metric">
              <Select id="el-metric" value={c.metric} onChange={(e) => set({ metric: e.target.value as DonationElementConfig["metric"] })}>
                <option value="raised">Amount raised</option>
                <option value="donors">Donors</option>
                <option value="gifts">Gifts</option>
                <option value="monthly_donors">Monthly donors</option>
                <option value="monthly_value">Monthly giving, per month</option>
              </Select>
            </Field>
          ) : (
            <Choice label="Track" value={c.metric === "donors" ? "donors" : "raised"} onChange={(metric) => set({ metric })} options={[{ value: "raised", label: "Amount raised" }, { value: "donors", label: "Donors" }]} />
          )}
          {(c.metric === "raised" || c.metric === "monthly_value") && <MoneyField id="el-offline" label="Add offline gifts" placeholder="0" hint="Cheques and cash, so the total is right." value={c.offlineCents} onChange={(offlineCents) => set({ offlineCents })} />}
          {t === "goal_meter" && (
            <>
              <Field label="Matching" htmlFor="el-match" hint="A 1:1 match doubles what the meter shows.">
                <Select id="el-match" value={String(c.match)} onChange={(e) => set({ match: Number(e.target.value) })}>
                  <option value="1">No match</option>
                  <option value="2">1:1 match (2x)</option>
                  <option value="3">2:1 match (3x)</option>
                </Select>
              </Field>
              <Toggle label="Show donor count" checked={c.showDonors} onChange={(showDonors) => set({ showDonors })} />
              <Toggle label="Show days left" checked={c.showDeadline} onChange={(showDeadline) => set({ showDeadline })} />
              {c.showDeadline && (
                <Field label="Ends on" htmlFor="el-deadline" error={err("deadline")}>
                  <Input id="el-deadline" type="date" value={c.deadline ?? ""} onChange={(e) => set({ deadline: e.target.value || undefined })} />
                </Field>
              )}
            </>
          )}
        </Group>
      )}

      {has(t, "recent_donations", "social_proof") && (
        <Group title="Donors" hint="Anonymous gifts never show.">
          <Field label="Names" htmlFor="el-names">
            <Select id="el-names" value={c.nameStyle} onChange={(e) => set({ nameStyle: e.target.value as DonationElementConfig["nameStyle"] })}>
              <option value="first_initial">First name, last initial (Maya R.)</option>
              <option value="initials">Initials only (M. R.)</option>
              <option value="hidden">Hide names (Someone)</option>
            </Select>
          </Field>
          <Toggle label="Show city and country" checked={c.showLocation} onChange={(showLocation) => set({ showLocation })} />
          {t === "recent_donations" && (
            <Field label="How many gifts" htmlFor="el-count">
              <Select id="el-count" value={String(c.count)} onChange={(e) => set({ count: Number(e.target.value) })}>
                {[3, 5, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </Group>
      )}

      {t === "donation_form" && (
        <Group title="Checkout" hint="The form uses the campaign's amounts, impact lines and designations. Change those on the campaign and every form follows." >
          <p className="text-xs text-fg-3">Colour comes from the Style tab.</p>
        </Group>
      )}
    </>
  );
}

function LevelsEditor({ type, levels, onChange, error }: { type: DonationElementType; levels: ElementLevel[]; onChange: (l: ElementLevel[]) => void; error?: string }) {
  const named = type === "donation_levels";
  const described = type !== "button_group";
  const patch = (id: string, p: Partial<ElementLevel>) => onChange(levels.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= levels.length) return;
    const xs = [...levels];
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
    onChange(xs);
  };
  return (
    <Group title={named ? "Levels" : "Amounts"} hint={type === "impact_slider" ? "Up to 6 stops; say what each one does." : undefined}>
      {error && (
        <p className="text-xs text-red" role="alert">
          {error}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {levels.map((l, i) => (
          <li key={l.id} className="rounded border border-line p-2.5">
            <div className="flex items-center gap-2">
              {named && <Input aria-label={`Level ${i + 1} name`} value={l.label} placeholder="Name" maxLength={40} onChange={(e) => patch(l.id, { label: e.target.value })} className="h-8 flex-1" />}
              <div className={cn("relative", named ? "w-[96px]" : "flex-1")}>
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-fg-3">$</span>
                <LevelAmount value={l.amountCents} onChange={(amountCents) => patch(l.id, { amountCents })} label={`Level ${i + 1} amount`} />
              </div>
              <span className="flex shrink-0">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg disabled:opacity-30">
                  <ArrowUp className="size-3.5" strokeWidth={2} />
                </button>
                <button type="button" aria-label="Move down" disabled={i === levels.length - 1} onClick={() => move(i, 1)} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-surface-2 hover:text-fg disabled:opacity-30">
                  <ArrowDown className="size-3.5" strokeWidth={2} />
                </button>
                <button type="button" aria-label="Remove" disabled={levels.length <= 2} onClick={() => onChange(levels.filter((x) => x.id !== l.id))} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-red-soft/60 hover:text-red disabled:opacity-30">
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              </span>
            </div>
            {described && <Input aria-label={`Level ${i + 1} impact`} value={l.description} placeholder="What it does" maxLength={240} onChange={(e) => patch(l.id, { description: e.target.value })} className="mt-2 h-8" />}
          </li>
        ))}
      </ol>
      {levels.length < (type === "impact_slider" ? 6 : 8) && (
        <button
          type="button"
          onClick={() => {
            const last = levels[levels.length - 1]?.amountCents ?? 5000;
            onChange([...levels, { id: levelId(), amountCents: last * 2, label: named ? "New level" : "", description: "" }]);
          }}
          className="inline-flex h-8 items-center gap-1.5 self-start rounded border border-dashed border-line-strong px-2.5 text-xs font-medium text-fg-2 hover:border-fg-3 hover:text-fg"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Add {named ? "level" : "amount"}
        </button>
      )}
    </Group>
  );
}

function LevelAmount({ value, onChange, label }: { value: number; onChange: (c: number) => void; label: string }) {
  const [text, setText] = useState(dollarsIn(value));
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.]/g, "");
        setText(v);
        onChange(centsOf(v));
      }}
      className="num h-8 pl-6"
    />
  );
}

function ImagePicker({ value, onChange, error }: { value?: string; onChange: (v?: string) => void; error?: string }) {
  const [url, setUrl] = useState(value && value.startsWith("https://") ? value : "");
  const [fileError, setFileError] = useState<string | null>(null);
  return (
    <Group title="Image">
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Image">
        {stockImages.map((s) => (
          <button key={s.url} type="button" role="radio" aria-checked={value === s.url} aria-label={s.label} onClick={() => onChange(s.url)} className={cn("relative aspect-[4/3] overflow-hidden rounded border transition-shadow", value === s.url ? "border-rail shadow-[0_0_0_1px_var(--rail)]" : "border-line hover:border-line-strong")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt="" className="size-full object-cover" />
            {value === s.url && (
              <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-rail text-rail-fg">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
      <Field label="Or an image link" htmlFor="el-image-url" error={error}>
        <Input
          id="el-image-url"
          value={url}
          placeholder="https://"
          onChange={(e) => {
            setUrl(e.target.value);
            if (e.target.value.startsWith("https://")) onChange(e.target.value.trim());
          }}
        />
      </Field>
      <div className="flex items-center gap-3">
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium hover:bg-surface-2">
          <Upload className="size-3.5" strokeWidth={2} />
          Upload a photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 1_500_000) return setFileError("Images up to 1.5 MB");
              setFileError(null);
              const r = new FileReader();
              r.onload = () => onChange(String(r.result));
              r.readAsDataURL(f);
            }}
          />
        </label>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="text-xs text-fg-3 underline-offset-2 hover:text-fg hover:underline">
            No image
          </button>
        )}
      </div>
      {fileError && (
        <p className="text-xs text-red" role="alert">
          {fileError}
        </p>
      )}
    </Group>
  );
}

function StyleTab({ type, c, set, errors }: { type: DonationElementType; c: DonationElementConfig; set: (p: Partial<DonationElementConfig>) => void; errors: Record<string, string> }) {
  const [hex, setHex] = useState(c.accent);
  const buttonish = has(type, "donate_button", "sticky_button");
  return (
    <>
      <Group title="Colour" hint="Match the site's own donate colour, not Lotus's.">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
          {accentPresets.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={c.accent.toLowerCase() === p}
              aria-label={p}
              onClick={() => {
                set({ accent: p });
                setHex(p);
              }}
              className={cn("grid size-8 place-items-center rounded-full ring-offset-2 transition-shadow", c.accent.toLowerCase() === p && "ring-2 ring-rail")}
              style={{ background: p }}
            >
              {c.accent.toLowerCase() === p && <Check className="size-3.5 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
        <Field label="Hex" htmlFor="el-hex" error={errors["config.accent"]}>
          <div className="flex items-center gap-2">
            <span className="size-9 shrink-0 rounded border border-line" style={{ background: isHex(hex) ? hex : c.accent }} aria-hidden />
            <Input
              id="el-hex"
              value={hex}
              maxLength={7}
              onChange={(e) => {
                const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                setHex(v);
                if (isHex(v)) set({ accent: v.toLowerCase() });
              }}
              aria-invalid={!isHex(hex)}
              className="num"
            />
          </div>
        </Field>
        {!buttonish && type !== "stat_counter" && <Choice label="Card" value={c.theme} onChange={(theme) => set({ theme })} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />}
      </Group>

      <Group title="Shape and size">
        <Choice label="Corners" value={c.shape} onChange={(shape) => set({ shape })} options={[{ value: "square", label: "Square" }, { value: "rounded", label: "Rounded" }, { value: "pill", label: "Round" }]} />
        {has(type, "donate_button", "sticky_button", "image_card", "stat_counter") && <Choice label="Size" value={c.size} onChange={(size) => set({ size })} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} />}
        {has(type, "donate_button", "stat_counter") && <Choice label="Align" value={c.align} onChange={(align) => set({ align })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]} />}
        {type === "donate_button" && <Toggle label="Fill the width" checked={c.fullWidth} onChange={(fullWidth) => set({ fullWidth })} />}
        {has(type, "donate_button", "sticky_button", "image_card", "message_bar", "popup", "donation_levels", "impact_slider", "recent_donations") && <Toggle label="Heart icon" checked={c.icon} onChange={(icon) => set({ icon })} />}
        {buttonish && <Toggle label="Beating heart" hint="The heart beats now and then. It stays still for visitors who ask for less motion." checked={c.pulse} onChange={(pulse) => set({ pulse })} />}
      </Group>

      {isOverlay(type) && (
        <Group title="Position">
          {type === "message_bar" ? (
            <Choice label="Edge" value={c.position === "bottom" ? "bottom" : "top"} onChange={(position) => set({ position })} options={[{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }]} />
          ) : type === "popup" ? (
            <p className="text-xs text-fg-3">Popups open in the middle of the window.</p>
          ) : (
            <Choice
              label="Corner"
              value={c.position === "bottom_left" ? "bottom_left" : c.position === "right_edge" && type === "sticky_button" ? "right_edge" : "bottom_right"}
              onChange={(position) => set({ position })}
              options={[{ value: "bottom_left", label: "Bottom left" }, { value: "bottom_right", label: "Bottom right" }, ...(type === "sticky_button" ? [{ value: "right_edge" as const, label: "Right edge" }] : [])]}
            />
          )}
        </Group>
      )}
    </>
  );
}

function RulesTab({ c, set, errors }: { c: DonationElementConfig; set: (p: Partial<DonationElementConfig>) => void; errors: Record<string, string> }) {
  return (
    <>
      <Group title="When it shows">
        <Field label="Trigger" htmlFor="el-trigger">
          <Select id="el-trigger" value={c.trigger} onChange={(e) => set({ trigger: e.target.value as DonationElementConfig["trigger"] })}>
            <option value="load">As soon as the page loads</option>
            <option value="delay">After a few seconds</option>
            <option value="scroll">After scrolling part of the page</option>
            <option value="exit">When the visitor is about to leave</option>
          </Select>
        </Field>
        {c.trigger === "delay" && (
          <Field label="Seconds" htmlFor="el-delay" error={errors["config.delaySeconds"]}>
            <Input id="el-delay" type="number" min={0} max={120} value={c.delaySeconds} onChange={(e) => set({ delaySeconds: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} className="num" />
          </Field>
        )}
        {c.trigger === "scroll" && (
          <Field label="Share of the page scrolled" htmlFor="el-scroll" hint={`${c.scrollPercent}%`}>
            <input id="el-scroll" type="range" min={0} max={100} step={5} value={c.scrollPercent} onChange={(e) => set({ scrollPercent: Number(e.target.value) })} className="accent-[var(--rail)]" />
          </Field>
        )}
        {c.trigger === "exit" && <p className="text-xs leading-relaxed text-fg-3">On desktop, when the pointer heads for the tabs or address bar. Phones have no pointer, so it shows after 12 seconds instead.</p>}
        <Choice label="Devices" value={c.devices} onChange={(devices) => set({ devices })} options={[{ value: "all", label: "All" }, { value: "desktop", label: "Desktop" }, { value: "mobile", label: "Phones" }]} />
        <p className="text-xs text-fg-3">Once a visitor closes it, it stays closed for the rest of their visit.</p>
      </Group>
      <Group title="Dates" hint="Leave empty to run until paused.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="el-start" error={errors["config.startsOn"]}>
            <Input id="el-start" type="date" value={c.startsOn ?? ""} onChange={(e) => set({ startsOn: e.target.value || undefined })} />
          </Field>
          <Field label="Until" htmlFor="el-end" error={errors["config.endsOn"] ?? errors.endsOn}>
            <Input id="el-end" type="date" value={c.endsOn ?? ""} onChange={(e) => set({ endsOn: e.target.value || undefined })} />
          </Field>
        </div>
      </Group>
      <Group title="Pages" hint="One per line. Use * for any part: /blog/*. Never-show wins.">
        <Field label="Only show on" htmlFor="el-show">
          <Textarea id="el-show" value={c.showOn.join("\n")} placeholder="Every page" onChange={(e) => set({ showOn: e.target.value.split("\n").slice(0, 20) })} className="num min-h-[72px]" />
        </Field>
        <Field label="Never show on" htmlFor="el-hide">
          <Textarea id="el-hide" value={c.hideOn.join("\n")} placeholder="/donate*" onChange={(e) => set({ hideOn: e.target.value.split("\n").slice(0, 20) })} className="num min-h-[72px]" />
        </Field>
      </Group>
    </>
  );
}

function PlaceTab({ el, origin }: { el: DonationElement; origin: string }) {
  const overlay = isOverlay(el.type);
  return (
    <>
      <Group title="1 · Install Lotus once" hint="Paste in the site's <head>. One script covers every element for this client.">
        <CodeBlock code={installScript(origin, el.accountId)} label="install script" />
      </Group>
      {overlay ? (
        <Group title="2 · Nothing else" hint="Overlays need no code. This one shows on every page with the script, by the rules on the Rules tab." >
          <p className="text-xs text-fg-3">Pause it here to take it off every site at once.</p>
        </Group>
      ) : (
        <Group title="2 · Place the element" hint="Paste where it should appear. Edits you save here reach every placement.">
          <CodeBlock code={placeholder(el.id)} label="placeholder" />
        </Group>
      )}
      <Group title="Donate link" hint="Make any link or button on the site open this element's checkout, keeping the site's own styling.">
        <CopyField value={donateLink(el.id)} label="Donate link" />
        <CodeBlock code={`<a href="${donateLink(el.id)}">Donate</a>`} label="link example" />
      </Group>
      {!overlay && (
        <Group title="Lotus funnels and websites" hint="Add a Donation element block and pick this element. No script needed.">
          <p className="num text-xs text-fg-3">{elementSummary(el)}</p>
        </Group>
      )}
      <a href={`/e/${el.id}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 self-start rounded border border-line-strong bg-surface px-2.5 text-xs font-medium hover:bg-surface-2">
        <ExternalLink className="size-3.5" strokeWidth={2} />
        Open the element on its own
      </a>
    </>
  );
}
