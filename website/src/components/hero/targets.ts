/**
 * Builds the world-space target sets the particles move between:
 * start (under the water) → mark → number frames (counting up) → three petals.
 * All sets share one index: point i has one slot in every set.
 */
import { brand } from "@/lib/brand";
import {
  PART_BY_INDEX,
  makeRng,
  mirrorShape,
  rotateShape,
  sampleMark,
  samplePetal,
  sampleText,
  sortShapeByX,
  uprightShape,
  type Shape,
} from "./sampling";

export const NUMBER_FRAMES = 8;

export interface HeroShapes {
  mark: Shape;
  numbers: Shape[]; // NUMBER_FRAMES frames, sorted by x
  /** Left, center and right petal: one fan, 1 unit tall each. */
  petals: [Shape, Shape, Shape];
  count: number;
}

export interface HeroLayout {
  /** World units visible at the mark plane. */
  width: number;
  height: number;
  waterY: number;
  compact: boolean;
}

export interface HeroTargets {
  count: number;
  seed: Float32Array;
  size: Float32Array;
  start: Float32Array;
  mark: Float32Array;
  numbers: Float32Array[];
  petals: Float32Array;
  markColor: Float32Array;
  numberColor: Float32Array;
  petalColor: Float32Array;
  /** World position of the drop cut-out's tip, where the drip falls from. */
  drip: { x: number; y: number };
  markCenter: { x: number; y: number };
  markWidth: number;
}

/** Counting frames: the placeholder number ticks up through these values (eased, so it slows into the final figure). */
export function countingValues(final: number, frames = NUMBER_FRAMES): number[] {
  const out: number[] = [];
  for (let k = 0; k < frames; k++) {
    const t = k / (frames - 1);
    const eased = 1 - Math.pow(1 - t, 2.2);
    out.push(Math.round(final * eased));
  }
  out[frames - 1] = final;
  return out;
}

/** Sample every shape once (client only). Independent of viewport, so it survives resizes. */
export async function buildShapes(count: number, finalNumber: number, fontFamily: string): Promise<HeroShapes> {
  const rng = makeRng(20261020);
  const mark = sampleMark(count, rng);
  const values = countingValues(finalNumber);
  const numbers = values.map((v) => sortShapeByX(sampleText(String(v), fontFamily, count, rng)));
  // One petal from the logo, stood upright; the outer two lean away from it like a lotus opening.
  const base = uprightShape(samplePetal(Math.ceil(count / 3), rng));
  const lean = 0.42;
  const center = sortShapeByX(base, 24);
  const right = sortShapeByX(rotateShape(base, -lean), 24);
  const left = sortShapeByX(mirrorShape(rotateShape(base, -lean)), 24);
  return { mark, numbers, petals: [left, center, right], count };
}

