/**
 * Point sampling for the hero. Shapes (the logo mark, a petal, a number) are rasterized to an
 * offscreen 2D canvas and opaque pixels become candidate points. Output is normalized so the
 * shape is 1 unit wide, centered on its bounding box, y up. Targets are then scaled into world units.
 */
import { MARK_PATHS, MARK_VIEWBOX, type MarkPart } from "./mark-paths";

export interface Shape {
  /** Normalized x, width = 1, centered. */
  xs: Float32Array;
  /** Normalized y (same scale as x), centered, up is positive. */
  ys: Float32Array;
  /** Part id per point (index into the ids passed to the rasterizer; 0 when unused). */
  part: Uint8Array;
  count: number;
  /** Height / width of the shape. */
  aspect: number;
}

/** Small deterministic RNG (mulberry32), so a given seed always produces the same cloud. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PART_INDEX: Record<MarkPart, number> = {
  petal: 1,
  petalOverlap: 2,
  wSide: 3,
  wCenter: 4,
  wLeg: 5,
  wShadow: 6,
};

export const PART_BY_INDEX: MarkPart[] = ["petal", "petal", "petalOverlap", "wSide", "wCenter", "wLeg", "wShadow"];

function partColor(index: number) {
  // Encode the part index in the red channel, spaced so anti-aliased edges round to a real id.
  return `rgb(${index * 36}, 0, 0)`;
}

function rasterize(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  count: number,
  rng: () => number,
): Shape {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.clearRect(0, 0, width, height);
  draw(ctx);

  const { data } = ctx.getImageData(0, 0, width, height);
  const candX: number[] = [];
  const candY: number[] = [];
  const candP: number[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (data[o + 3] < 128) continue;
      candX.push(x);
      candY.push(y);
      candP.push(Math.round(data[o] / 36));
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const total = candX.length;
  if (total === 0) throw new Error("Rasterized shape has no opaque pixels");

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const cx = minX + w / 2;
  const cy = minY + h / 2;
  const scale = 1 / w;

  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const part = new Uint8Array(count);

  // Sample without replacement where possible (partial Fisher–Yates), with replacement otherwise.
  const order = new Uint32Array(total);
  for (let i = 0; i < total; i++) order[i] = i;
  for (let i = 0; i < count; i++) {
    let pick: number;
    if (i < total) {
      const j = i + Math.floor(rng() * (total - i));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
      pick = order[i];
    } else {
      pick = Math.floor(rng() * total);
    }
    const jx = candX[pick] + rng();
    const jy = candY[pick] + rng();
    xs[i] = (jx - cx) * scale;
    ys[i] = -(jy - cy) * scale;
    part[i] = candP[pick];
  }
  return { xs, ys, part, count, aspect: h / w };
}

/** Sort points by x (then y) so index neighbors are spatial neighbors; morphs between sets stay calm. */
export function sortShapeByX(shape: Shape, bins = 48): Shape {
  const idx = Array.from({ length: shape.count }, (_, i) => i);
  idx.sort((a, b) => {
    const ba = Math.floor((shape.xs[a] + 0.5) * bins);
    const bb = Math.floor((shape.xs[b] + 0.5) * bins);
    return ba - bb || shape.ys[a] - shape.ys[b];
  });
  const xs = new Float32Array(shape.count);
  const ys = new Float32Array(shape.count);
  const part = new Uint8Array(shape.count);
  idx.forEach((src, dst) => {
    xs[dst] = shape.xs[src];
    ys[dst] = shape.ys[src];
    part[dst] = shape.part[src];
  });
  return { ...shape, xs, ys, part };
}

