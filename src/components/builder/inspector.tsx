"use client";

import { Monitor, Smartphone } from "lucide-react";
import type { BuilderColumn, BuilderElement, BuilderFieldKey, BuilderPopup, BuilderProduct, BuilderRow, BuilderSection, BuilderStyle, BuilderTheme, BuilderFont } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddButton, Area, Color, Group, MiniButtons, Money, Num, Pick, Row, Seg, StringList, Text, Toggle, ctl, move } from "./fields";
import { fonts, rowLayouts, setRowLayout, uid, videoEmbed, type NodeKind } from "./model";
import type { RenderRefs } from "./render";
import { photos } from "./templates";

/* The right-hand panel: what the selected thing says, and how it looks. */

export type Device = "desktop" | "phone";

const swatchesFor = (t: BuilderTheme) => [
  { value: "var(--lb-primary)", label: "Brand", show: t.primary },
  { value: "var(--lb-ink)", label: "Ink", show: t.ink },
  { value: "var(--lb-muted)", label: "Muted", show: t.muted },
  { value: "var(--lb-bg)", label: "Page", show: t.background },
  { value: "#ffffff", label: "White", show: "#ffffff" },
];

/* ------------------------------ content ------------------------------ */

const fieldChoices: { key: BuilderFieldKey; label: string }[] = [
  { key: "name", label: "Full name" },
  { key: "first_name", label: "First name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "company", label: "Company" },
  { key: "website", label: "Website" },
  { key: "message", label: "Message" },
  { key: "amount", label: "Gift amount" },
];

function ActionFields({ action, href, onChange, context }: { action: string; href?: string; onChange: (p: { action?: string; href?: string }) => void; context: "funnel" | "site" }) {
  return (
    <>
      <Row label="When clicked">
        <Pick
          label="When clicked"
          value={action}
          onChange={(v) => onChange({ action: v })}
          options={[
            ...(context === "funnel" ? [{ value: "next", label: "Go to the next step" }] : []),
            { value: "scroll", label: "Scroll to a section or form" },
            { value: "link", label: "Open a link" },
            { value: "popup", label: "Open the popup" },
          ]}
        />
      </Row>
      {(action === "link" || action === "scroll") && (
        <Row label={action === "link" ? "Link" : "Scroll to"} hint={action === "link" ? "A full address, /a-page, mailto: or tel:" : "#form goes to the first form on the page."}>
          <Text label="Target" value={href ?? ""} placeholder={action === "link" ? "https://" : "#form"} onChange={(v) => onChange({ href: v })} />
        </Row>
      )}
    </>
  );
}

function ProductFields({ p, onChange, label }: { p: BuilderProduct; onChange: (p: BuilderProduct) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded border border-line bg-surface-2/40 p-2.5">
      <Text label={`${label} name`} value={p.name} onChange={(name) => onChange({ ...p, name })} />
      <div className="grid grid-cols-2 gap-1.5">
        <Money label={`${label} price`} cents={p.priceCents} onChange={(priceCents) => onChange({ ...p, priceCents })} />
        <Pick
          label={`${label} billing`}
          value={p.interval ?? "once"}
          onChange={(interval) => onChange({ ...p, interval })}
          options={[
            { value: "once", label: "One time" },
            { value: "month", label: "Monthly" },
            { value: "year", label: "Yearly" },
          ]}
        />
      </div>
    </div>
  );
}

export function ContentPanel({ e, onChange, refs, context }: { e: BuilderElement; onChange: (e: BuilderElement) => void; refs: RenderRefs; context: "funnel" | "site" }) {
  const set = (patch: Partial<BuilderElement>) => onChange({ ...e, ...patch } as BuilderElement);
  switch (e.type) {
    case "headline":
      return (
        <Group title="Headline">
          <Row label="Text" hint="Double-click the headline on the page to type in place.">
            <Area label="Headline text" value={e.text} rows={3} onChange={(text) => set({ text })} />
          </Row>
          <Row label="Level">
            <Seg label="Level" value={e.tag} onChange={(tag) => set({ tag })} options={(["h1", "h2", "h3", "h4"] as const).map((t) => ({ value: t, label: t.toUpperCase() }))} />
          </Row>
        </Group>
      );
    case "text":
      return (
        <Group title="Paragraph">
          <Row label="Text">
            <Area label="Paragraph text" value={e.text} rows={6} onChange={(text) => set({ text })} />
          </Row>
        </Group>
      );
    case "button":
      return (
        <Group title="Button">
          <Row label="Label">
            <Text label="Label" value={e.label} onChange={(label) => set({ label })} />
          </Row>
          <Row label="Second line" hint="Optional, smaller, under the label.">
            <Text label="Second line" value={e.sub ?? ""} onChange={(sub) => set({ sub: sub || undefined })} />
          </Row>
          <ActionFields action={e.action} href={e.href} context={context} onChange={(p) => set(p as Partial<BuilderElement>)} />
          <Row label="Look">
            <Seg label="Look" value={e.variant} onChange={(variant) => set({ variant })} options={[{ value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }]} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Size">
              <Seg label="Size" value={e.size} onChange={(size) => set({ size })} options={[{ value: "md", label: "M" }, { value: "lg", label: "L" }]} />
            </Row>
            <Row label="Width">
              <Seg label="Width" value={e.full ? "full" : "fit"} onChange={(v) => set({ full: v === "full" })} options={[{ value: "fit", label: "Fit" }, { value: "full", label: "Full" }]} />
            </Row>
          </div>
        </Group>
      );
    case "image":
      return (
        <Group title="Image">
          <Row label="Image address" hint="Paste any https image link, or pick one below.">
            <Text label="Image address" value={e.src} placeholder="https://" onChange={(src) => set({ src })} />
          </Row>
          <div className="grid grid-cols-4 gap-1.5">
            {Object.entries(photos).map(([k, url]) => (
              <button key={k} type="button" onClick={() => set({ src: url })} className={cn("aspect-square overflow-hidden rounded border border-line", e.src === url && "ring-2 ring-brand ring-offset-1")} aria-label={`Use photo ${k}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url.replace("w=1200", "w=160")} alt="" className="size-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          <Row label="Alt text" hint="Read aloud by screen readers. Describe the photo.">
            <Text label="Alt text" value={e.alt} onChange={(alt) => set({ alt })} />
          </Row>
          <Row label="Shape">
            <Seg label="Shape" value={e.ratio} onChange={(ratio) => set({ ratio })} options={[{ value: "auto", label: "Free" }, { value: "16/9", label: "16:9" }, { value: "4/3", label: "4:3" }, { value: "1/1", label: "1:1" }, { value: "3/4", label: "3:4" }]} />
          </Row>
          <Row label="Link" hint="Optional.">
            <Text label="Image link" value={e.href ?? ""} placeholder="https://" onChange={(href) => set({ href: href || undefined })} />
          </Row>
        </Group>
      );
    case "video":
      return (
        <Group title="Video">
          <Row label="Video link" hint={e.url && !videoEmbed(e.url) ? "That link isn't a YouTube, Vimeo or Loom video." : "YouTube, Vimeo or Loom."}>
            <Text label="Video link" value={e.url} placeholder="https://youtube.com/watch?v=…" onChange={(url) => set({ url })} />
          </Row>
        </Group>
      );
    case "list":
      return (
        <Group title="Bullet list">
          <Row label="Marker">
            <Seg label="Marker" value={e.icon} onChange={(icon) => set({ icon })} options={[{ value: "check", label: "Tick" }, { value: "dot", label: "Dot" }, { value: "arrow", label: "Arrow" }, { value: "x", label: "Cross" }]} />
          </Row>
          <StringList items={e.items} onChange={(items) => set({ items })} addLabel="Add a point" />
        </Group>
      );
    case "form":
      return (
        <Group title="Opt-in form">
          <p className="text-[11px] leading-4 text-fg-3">Every submission creates or updates a contact and moves the visitor to the next step.</p>
          <div className="flex flex-col gap-1.5">
            {e.fields.map((f, i) => (
              <div key={f.key} className="flex items-center gap-1 rounded border border-line bg-surface px-2 py-1">
                <input aria-label={`${f.key} label`} className="h-6 min-w-0 flex-1 bg-transparent text-[13px] focus:outline-none" value={f.label} onChange={(ev) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} />
                <button type="button" onClick={() => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, required: !x.required } : x)) })} className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", f.required ? "bg-surface-2 text-fg" : "text-fg-3 hover:text-fg")} aria-pressed={f.required}>
                  {f.required ? "Required" : "Optional"}
                </button>
                <MiniButtons index={i} count={e.fields.length} onMove={(d) => set({ fields: move(e.fields, i, d) })} onRemove={() => set({ fields: e.fields.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          {fieldChoices.some((c) => !e.fields.some((f) => f.key === c.key)) && (
            <Row label="Add a field">
              <select
                aria-label="Add a field"
                className={ctl}
                value=""
                onChange={(ev) => {
                  const c = fieldChoices.find((x) => x.key === ev.target.value);
                  if (c) set({ fields: [...e.fields, { key: c.key, label: c.label, required: false }] });
                }}
              >
                <option value="">Choose…</option>
                {fieldChoices
                  .filter((c) => !e.fields.some((f) => f.key === c.key))
                  .map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
              </select>
            </Row>
          )}
          <Row label="Button">
            <Text label="Button" value={e.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} />
          </Row>
          <Row label="Note under the button">
            <Text label="Note" value={e.note ?? ""} onChange={(note) => set({ note: note || undefined })} />
          </Row>
        </Group>
      );
    case "divider":
      return (
        <Group title="Divider">
          <p className="text-[11px] text-fg-3">A hairline. Set its colour and space in Style.</p>
        </Group>
      );
    case "spacer":
      return (
        <Group title="Spacer">
          <Row label="Height">
            <Num label="Height" value={e.height} min={4} max={400} onChange={(h) => set({ height: h ?? 32 })} />
          </Row>
        </Group>
      );
    case "countdown":
      return (
        <Group title="Countdown">
          <Row label="Counts down to">
            <Seg label="Counts down to" value={e.mode} onChange={(mode) => set({ mode })} options={[{ value: "evergreen", label: "Per visitor" }, { value: "date", label: "A date" }]} />
          </Row>
          {e.mode === "date" ? (
            <Row label="Ends">
              <input type="datetime-local" aria-label="Ends" className={ctl} value={e.until?.slice(0, 16) ?? ""} onChange={(ev) => set({ until: ev.target.value ? new Date(ev.target.value).toISOString() : undefined })} />
            </Row>
          ) : (
            <Row label="Minutes from first visit" hint="Each visitor gets their own clock, kept across refreshes.">
              <Num label="Minutes" value={e.minutes} min={1} max={10080} step={5} unit="min" onChange={(minutes) => set({ minutes: minutes ?? 15 })} />
            </Row>
          )}
          <Row label="When it ends">
            <Text label="When it ends" value={e.expired} onChange={(expired) => set({ expired })} />
          </Row>
        </Group>
      );
    case "testimonial":
      return (
        <Group title="Testimonial">
          <Row label="Quote">
            <Area label="Quote" value={e.quote} rows={4} onChange={(quote) => set({ quote })} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Name">
              <Text label="Name" value={e.name} onChange={(name) => set({ name })} />
            </Row>
            <Row label="Stars">
              <Seg label="Stars" value={e.rating ?? 0} onChange={(rating) => set({ rating: rating || undefined })} options={[{ value: 0, label: "None" }, { value: 5, label: "5" }]} />
            </Row>
          </div>
          <Row label="Detail">
            <Text label="Detail" value={e.detail ?? ""} placeholder="Homeowner, Austin" onChange={(detail) => set({ detail: detail || undefined })} />
          </Row>
          <Row label="Photo" hint="Optional. Initials show without one.">
            <Text label="Photo" value={e.avatar ?? ""} placeholder="https://" onChange={(avatar) => set({ avatar: avatar || undefined })} />
          </Row>
        </Group>
      );
    case "faq":
      return (
        <Group title="FAQ">
          {e.items.map((it, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded border border-line bg-surface-2/40 p-2">
              <div className="flex items-center gap-1">
                <input aria-label={`Question ${i + 1}`} className={ctl} value={it.q} onChange={(ev) => set({ items: e.items.map((x, j) => (j === i ? { ...x, q: ev.target.value } : x)) })} />
                <MiniButtons index={i} count={e.items.length} onMove={(d) => set({ items: move(e.items, i, d) })} onRemove={() => set({ items: e.items.filter((_, j) => j !== i) })} />
              </div>
              <Area label={`Answer ${i + 1}`} value={it.a} rows={2} onChange={(a) => set({ items: e.items.map((x, j) => (j === i ? { ...x, a } : x)) })} />
            </div>
          ))}
          <AddButton onClick={() => set({ items: [...e.items, { q: "A new question?", a: "The answer." }] })}>Add a question</AddButton>
        </Group>
      );
    case "stat":
      return (
        <Group title="Number">
          <Row label="Figure">
            <Text label="Figure" value={e.value} onChange={(value) => set({ value })} />
          </Row>
          <Row label="Label">
            <Text label="Label" value={e.label} onChange={(label) => set({ label })} />
          </Row>
        </Group>
      );
    case "pricing":
      return (
        <Group title="Pricing card">
          <Row label="Plan">
            <Text label="Plan" value={e.name} onChange={(name) => set({ name })} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Price">
              <Text label="Price" value={e.price} onChange={(price) => set({ price })} />
            </Row>
            <Row label="Per">
              <Text label="Per" value={e.period ?? ""} placeholder="/month" onChange={(period) => set({ period: period || undefined })} />
            </Row>
          </div>
          <Row label="One line">
            <Text label="One line" value={e.blurb ?? ""} onChange={(blurb) => set({ blurb: blurb || undefined })} />
          </Row>
          <Row label="Features">
            <StringList items={e.features} onChange={(features) => set({ features })} addLabel="Add a feature" />
          </Row>
          <Row label="Button">
            <Text label="Button" value={e.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} />
          </Row>
          <ActionFields action={e.action} href={e.href} context={context} onChange={(p) => set(p as Partial<BuilderElement>)} />
          <Toggle label="Feature this plan" hint="Brand border and a Most popular tag." checked={!!e.featured} onChange={(featured) => set({ featured })} />
        </Group>
      );
    case "order":
      return (
        <>
          <Group title="Products">
            <p className="text-[11px] leading-4 text-fg-3">Buyers pick one. Payments run in test mode until Stripe is connected; every order is recorded and the buyer lands in Contacts.</p>
            {e.products.map((p, i) => (
              <div key={p.id} className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <ProductFields label={`Product ${i + 1}`} p={p} onChange={(np) => set({ products: e.products.map((x) => (x.id === p.id ? np : x)) })} />
                </div>
                <MiniButtons index={i} count={e.products.length} onMove={(d) => set({ products: move(e.products, i, d) })} onRemove={() => e.products.length > 1 && set({ products: e.products.filter((x) => x.id !== p.id) })} />
              </div>
            ))}
            <AddButton onClick={() => set({ products: [...e.products, { id: uid("p"), name: "Another option", priceCents: 9700, interval: "once" }] })}>Add a product</AddButton>
          </Group>
          <Group title="Order bump" aside={<Toggle label="" checked={!!e.bump} onChange={(on) => set({ bump: on ? { product: { id: uid("p"), name: "A small add-on", priceCents: 1700, interval: "once" }, pitch: "Yes, add this to my order." } : undefined })} />}>
            {e.bump ? (
              <>
                <ProductFields label="Bump" p={e.bump.product} onChange={(product) => set({ bump: { ...e.bump!, product } })} />
                <Row label="Checkbox line">
                  <Text label="Checkbox line" value={e.bump.pitch} onChange={(pitch) => set({ bump: { ...e.bump!, pitch } })} />
                </Row>
              </>
            ) : (
              <p className="text-[11px] text-fg-3">A one-tick add-on beside the pay button. Most funnels see one in five buyers take it.</p>
            )}
          </Group>
          <Group title="Button">
            <Text label="Button" value={e.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} />
            <Row label="Guarantee line">
              <Text label="Guarantee" value={e.guarantee ?? ""} onChange={(guarantee) => set({ guarantee: guarantee || undefined })} />
            </Row>
          </Group>
        </>
      );
    case "upsell":
      return (
        <Group title="One-click upsell">
          <p className="text-[11px] leading-4 text-fg-3">Yes adds the product to the order from the step before, without asking for the card again. Both buttons move to the next step.</p>
          <ProductFields label="Upsell" p={e.product} onChange={(product) => set({ product })} />
          <Row label="Yes button">
            <Text label="Yes button" value={e.yesLabel} onChange={(yesLabel) => set({ yesLabel })} />
          </Row>
          <Row label="No link">
            <Text label="No link" value={e.noLabel} onChange={(noLabel) => set({ noLabel })} />
          </Row>
        </Group>
      );
    case "progress":
      return (
        <Group title="Progress bar">
          <Row label="Filled">
            <Num label="Filled" value={e.value} min={0} max={100} step={5} unit="%" onChange={(v) => set({ value: v ?? 0 })} />
          </Row>
          <Row label="Label">
            <Text label="Label" value={e.label} onChange={(label) => set({ label })} />
          </Row>
        </Group>
      );
    case "logos":
      return (
        <Group title="Logo bar">
          <StringList items={e.names} onChange={(names) => set({ names })} addLabel="Add a name" />
        </Group>
      );
    case "html":
      return (
        <Group title="Custom code">
          <p className="text-[11px] leading-4 text-fg-3">Runs in its own sandboxed frame, so it can&apos;t reach the page, the visitor&apos;s cookies or Lotus.</p>
          <Area label="HTML" value={e.html} rows={10} mono onChange={(html) => set({ html })} />
          <Row label="Frame height">
            <Num label="Frame height" value={e.height} min={40} max={2000} step={10} onChange={(height) => set({ height: height ?? 120 })} />
          </Row>
        </Group>
      );
    case "lotus_form":
      return (
        <Group title="Lotus form">
          <Row label="Form" hint="Built in Forms. Responses land there and in Contacts.">
            <Pick label="Form" value={e.formId} onChange={(formId) => set({ formId })} options={[{ value: "", label: "Choose a form" }, ...(refs.forms ?? []).map((f) => ({ value: f.id, label: `${f.name}${f.live ? "" : " (draft)"}` }))]} />
          </Row>
        </Group>
      );
    case "calendar":
      return (
        <Group title="Calendar">
          <Row label="Calendar" hint="Visitors pick a time; the booking lands in Calendars.">
            <Pick label="Calendar" value={e.calendarSlug} onChange={(calendarSlug) => set({ calendarSlug })} options={[{ value: "", label: "Choose a calendar" }, ...(refs.calendars ?? []).map((c) => ({ value: c.slug, label: c.name }))]} />
          </Row>
        </Group>
      );
    case "donation_element":
      return (
        <Group title="Donation element">
          <Row label="Element" hint="Built in Elements. Edits there reach every page that places it.">
            <Pick label="Element" value={e.elementId} onChange={(elementId) => set({ elementId })} options={[{ value: "", label: "Choose an element" }, ...(refs.elements ?? []).map((x) => ({ value: x.id, label: `${x.name} · ${x.typeLabel}${x.live ? "" : " (paused)"}` }))]} />
          </Row>
        </Group>
      );
  }
}

/* ------------------------------ layout content ------------------------------ */

export function SectionContent({ s, onChange }: { s: BuilderSection; onChange: (s: BuilderSection) => void }) {
  return (
    <Group title="Section">
      <Row label="Name" hint="Shown in Layers. Scroll buttons can target it.">
        <Text label="Section name" value={s.name ?? ""} placeholder="Untitled section" onChange={(name) => onChange({ ...s, name: name || undefined })} />
      </Row>
      <Row label="Anchor" hint="Link to this section with this address.">
        <input readOnly className={cn(ctl, "num bg-surface-2/50 text-fg-2")} value={`#${s.id}`} onFocus={(e) => e.currentTarget.select()} aria-label="Anchor" />
      </Row>
    </Group>
  );
}

function Spans({ spans }: { spans: number[] }) {
  return (
    <span className="flex h-4 w-full gap-[2px]">
      {spans.map((n, i) => (
        <span key={i} className="h-full rounded-[2px] bg-current opacity-60" style={{ flex: n }} />
      ))}
    </span>
  );
}

export function RowContent({ r, onChange }: { r: BuilderRow; onChange: (r: BuilderRow) => void }) {
  const current = r.columns.map((c) => c.span).join(",");
  return (
    <Group title="Row">
      <Row label="Columns" hint="Columns stack on phones. Extra columns fold their elements into the last one.">
        <div className="grid grid-cols-3 gap-1.5">
          {rowLayouts.map((l) => (
            <button key={l.key} type="button" title={l.label} aria-label={l.label} aria-pressed={current === l.spans.join(",")} onClick={() => onChange(setRowLayout(r, l.spans))} className={cn("flex h-9 items-center rounded border px-2 transition-colors", current === l.spans.join(",") ? "border-brand bg-brand-soft/60 text-brand" : "border-line-strong text-fg-3 hover:bg-surface-2")}>
              <Spans spans={l.spans} />
            </button>
          ))}
        </div>
      </Row>
      <Row label="Space between columns">
        <Num label="Gap" value={r.gap} max={120} onChange={(gap) => onChange({ ...r, gap })} placeholder="32" />
      </Row>
    </Group>
  );
}

export function ColumnContent({ c, onChange }: { c: BuilderColumn; onChange: (c: BuilderColumn) => void }) {
  return (
    <Group title="Column">
      <Row label="Line up content">
        <Seg label="Vertical alignment" value={c.valign ?? "top"} onChange={(valign) => onChange({ ...c, valign })} options={[{ value: "top", label: "Top" }, { value: "center", label: "Middle" }, { value: "bottom", label: "Bottom" }]} />
      </Row>
      <p className="text-[11px] text-fg-3">Change widths from the row: select the row above.</p>
    </Group>
  );
}

/* ------------------------------ style ------------------------------ */

export function StylePanel({ kind, node, device, theme, onChange, elType }: { kind: NodeKind; node: { style?: BuilderStyle; mobile?: BuilderStyle }; device: Device; theme: BuilderTheme; onChange: (n: { style?: BuilderStyle; mobile?: BuilderStyle }) => void; elType?: BuilderElement["type"] }) {
  const phone = device === "phone";
  const st: BuilderStyle = (phone ? node.mobile : node.style) ?? {};
  const base: BuilderStyle = node.style ?? {};
  const set = (patch: Partial<BuilderStyle>) => {
    const next = { ...st, ...patch };
    for (const k of Object.keys(next) as (keyof BuilderStyle)[]) if (next[k] === undefined) delete next[k];
    onChange(phone ? { ...node, mobile: Object.keys(next).length ? next : undefined } : { ...node, style: next });
  };
  const sw = swatchesFor(theme);
  const ph = (k: keyof BuilderStyle) => (phone && base[k] !== undefined ? String(base[k]) : undefined);
  const textish = kind !== "element" || ["headline", "text", "list", "button", "stat", "testimonial", "faq", "countdown", "logos"].includes(elType ?? "");
  const hasOverrides = !!node.mobile && Object.keys(node.mobile).length > 0;
  return (
    <div>
      <div className={cn("flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs", phone ? "bg-amber-soft/50 text-amber" : "text-fg-3")}>
        {phone ? <Smartphone className="size-3.5" strokeWidth={1.75} /> : <Monitor className="size-3.5" strokeWidth={1.75} />}
        <span className="flex-1">{phone ? "Phone only. Empty fields follow desktop." : "Desktop, and phones unless overridden."}</span>
        {phone && hasOverrides && (
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => onChange({ ...node, mobile: undefined })}>
            Clear phone
          </button>
        )}
      </div>
      {kind === "section" && (
        <Group title="Width">
          <Seg label="Content width" value={st.maxWidth ?? (phone ? undefined : 1080)} onChange={(maxWidth) => set({ maxWidth })} options={[{ value: 560, label: "Form" }, { value: 760, label: "Narrow" }, { value: 1080, label: "Wide" }, { value: 1320, label: "Full" }]} />
        </Group>
      )}
      <Group title="Spacing">
        <div className="grid grid-cols-2 gap-2">
          <Row label={kind === "section" ? "Top" : "Padding top"}>
            <Num label="Padding top" value={st.padTop} onChange={(padTop) => set({ padTop })} placeholder={ph("padTop")} />
          </Row>
          <Row label={kind === "section" ? "Bottom" : "Padding bottom"}>
            <Num label="Padding bottom" value={st.padBottom} onChange={(padBottom) => set({ padBottom })} placeholder={ph("padBottom")} />
          </Row>
          <Row label="Sides">
            <Num label="Padding sides" value={st.padX} max={200} onChange={(padX) => set({ padX })} placeholder={ph("padX")} />
          </Row>
          {kind !== "section" && (
            <Row label="Space above">
              <Num label="Margin top" value={st.marginTop} min={-200} onChange={(marginTop) => set({ marginTop })} placeholder={ph("marginTop")} />
            </Row>
          )}
          {kind !== "section" && (
            <Row label="Space below">
              <Num label="Margin bottom" value={st.marginBottom} min={-200} onChange={(marginBottom) => set({ marginBottom })} placeholder={ph("marginBottom")} />
            </Row>
          )}
        </div>
      </Group>
      {textish && (
        <Group title="Text">
          <Row label="Align">
            <Seg label="Align" value={st.align} onChange={(align) => set({ align: st.align === align ? undefined : align })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Size">
              <Num label="Font size" value={st.fontSize} min={8} max={160} step={1} onChange={(fontSize) => set({ fontSize })} placeholder={ph("fontSize")} />
            </Row>
            <Row label="Line height">
              <Num label="Line height" value={st.lineHeight} min={0.8} max={3} step={0.05} unit="" onChange={(lineHeight) => set({ lineHeight })} placeholder={ph("lineHeight")} />
            </Row>
          </div>
          <Row label="Weight">
            <Seg label="Weight" value={st.weight} onChange={(weight) => set({ weight: st.weight === weight ? undefined : weight })} options={[{ value: 400, label: "Regular" }, { value: 500, label: "Medium" }, { value: 600, label: "Semi" }, { value: 700, label: "Bold" }]} />
          </Row>
          <Row label={elType === "button" ? "Label colour" : "Colour"}>
            <Color label="Text colour" value={st.color} swatches={sw} onChange={(color) => set({ color })} />
          </Row>
        </Group>
      )}
      <Group title={elType === "button" ? "Button colour" : "Background"}>
        <Color label="Background" value={st.bg} swatches={sw} onChange={(bg) => set({ bg })} />
        {elType !== "button" && (
          <>
            <Row label="Background image">
              <Text label="Background image" value={st.bgImage ?? ""} placeholder="https://" onChange={(bgImage) => set({ bgImage: bgImage || undefined })} />
            </Row>
            {st.bgImage && (
              <Row label={`Darken the image · ${Math.round((st.overlay ?? 0) * 100)}%`}>
                <input type="range" aria-label="Darken" min={0} max={0.9} step={0.05} value={st.overlay ?? 0} onChange={(e) => set({ overlay: Number(e.target.value) || undefined })} className="w-full accent-[var(--brand)]" />
              </Row>
            )}
          </>
        )}
      </Group>
      <Group title="Border and corners">
        <div className="grid grid-cols-2 gap-2">
          <Row label="Border">
            <Num label="Border width" value={st.borderWidth} max={12} step={1} onChange={(borderWidth) => set({ borderWidth })} placeholder={ph("borderWidth") ?? "0"} />
          </Row>
          <Row label="Corners">
            <Num label="Corner radius" value={st.radius} max={80} step={2} onChange={(radius) => set({ radius })} placeholder={ph("radius")} />
          </Row>
        </div>
        {!!st.borderWidth && <Color label="Border colour" value={st.borderColor} swatches={sw} onChange={(borderColor) => set({ borderColor })} />}
        {elType !== "button" && (
          <Row label="Shadow">
            <Seg label="Shadow" value={st.shadow ?? "none"} onChange={(shadow) => set({ shadow: shadow === "none" ? undefined : shadow })} options={[{ value: "none", label: "None" }, { value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }]} />
          </Row>
        )}
      </Group>
      <Group title="Visibility">
        <Toggle label={phone ? "Hide on phones" : "Hide on desktop"} hint={phone ? "Still shows on desktop." : "Still shows on phones. Switch to phone view to hide it there."} checked={!!st.hidden} onChange={(hidden) => set({ hidden: hidden || undefined })} />
      </Group>
    </div>
  );
}

/* ------------------------------ theme and page ------------------------------ */

export function ThemePanel({ theme, onChange }: { theme: BuilderTheme; onChange: (t: BuilderTheme) => void }) {
  const fontOpts = (Object.keys(fonts) as BuilderFont[]).map((f) => ({ value: f, label: fonts[f].label }));
  const plain = (v: string) => [{ value: v, label: "Current", show: v }];
  return (
    <div>
      <Group title="Colours">
        <Row label="Brand" hint="Buttons, ticks, links and the order bump.">
          <Color label="Brand" value={theme.primary} swatches={plain(theme.primary)} allowClear={false} onChange={(v) => v && onChange({ ...theme, primary: v })} />
        </Row>
        <Row label="Headings">
          <Color label="Headings" value={theme.ink} swatches={plain(theme.ink)} allowClear={false} onChange={(v) => v && onChange({ ...theme, ink: v })} />
        </Row>
        <Row label="Body text">
          <Color label="Body text" value={theme.muted} swatches={plain(theme.muted)} allowClear={false} onChange={(v) => v && onChange({ ...theme, muted: v })} />
        </Row>
        <Row label="Page background">
          <Color label="Page background" value={theme.background} swatches={plain(theme.background)} allowClear={false} onChange={(v) => v && onChange({ ...theme, background: v })} />
        </Row>
      </Group>
      <Group title="Type">
        <Row label="Headings">
          <Pick label="Heading font" value={theme.headingFont} onChange={(headingFont) => onChange({ ...theme, headingFont })} options={fontOpts} />
        </Row>
        <Row label="Body">
          <Pick label="Body font" value={theme.bodyFont} onChange={(bodyFont) => onChange({ ...theme, bodyFont })} options={fontOpts} />
        </Row>
      </Group>
      <Group title="Corners">
        <div className="grid grid-cols-2 gap-2">
          <Row label="Cards and images">
            <Num label="Card radius" value={theme.radius} max={32} step={2} onChange={(radius) => onChange({ ...theme, radius: radius ?? 10 })} />
          </Row>
          <Row label="Buttons">
            <Num label="Button radius" value={theme.buttonRadius} max={40} step={2} onChange={(buttonRadius) => onChange({ ...theme, buttonRadius: buttonRadius ?? 8 })} />
          </Row>
        </div>
      </Group>
      <p className="px-4 py-3 text-[11px] leading-4 text-fg-3">Elements that set their own colour or size keep it.</p>
    </div>
  );
}

export function PopupSettings({ popup, onChange }: { popup: BuilderPopup; onChange: (p: BuilderPopup) => void }) {
  return (
    <Group title="Popup">
      <Toggle label="Show the popup to visitors" hint="Off, it still opens from any button set to Open the popup." checked={popup.enabled} onChange={(enabled) => onChange({ ...popup, enabled })} />
      <Row label="Opens">
        <Seg label="Opens" value={popup.trigger} onChange={(trigger) => onChange({ ...popup, trigger })} options={[{ value: "exit", label: "When leaving" }, { value: "delay", label: "After a delay" }]} />
      </Row>
      {popup.trigger === "delay" && (
        <Row label="Delay">
          <Num label="Delay" value={popup.delaySeconds ?? 8} min={1} max={120} step={1} unit="sec" onChange={(delaySeconds) => onChange({ ...popup, delaySeconds: delaySeconds ?? 8 })} />
        </Row>
      )}
    </Group>
  );
}
