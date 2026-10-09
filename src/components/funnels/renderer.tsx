import type { Funnel, FunnelBlock, FunnelStep } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * One renderer for the editor preview and the public page. The brand colour
 * is a CSS variable on the root; everything else is paper, ink and Geist so a
 * client page looks finished without a designer.
 */

const fieldLabel: Record<string, { label: string; type: string; placeholder: string }> = {
  name: { label: "Name", type: "text", placeholder: "Your name" },
  email: { label: "Email", type: "email", placeholder: "you@example.com" },
  phone: { label: "Phone", type: "tel", placeholder: "(303) 555-0142" },
  address: { label: "Address", type: "text", placeholder: "Street, city" },
  message: { label: "What do you need?", type: "textarea", placeholder: "A sentence or two about the job" },
  amount: { label: "Amount", type: "amount", placeholder: "50" },
};

function Button({ children, href, className }: { children: React.ReactNode; href?: string; className?: string }) {
  const cls = cn("inline-flex h-12 items-center justify-center rounded-md bg-[var(--fb)] px-6 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90", className);
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button type="submit" className={cls}>
      {children}
    </button>
  );
}

export function Block({ block, formAction, preview }: { block: FunnelBlock; formAction?: (fd: FormData) => void | Promise<void>; preview?: boolean }) {
  switch (block.type) {
    case "hero":
      return (
        <section className={cn("px-6 pb-16 pt-20 md:pb-24 md:pt-28", block.align === "center" ? "text-center" : "")}>
          <div className={cn("mx-auto", block.align === "center" ? "max-w-[760px]" : "max-w-[1040px]")}>
            <div className={block.align === "center" ? "" : "max-w-[640px]"}>
            {block.eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--fb)]">{block.eyebrow}</p>}
            <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-[#0f1221] md:text-5xl">{block.headline}</h1>
            {block.subhead && <p className="mt-5 text-lg leading-relaxed text-[#4b4f63] md:text-xl">{block.subhead}</p>}
            {block.buttonLabel && (
              <div className="mt-8">
                <Button href={block.buttonHref || "#form"}>{block.buttonLabel}</Button>
              </div>
            )}
            </div>
          </div>
        </section>
      );
    case "stats":
      return (
        <section className="border-y border-[#e9e7e1] bg-white px-6 py-10">
          <dl className="mx-auto grid max-w-[900px] grid-cols-1 gap-8 text-center sm:grid-cols-3">
            {block.items.map((it, i) => (
              <div key={i}>
                <dd className="text-4xl font-semibold tracking-tight text-[#0f1221]" style={{ fontVariantNumeric: "tabular-nums" }}>{it.value}</dd>
                <dt className="mt-1 text-sm text-[#6b6f83]">{it.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      );
    case "features":
      return (
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-[960px]">
            {block.headline && <h2 className="text-2xl font-semibold tracking-tight text-[#0f1221] md:text-3xl">{block.headline}</h2>}
            <div className={cn("grid gap-8 sm:grid-cols-3", block.headline && "mt-10")}>
              {block.items.map((it, i) => (
                <div key={i} className="border-t-2 border-[var(--fb)] pt-4">
                  <h3 className="text-base font-semibold text-[#0f1221]">{it.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#4b4f63]">{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "testimonial":
      return (
        <section className="bg-white px-6 py-16">
          <figure className="mx-auto max-w-[760px] text-center">
            <blockquote className="text-2xl font-medium leading-snug tracking-tight text-[#0f1221] md:text-3xl">“{block.quote}”</blockquote>
            <figcaption className="mt-5 text-sm text-[#6b6f83]">
              <span className="font-semibold text-[#0f1221]">{block.name}</span>
              {block.detail && ` · ${block.detail}`}
            </figcaption>
          </figure>
        </section>
      );
    case "text":
      return (
        <section className="px-6 py-14">
          <div className="mx-auto max-w-[680px]">
            {block.headline && <h2 className="text-2xl font-semibold tracking-tight text-[#0f1221]">{block.headline}</h2>}
            <p className="mt-4 text-base leading-relaxed text-[#4b4f63] md:text-lg">{block.body}</p>
          </div>
        </section>
      );
    case "faq":
      return (
        <section className="px-6 py-14">
          <div className="mx-auto max-w-[680px] divide-y divide-[#e9e7e1] border-y border-[#e9e7e1]">
            {block.items.map((it, i) => (
              <details key={i} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-[#0f1221]">
                  {it.q}
                  <span aria-hidden className="text-[#6b6f83] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[#4b4f63]">{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-[760px] rounded-xl bg-[#0f1221] px-8 py-12 text-center text-white">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{block.headline}</h2>
            {block.body && <p className="mt-3 text-base text-white/75">{block.body}</p>}
            <div className="mt-7">
              <Button href={block.buttonHref || "#form"}>{block.buttonLabel}</Button>
            </div>
          </div>
        </section>
      );
    case "form":
      return (
        <section id="form" className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-[560px] rounded-xl border border-[#e9e7e1] bg-white p-6 shadow-[0_1px_2px_rgba(15,18,33,0.04),0_8px_24px_rgba(15,18,33,0.06)] md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-[#0f1221]">{block.headline}</h2>
            {block.subhead && <p className="mt-1.5 text-sm text-[#6b6f83]">{block.subhead}</p>}
            <form action={preview ? undefined : formAction} className="mt-6 flex flex-col gap-4">
              {block.fields.map((f) => {
                const meta = fieldLabel[f]!;
                const cls = "h-11 w-full rounded-md border border-[#d9d7d0] bg-white px-3.5 text-base text-[#0f1221] placeholder:text-[#9a9db0] focus:border-[var(--fb)] focus:outline-none focus:ring-2 focus:ring-[var(--fb)]/20";
                return (
                  <label key={f} className="flex flex-col gap-1.5 text-sm font-medium text-[#0f1221]">
                    {meta.label}
                    {meta.type === "textarea" ? (
                      <textarea name={f} placeholder={meta.placeholder} className={cn(cls, "h-auto min-h-[96px] py-2.5")} disabled={preview} />
                    ) : meta.type === "amount" ? (
                      <div className="flex gap-2">
                        {["25", "50", "100", "250"].map((a) => (
                          <label key={a} className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border border-[#d9d7d0] text-base font-semibold text-[#0f1221] has-[:checked]:border-[var(--fb)] has-[:checked]:bg-[var(--fb)] has-[:checked]:text-white">
                            <input type="radio" name={f} value={a} defaultChecked={a === "50"} className="sr-only" disabled={preview} />${a}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input name={f} type={meta.type} placeholder={meta.placeholder} required={f === "name" || f === "email" || f === "phone"} className={cls} disabled={preview} />
                    )}
                  </label>
                );
              })}
              <Button className="mt-2 w-full">{block.buttonLabel}</Button>
              {block.note && <p className="text-center text-xs text-[#6b6f83]">{block.note}</p>}
            </form>
          </div>
        </section>
      );
    case "footer":
      return (
        <footer className="px-6 py-10 text-center text-sm text-[#6b6f83]">
          {block.text}
          <span className="mx-2">·</span>
          <span>Built with Lotus</span>
        </footer>
      );
  }
}

export function FunnelPage({
  funnel,
  step,
  formAction,
  preview,
  selectedId,
  onSelectBlock,
  className,
}: {
  funnel: Pick<Funnel, "brandColor" | "name">;
  step: FunnelStep;
  formAction?: (fd: FormData) => void | Promise<void>;
  preview?: boolean;
  /** Editor only: outline this block and let a click select another. */
  selectedId?: string | null;
  onSelectBlock?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("min-h-full bg-[#faf9f6] font-sans text-[#0f1221] antialiased", className)} style={{ ["--fb" as string]: funnel.brandColor }}>
      {step.blocks.map((b) =>
        onSelectBlock ? (
          <div
            key={b.id}
            data-block={b.id}
            onClick={() => onSelectBlock(b.id)}
            className={cn("relative cursor-pointer outline-offset-[-2px] transition-[outline-color] duration-100", selectedId === b.id ? "outline outline-2 outline-[#7c3aed]" : "hover:outline hover:outline-2 hover:outline-[#7c3aed]/40")}
          >
            <Block block={b} formAction={formAction} preview={preview} />
          </div>
        ) : (
          <Block key={b.id} block={b} formAction={formAction} preview={preview} />
        ),
      )}
      {step.blocks.length === 0 && <p className="px-6 py-20 text-center text-sm text-[#6b6f83]">This page has no blocks yet.</p>}
    </div>
  );
}