/** Re-center a shape on its bounding box and scale it so it is 1 unit tall. */
export function normalizeHeight(shape: Shape): Shape {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < shape.count; i++) {
    const x = shape.xs[i], y = shape.ys[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = Math.max(1e-6, maxX - minX), h = Math.max(1e-6, maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, k = 1 / h;
  const xs = new Float32Array(shape.count), ys = new Float32Array(shape.count);
  for (let i = 0; i < shape.count; i++) {
    xs[i] = (shape.xs[i] - cx) * k;
    ys[i] = (shape.ys[i] - cy) * k;
  }
  return { ...shape, xs, ys, aspect: h / w };
}

/** Rotate a shape counterclockwise by `angle` radians (about its center), then re-center. */
export function rotateShape(shape: Shape, angle: number): Shape {
  const c = Math.cos(angle), s = Math.sin(angle);
  const xs = new Float32Array(shape.count), ys = new Float32Array(shape.count);
  for (let i = 0; i < shape.count; i++) {
    const x = shape.xs[i], y = shape.ys[i];
    xs[i] = x * c - y * s;
    ys[i] = x * s + y * c;
  }
  return normalizeHeight({ ...shape, xs, ys });
}

/** Mirror a shape left-right. */
export function mirrorShape(shape: Shape): Shape {
  const xs = new Float32Array(shape.count);
  for (let i = 0; i < shape.count; i++) xs[i] = -shape.xs[i];
  return { ...shape, xs, ys: shape.ys.slice() };
}

/** Stand a shape up: its long axis (from the point covariance) becomes vertical, narrow end (the tip) up. */
export function uprightShape(shape: Shape): Shape {
  const n = shape.count;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) {
    mx += shape.xs[i];
    my += shape.ys[i];
  }
  mx /= n;
  my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = shape.xs[i] - mx, dy = shape.ys[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy); // direction of the long axis, from +x
  let up = rotateShape(shape, Math.PI / 2 - theta);
  // The tip is the narrow end: if the top half is wider than the bottom half, flip it.
  let topW = 0, topN = 0, botW = 0, botN = 0;
  for (let i = 0; i < n; i++) {
    if (up.ys[i] > 0) { topW += Math.abs(up.xs[i]); topN++; }
    else { botW += Math.abs(up.xs[i]); botN++; }
  }
  if (topN && botN && topW / topN > botW / botN) up = rotateShape(up, Math.PI);
  return up;
}

/** The whole mark (petals + W), parts labeled, drop cut-out left empty. */
export function sampleMark(count: number, rng: () => number, resolution = 720): Shape {
  const [vx, vy, vw, vh] = MARK_VIEWBOX;
  const s = resolution / vw;
  return rasterize(
    resolution,
    Math.ceil(vh * s),
    (ctx) => {
      ctx.setTransform(s, 0, 0, s, -vx * s, -vy * s);
      for (const p of MARK_PATHS) {
        ctx.fillStyle = partColor(PART_INDEX[p.part]);
        ctx.fill(new Path2D(p.d));
      }
    },
    count,
    rng,
  );
}

/** One petal (the left one, from the mark), optionally mirrored so it leans the other way. */
export function samplePetal(count: number, rng: () => number, mirror = false, resolution = 420): Shape {
  const petal = MARK_PATHS.find((p) => p.part === "petal");
  if (!petal) throw new Error("No petal path in the mark");
  const [vx, vy, vw, vh] = MARK_VIEWBOX;
  const s = resolution / vw;
  const shape = rasterize(
    resolution,
    Math.ceil(vh * s),
    (ctx) => {
      ctx.setTransform(s, 0, 0, s, -vx * s, -vy * s);
      ctx.fillStyle = partColor(1);
      ctx.fill(new Path2D(petal.d));
    },
    count,
    rng,
  );
  if (mirror) for (let i = 0; i < shape.count; i++) shape.xs[i] = -shape.xs[i];
  return shape;
}

/** A number (or any short text) in the display font, for the counting frames. */
export function sampleText(text: string, fontFamily: string, count: number, rng: () => number, size = 420): Shape {
  const width = Math.ceil(size * Math.max(1.2, text.length * 0.75));
  const height = Math.ceil(size * 1.3);
  return rasterize(
    width,
    height,
    (ctx) => {
      ctx.fillStyle = partColor(0);
      ctx.font = `800 ${size}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, width / 2, height / 2);
    },
    count,
    rng,
  );
}

/** Resolve the display font family from the next/font CSS variable, and make sure it is loaded. */
export async function resolveDisplayFont(): Promise<string> {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-manrope").trim() || "Manrope";
  try {
    await document.fonts.load(`800 100px ${family}`);
  } catch {
    /* fall through: the fallback font still produces a usable shape */
  }
  return family;
}
