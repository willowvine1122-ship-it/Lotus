"use client";

import { useCallback, useEffect, useState } from "react";

function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * The right-hand detail panel on every board. On desktop it is docked beside
 * the table and shown by default; on phones it is a sheet that opens on row
 * click. X or Esc closes both, and choosing a row brings it back.
 */
export function useDetailPanel(initiallyDocked = true) {
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(initiallyDocked);

  const show = useCallback(() => {
    setOpen(true);
    setDocked(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setDocked(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || typing(e.target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  return { open, docked, show, close };
}
