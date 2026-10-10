"use client";

import { useEffect, useRef, useState } from "react";

/* The few parts of a built page that need the browser: timers and the popup. */

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/**
 * A date countdown ends at a fixed moment; an evergreen one starts on the
 * visitor's first view and is remembered in their browser, so a refresh does
 * not reset it.
 */
export function Countdown({ mode, until, minutes, expired, storageKey }: { mode: "date" | "evergreen"; until?: string; minutes?: number; expired: string; storageKey: string }) {
  const [now, setNow] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  useEffect(() => {
    let e: number;
    if (mode === "date") e = until ? Date.parse(until) : Date.now();
    else {
      const k = `lb-cd-${storageKey}`;
      let start = Date.now();
      try {
        const saved = Number(localStorage.getItem(k));
        if (saved > 0) start = saved;
        else localStorage.setItem(k, String(start));
      } catch {
        /* private mode: count from this view */
      }
      e = start + (minutes ?? 15) * 60_000;
    }
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(() => {
      setEnd(e);
      tick();
    }, 0);
    const t = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [mode, until, minutes, storageKey]);

  const left = end !== null && now !== null ? end - now : mode === "evergreen" ? (minutes ?? 15) * 60_000 : null;
  if (left !== null && left <= 0 && end !== null) return <p className="lb-p" style={{ fontWeight: 600 }}>{expired}</p>;
  const v = parts(left ?? 0);
  const cells = [
    ...(v.d > 0 || mode === "date" ? [{ n: v.d, l: "Days" }] : []),
    { n: v.h, l: "Hours" },
    { n: v.m, l: "Min" },
    { n: v.s, l: "Sec" },
  ];
  return (
    <div className="lb-cd" role="timer" aria-live="off">
      {cells.map((c) => (
        <div key={c.l}>
          <b suppressHydrationWarning>{left === null ? "--" : String(c.n).padStart(2, "0")}</b>
          <span>{c.l}</span>
        </div>
      ))}
    </div>
  );
}

/** Opens on exit intent or after a delay, once per visit; any "popup" button opens it too. */
export function PopupHost({ trigger, delaySeconds, enabled, children }: { trigger: "exit" | "delay"; delaySeconds: number; enabled: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const shown = useRef(false);
  useEffect(() => {
    const show = () => {
      if (shown.current) return;
      shown.current = true;
      setOpen(true);
    };
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as HTMLElement).closest("[data-lb-popup]");
      if (a) {
        ev.preventDefault();
        shown.current = true;
        setOpen(true);
      }
    };
    document.addEventListener("click", onClick);
    let t: number | undefined;
    const onLeave = (ev: MouseEvent) => {
      if (ev.clientY <= 0) show();
    };
    if (enabled) {
      if (trigger === "delay") t = window.setTimeout(show, delaySeconds * 1000);
      else document.documentElement.addEventListener("mouseleave", onLeave);
    }
    return () => {
      document.removeEventListener("click", onClick);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      if (t) window.clearTimeout(t);
    };
  }, [trigger, delaySeconds, enabled]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="lb-pop" data-open={open ? "" : undefined} id="lb-popup" role="dialog" aria-modal="true" aria-hidden={!open} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="lb-pop-box">
        <button type="button" className="lb-pop-x" aria-label="Close" onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

/** Keeps a visitor on the same split-test version across visits. */
export function StickVariant({ stepId, variant }: { stepId: string; variant: "a" | "b" }) {
  useEffect(() => {
    document.cookie = `lb_v_${stepId}=${variant}; path=/; max-age=${60 * 60 * 24 * 60}; samesite=lax`;
  }, [stepId, variant]);
  return null;
}
