"use client";

import { useSyncExternalStore } from "react";

/**
 * Which hero to render.
 *  full  — WebGL scene, 7k points with glow halos (desktop with a real GPU)
 *  lite  — WebGL scene, 3k points, no halos, capped pixel ratio (phones, small laptops)
 *  still — no WebGL: the pre-rendered still over the water (reduced motion, no GPU, data saver)
 * Decided once on the client; the server renders only the HTML layer ("pending").
 * Override for testing with ?hero=full|lite|still.
 */
export type HeroMode = "pending" | "full" | "lite" | "still";

export const HERO_POINTS: Record<Exclude<HeroMode, "pending" | "still">, number> = { full: 7000, lite: 3000 };

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function detectHeroMode(): HeroMode {
  const forced = new URLSearchParams(window.location.search).get("hero");
  if (forced === "full" || forced === "lite" || forced === "still") return forced;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "still";
  if (!hasWebGL()) return "still";

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  if (nav.connection?.saveData || cores <= 2 || memory <= 2) return "still";

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = window.innerWidth < 820;
  if (coarse || small || cores <= 4 || memory <= 4) return "lite";
  return "full";
}

let cached: HeroMode | null = null;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => {
    cached = null;
    onChange();
  };
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}

function getSnapshot(): HeroMode {
  if (cached === null) cached = detectHeroMode();
  return cached;
}

function getServerSnapshot(): HeroMode {
  return "pending";
}

export function useHeroMode(): HeroMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
