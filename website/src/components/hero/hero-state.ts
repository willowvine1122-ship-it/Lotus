/**
 * Shared, mutable hero state. GSAP writes to it (scroll scrub, entrance tween) and the
 * three.js frame loop reads it. A plain object, not React state, so nothing re-renders per frame.
 */
export interface Ripple {
  x: number;
  z: number;
  t: number; // scene time at impact (seconds)
  strength: number;
}

export const heroState = {
  /** 0 → 1 as the points rise out of the water and gather into the mark. */
  enter: 0,
  /** 0 → 1 across the pinned scroll: mark → counting number → three petals. */
  scroll: 0,
  /** Pointer in normalized device coords, for parallax. */
  pointer: { x: 0, y: 0, active: false },
  ripples: [] as Ripple[],
};

export const MAX_RIPPLES = 8;

export function pushRipple(r: Ripple) {
  heroState.ripples.push(r);
  if (heroState.ripples.length > MAX_RIPPLES) heroState.ripples.shift();
}

/** Scroll choreography boundaries (fractions of the pinned scroll). Keep in sync with rise-hero.tsx. */
export const PHASES = {
  toNumber: 0.18, // mark streams down into the first number frame
  counting: 0.52, // number ticks up through the frames
  hold: 0.62, // the full number holds
  toPetals: 0.94, // splits into three petals
} as const;