/** Hex → 0..1 sRGB components. The point shaders write straight to the canvas, so no linear conversion here. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Lay the sampled shapes out in world units for the current viewport. Cheap; runs on resize. */
export function layoutTargets(shapes: HeroShapes, layout: HeroLayout): HeroTargets {
  const { count } = shapes;
  const rng = makeRng(7);
  const W = layout.width;
  const compact = layout.compact;

  // Mark: right of center on wide screens (copy sits left), centered and lower on phones (copy sits above).
  const markWidth = compact ? Math.min(W * 0.72, 3.0) : Math.min(W * 0.36, 4.6);
  const markCenter = compact ? { x: 0, y: -1.0 } : { x: W * 0.2, y: 0.5 };

  // Number: centered, big. Petals: a row in the lower half, where the three cards arrive.
  const numberWidth = compact ? Math.min(W * 0.86, 4.2) : Math.min(W * 0.58, 6.4);
  const numberCenter = { x: 0, y: compact ? 0.1 : 0.35 };
  const petalHeight = compact ? Math.min(W * 0.42, 1.35) : Math.min(W * 0.19, 2.1);
  const petalSpread = compact ? Math.min(W * 0.3, 1.3) : Math.min(W * 0.3, 3.6);
  const petalY = compact ? -0.9 : -0.5;

  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  const start = new Float32Array(count * 3);
  const mark = new Float32Array(count * 3);
  const petals = new Float32Array(count * 3);
  const markColor = new Float32Array(count * 3);
  const numberColor = new Float32Array(count * 3);
  const petalColor = new Float32Array(count * 3);
  const numbers = shapes.numbers.map(() => new Float32Array(count * 3));

  // Logo part colors, lifted part way toward the reverse (dark background) tones: additive light
  // from many points brightens them the rest of the way.
  const lift = (part: keyof typeof brand.mark) => mix(rgb(brand.mark[part]), rgb(brand.markReverse[part]), 0.45);
  const partColors: Record<string, [number, number, number]> = {
    petal: lift("petal"),
    petalOverlap: mix(rgb(brand.plum), rgb(brand.rose), 0.3),
    wSide: lift("wSide"),
    wCenter: lift("wCenter"),
    wLeg: lift("wLeg"),
    wShadow: lift("wShadow"),
  };
  const numberTint = mix(rgb(brand.rose), rgb(brand.paper), 0.42);
  const streamColors: [number, number, number][] = [rgb(brand.leafLight), rgb(brand.blueLight), rgb(brand.violetLight)];
  const streamColorsDeep: [number, number, number][] = [rgb(brand.leaf), rgb(brand.blue), rgb(brand.violet)];

  const third = Math.ceil(count / 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    seed[i] = rng();
    size[i] = 0.5 + rng() * 0.7;
    if (rng() < 0.08) size[i] *= 1.9; // a few bright stars among the dust

    // Under the water, spread across the stage.
    start[i3] = (rng() - 0.5) * Math.max(W * 1.15, markWidth * 2.2);
    start[i3 + 1] = layout.waterY - 0.4 - rng() * 2.6;
    start[i3 + 2] = (rng() - 0.5) * 2.5;

    // The mark, with each point colored by the logo part it was sampled from.
    mark[i3] = markCenter.x + shapes.mark.xs[i] * markWidth;
    mark[i3 + 1] = markCenter.y + shapes.mark.ys[i] * markWidth;
    mark[i3 + 2] = (rng() - 0.5) * 0.12;
    const partName = PART_BY_INDEX[shapes.mark.part[i]] ?? "petal";
    const pc = partColors[partName];
    markColor[i3] = pc[0];
    markColor[i3 + 1] = pc[1];
    markColor[i3 + 2] = pc[2];

    // Number frames (all sorted by x, so point i stays near its x column while the digits change).
    for (let k = 0; k < numbers.length; k++) {
      const sh = shapes.numbers[k];
      numbers[k][i3] = numberCenter.x + sh.xs[i] * numberWidth;
      numbers[k][i3 + 1] = numberCenter.y + sh.ys[i] * numberWidth;
      numbers[k][i3 + 2] = (rng() - 0.5) * 0.1;
    }
    const nt = mix(numberTint, rgb(brand.paper), rng() * 0.3);
    numberColor[i3] = nt[0];
    numberColor[i3 + 1] = nt[1];
    numberColor[i3 + 2] = nt[2];

    // Petals: left third of the final number flows to the left petal, and so on.
    const stream = Math.min(2, Math.floor(i / third));
    const j = i - stream * third;
    const px = (stream - 1) * petalSpread;
    const petalShape = shapes.petals[stream];
    const pj = j % petalShape.count;
    petals[i3] = px + petalShape.xs[pj] * petalHeight;
    petals[i3 + 1] = petalY + petalShape.ys[pj] * petalHeight;
    petals[i3 + 2] = (rng() - 0.5) * 0.15;
    const sc = mix(streamColors[stream], streamColorsDeep[stream], rng() * 0.5);
    petalColor[i3] = sc[0];
    petalColor[i3 + 1] = sc[1];
    petalColor[i3 + 2] = sc[2];
  }

  // The drop cut-out's tip sits at the mark's bottom center (0.248 of the width below its center).
  const drip = { x: markCenter.x, y: markCenter.y - 0.248 * markWidth };

  return { count, seed, size, start, mark, numbers, petals, markColor, numberColor, petalColor, drip, markCenter, markWidth };
}
