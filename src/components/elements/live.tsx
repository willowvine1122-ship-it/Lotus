"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import { Checkout } from "@/components/donate/checkout";
import { isOverlay } from "@/lib/elements";
import type { DonationElementConfig, DonationElementType } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ElementLive } from "./data";
import { ElementView, type DonateIntent } from "./render";

/*
 * A placed element. On a Lotus funnel or website it opens the checkout in a
 * modal on the same page. Inside the iframe the install script creates on
 * someone else's site, it tells the host page its size and asks the host to
 * open the checkout, so the modal covers the whole window, not the iframe.
 * Overlays wait for their trigger: the host decides when on other sites
 * (it can see scroll and exit intent), the element decides on Lotus pages.
 */

export interface PlacedElement {
  id: string;
  type: DonationElementType;
  config: DonationElementConfig;
}

type Track = (id: string, kind: "view" | "open") => Promise<void>;

const accentVars = (accent: string) => ({ ["--brand" as string]: accent, ["--brand-hover" as string]: `color-mix(in srgb, ${accent} 88%, black)` }) as React.CSSProperties;

function post(msg: Record<string, unknown>) {
  window.parent.postMessage({ lotus: true, ...msg }, "*");
}

export function LiveElement({ element, live, nowIso, track }: { element: PlacedElement; live: ElementLive; nowIso: string; track?: Track }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const { id, type, config: c } = element;
  const overlay = isOverlay(type);
  const [framed, setFramed] = useState(false);
  const [open, setOpen] = useState<DonateIntent | null>(null);
  const [shown, setShown] = useState(!overlay);
  const [closed, setClosed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  // Framed or not is only knowable in the browser.
  useEffect(() => {
    const f = window.parent !== window;
    const t = setTimeout(() => setFramed(f), 0);
    return () => clearTimeout(t);
  }, []);

  // One view per page load, once the element is actually on screen.
  useEffect(() => {
    if (!shown || seen.current || !track) return;
    seen.current = true;
    track(id, "view").catch(() => {});
  }, [shown, id, track]);

  // In a frame: report overlay rules once, listen for the host's "show".
  useEffect(() => {
    if (!framed) return;
    post({
      kind: "ready",
      id,
      overlay,
      type,
      position: c.position,
      rules: overlay ? { trigger: c.trigger, delay: c.delaySeconds, scroll: c.scrollPercent, devices: c.devices, startsOn: c.startsOn, endsOn: c.endsOn, showOn: c.showOn, hideOn: c.hideOn } : null,
    });
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { lotus?: boolean; kind?: string; id?: string };
      if (!d?.lotus || d.id !== id) return;
      if (d.kind === "show") setShown(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [framed, id, overlay, type, c]);

  // In a frame: tell the host the element's size whenever it changes (and once it is shown).
  useEffect(() => {
    if (!framed) return;
    const el = box.current;
    if (!el) return;
    const send = () => {
      const r = el.getBoundingClientRect();
      post({ kind: "size", id, w: Math.ceil(r.width), h: Math.ceil(r.height) });
    };
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, [framed, id, shown]);

  // On a Lotus page an overlay runs its own trigger.
  useEffect(() => {
    if (!overlay || framed || closed) return;
    if (c.devices !== "all" && (window.innerWidth < 768) !== (c.devices === "mobile")) return;
    const show = () => setShown(true);
    if (c.trigger === "load") return void setTimeout(show, 0);
    if (c.trigger === "delay") {
      const t = setTimeout(show, Math.max(0, c.delaySeconds) * 1000);
      return () => clearTimeout(t);
    }
    if (c.trigger === "scroll") {
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max <= 0 || window.scrollY / max >= c.scrollPercent / 100) show();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => window.removeEventListener("scroll", onScroll);
    }
    const onOut = (e: MouseEvent) => {
      if (e.clientY <= 0) show();
    };
    document.addEventListener("mouseout", onOut);
    const t = window.innerWidth < 768 ? setTimeout(show, 12000) : undefined;
    return () => {
      document.removeEventListener("mouseout", onOut);
      if (t) clearTimeout(t);
    };
  }, [overlay, framed, closed, c]);

  const donate = (intent: DonateIntent) => {
    track?.(id, "open").catch(() => {});
    if (framed) post({ kind: "donate", id, campaign: live.campaign.slug, amount: intent.amountCents ?? 0, frequency: intent.frequency ?? "", accent: c.accent });
    else setOpen(intent);
  };
  const close = () => {
    setShown(false);
    setClosed(true);
    if (framed) post({ kind: "hide", id });
  };

  const view = (
    <ElementView
      type={type}
      c={c}
      live={live}
      now={now}
      onDonate={donate}
      onClose={overlay && type !== "sticky_button" ? close : undefined}
      form={type === "donation_form" ? <Checkout campaign={live.campaign} orgName={live.orgName} defaultCountry={live.defaultCountry} start={{ elementId: id, frequency: c.frequency === "campaign" ? undefined : c.frequency }} /> : undefined}
    />
  );

  let body: React.ReactNode;
  if (!overlay) body = <div ref={box}>{view}</div>;
  else if (framed) {
    // The host sizes and places the frame; the element just fills it.
    body = shown ? (
      type === "popup" ? (
        <div ref={box} className="fixed inset-0 grid place-items-center bg-black/45 p-4" onClick={(e) => e.target === e.currentTarget && close()}>
          {view}
        </div>
      ) : (
        <div ref={box} className={cn("inline-block p-3", type === "message_bar" && "block w-full p-0")}>
          {view}
        </div>
      )
    ) : (
      <div ref={box} />
    );
  } else {
    body = shown ? <OverlayPlacement type={type} position={c.position} onBackdrop={close}>{view}</OverlayPlacement> : null;
  }

  return (
    <>
      {body}
      {open && <CheckoutModal live={live} accent={c.accent} start={{ ...open, elementId: id }} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Where an overlay sits when it is drawn on the page itself. */
export function OverlayPlacement({ type, position, onBackdrop, contained, children }: { type: DonationElementType; position: DonationElementConfig["position"]; onBackdrop?: () => void; contained?: boolean; children: React.ReactNode }) {
  const pos = contained ? "absolute" : "fixed";
  if (type === "popup") {
    return (
      <div className={cn(pos, "inset-0 z-40 grid place-items-center bg-black/45 p-4")} onClick={(e) => e.target === e.currentTarget && onBackdrop?.()}>
        {children}
      </div>
    );
  }
  if (type === "message_bar") {
    return <div className={cn(pos, "inset-x-0 z-40", position === "bottom" ? "bottom-0" : "top-0")}>{children}</div>;
  }
  const corner = {
    bottom_right: "bottom-4 right-4",
    bottom_left: "bottom-4 left-4",
    right_edge: "right-0 top-1/2 -translate-y-1/2 [&_.el-btn]:origin-bottom-right",
    top: "top-4 right-4",
    bottom: "bottom-4 right-4",
  }[position];
  return <div className={cn(pos, "z-40", corner)}>{children}</div>;
}

/** The checkout over the page, in the element's colour. */
export function CheckoutModal({ live, accent, start, onClose, framed }: { live: ElementLive; accent: string; start: DonateIntent & { elementId?: string }; onClose: () => void; framed?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className={cn("fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center", framed ? "bg-black/50" : "bg-black/45")} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Donate to ${live.orgName}`} className="my-auto w-full max-w-[440px] outline-none focus-visible:outline-none" style={accentVars(accent)}>
        <div className="mb-2 flex items-center justify-between gap-3 text-white">
          <p className="min-w-0 truncate text-sm font-medium">{live.orgName}</p>
          <span className="flex items-center gap-2">
            <span className="hidden items-center gap-1 text-xs text-white/75 sm:inline-flex">
              <Lock className="size-3" strokeWidth={2} />
              Secure
            </span>
            <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white/25">
              <X className="size-4" strokeWidth={2} />
            </button>
          </span>
        </div>
        <div className="shadow-[0_24px_60px_-12px_rgb(0_0_0/0.5)]">
          <Checkout campaign={live.campaign} orgName={live.orgName} defaultCountry={live.defaultCountry} start={start} />
        </div>
        <p className="mt-2 text-center text-xs text-white/70">Powered by Lotus</p>
      </div>
    </div>
  );
}
