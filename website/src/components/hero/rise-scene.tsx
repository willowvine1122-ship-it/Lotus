"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from "three";
import gsap from "gsap";
import { HERO_POINTS, type HeroMode } from "./hero-mode";
import { heroState, PHASES, pushRipple } from "./hero-state";
import { createPointsMaterial, RisePoints } from "./rise-points";
import { resolveDisplayFont } from "./sampling";
import { buildShapes, layoutTargets, type HeroShapes, type HeroTargets } from "./targets";
import { Sky, Water } from "./water";

export const WATER_Y = -2.35;
const CAMERA_POSITION: [number, number, number] = [0, 1, 9.8];
const LOOK_AT = new Vector3(0, 0.35, 0);

export interface HeroAnchors {
  /** Screen position (0..1 from the left / top) of the number's bottom edge and each petal's bottom edge. */
  number: { x: number; y: number };
  petals: { x: number; y: number }[];
}

interface RiseSceneProps {
  mode: Exclude<HeroMode, "pending" | "still">;
  container: RefObject<HTMLElement | null>;
  finalNumber: number;
  onReady: () => void;
  onAnchors: (a: HeroAnchors) => void;
}

/** The whole scene: sky, water, the point cloud and its choreography. Mounted client-side only. */
export function RiseScene({ mode, container, finalNumber, onReady, onAnchors }: RiseSceneProps) {
  const [shapes, setShapes] = useState<HeroShapes | null>(null);
  const [visible, setVisible] = useState(true);
  const count = HERO_POINTS[mode];

  useEffect(() => {
    let alive = true;
    (async () => {
      const family = await resolveDisplayFont();
      const built = await buildShapes(count, finalNumber, family);
      if (alive) setShapes(built);
    })();
    return () => {
      alive = false;
    };
  }, [count, finalNumber]);

  // Stop rendering when the hero has scrolled away: no GPU work for a canvas nobody can see.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    // Several entries can arrive in one callback (the pin changes the section's geometry right at
    // mount); the last one is the current state. Reading only the first stalled the loop for good.
    const io = new IntersectionObserver((entries) => setVisible(entries[entries.length - 1].isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [container]);

  return (
    <Canvas
      className="absolute inset-0"
      dpr={mode === "full" ? [1, 1.75] : [1, 1.5]}
      frameloop={visible ? "always" : "never"}
      gl={{ antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" }}
      camera={{ fov: 38, near: 0.1, far: 90, position: CAMERA_POSITION }}
      onCreated={({ camera }) => camera.lookAt(LOOK_AT)}
      resize={{ scroll: false, debounce: { scroll: 50, resize: 120 } }}
    >
      <Sky />
      {shapes ? <Stage shapes={shapes} mode={mode} onReady={onReady} onAnchors={onAnchors} /> : null}
      <PointerRipples container={container} />
    </Canvas>
  );
}

interface StageProps {
  shapes: HeroShapes;
  mode: Exclude<HeroMode, "pending" | "still">;
  onReady: () => void;
  onAnchors: (a: HeroAnchors) => void;
}

function Stage({ shapes, mode, onReady, onAnchors }: StageProps) {
  const viewport = useThree((s) => s.viewport);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const compact = size.width < 820 || size.width / size.height < 1.05;

  const targets = useMemo(
    () => layoutTargets(shapes, { width: viewport.width, height: viewport.height, waterY: WATER_Y, compact }),
    [shapes, viewport.width, viewport.height, compact],
  );

  // Entrance: the points rise and gather. Runs once per mount; a scroll before it ends just takes over.
  useEffect(() => {
    onReady();
    const tween = gsap.fromTo(heroState, { enter: 0 }, { enter: 1, duration: 3.6, ease: "power2.inOut", delay: 0.2 });
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Project the number and petal bottoms to the screen so the HTML labels sit under them at any size.
  const anchorsDirty = useRef(true);
  useEffect(() => {
    anchorsDirty.current = true;
  }, [targets, size.width, size.height]);
  useFrame(() => {
    if (!anchorsDirty.current) return;
    anchorsDirty.current = false;
    const v = new Vector3();
    const toScreen = (x: number, y: number) => {
      v.set(x, y, 0).project(camera);
      return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    };
    // Bottom edges in world units, from the laid-out targets.
    let numBottom = Infinity;
    const petalBottom = [Infinity, Infinity, Infinity];
    const petalX = [0, 0, 0];
    const petalN = [0, 0, 0];
    const third = Math.ceil(targets.count / 3);
    for (let i = 0; i < targets.count; i++) {
      const y = targets.numbers[targets.numbers.length - 1][i * 3 + 1];
      if (y < numBottom) numBottom = y;
      const s = Math.min(2, Math.floor(i / third));
      const py = targets.petals[i * 3 + 1];
      if (py < petalBottom[s]) petalBottom[s] = py;
      petalX[s] += targets.petals[i * 3];
      petalN[s]++;
    }
    onAnchors({
      number: toScreen(0, numBottom),
      petals: petalBottom.map((b, s) => toScreen(petalX[s] / Math.max(1, petalN[s]), b)),
    });
  });

  return (
    <>
      <Water y={WATER_Y} glow={targets.markCenter} wave={mode === "full" ? 1 : 0.8} />
      <DropGlow targets={targets} />
      <RisePoints targets={targets} halo={mode === "full"} baseSize={mode === "full" ? 9 : 10} />
      <Drip targets={targets} />
    </>
  );
}

/** Rose light behind the drop cut-out: the cut-out stays see-through, it shows the glow behind it. */
function DropGlow({ targets }: { targets: HeroTargets }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, -0.2]), 3));
    g.setAttribute("aColor", new BufferAttribute(new Float32Array([0.784, 0.196, 0.416]), 3));
    g.setAttribute("aSize", new BufferAttribute(new Float32Array([1]), 1));
    g.setAttribute("aSeed", new BufferAttribute(new Float32Array([0.37]), 1));
    return g;
  }, []);
  const material = useMemo(() => createPointsMaterial(true, 36, 0.55), []);
  const points = useRef<Points>(null);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const pts = points.current;
    if (!pts) return;
    const mat = pts.material as ShaderMaterial;
    const t = state.clock.elapsedTime;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uPixelRatio.value = state.viewport.dpr;
    mat.uniforms.uScale.value = targets.markWidth * 7.5;
    const presence = heroState.enter * (1 - Math.min(1, heroState.scroll / PHASES.toNumber));
    mat.uniforms.uOpacity.value = presence * (0.45 + 0.15 * Math.sin(t * 1.4));
    const pos = pts.geometry.getAttribute("position") as BufferAttribute;
    pos.setXYZ(0, targets.drip.x, targets.drip.y + targets.markWidth * 0.12, -0.2);
    pos.needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} renderOrder={0} />;
}

/** Every few seconds one drop falls from the cut-out into the water and rings it. */
function Drip({ targets }: { targets: HeroTargets }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([0, -100, 0]), 3));
    g.setAttribute("aColor", new BufferAttribute(new Float32Array([0.98, 0.86, 0.9]), 3));
    g.setAttribute("aSize", new BufferAttribute(new Float32Array([1.6]), 1));
    g.setAttribute("aSeed", new BufferAttribute(new Float32Array([0.61]), 1));
    return g;
  }, []);
  const material = useMemo(() => createPointsMaterial(false, 14, 1), []);
  const points = useRef<Points>(null);
  const cycle = useRef(-1);
  // ?nodrip keeps the water still for the pre-rendered fallback (scripts/render-hero-still.mjs).
  const enabled = useMemo(() => !new URLSearchParams(window.location.search).has("nodrip"), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const pts = points.current;
    if (!pts) return;
    const mat = pts.material as ShaderMaterial;
    const t = state.clock.elapsedTime;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uPixelRatio.value = state.viewport.dpr;
    const pos = pts.geometry.getAttribute("position") as BufferAttribute;
    const period = 3.8;
    const fall = 0.95;
    const active = enabled && heroState.enter > 0.92 && heroState.scroll < PHASES.toNumber * 0.5;
    const c = Math.floor(t / period);
    const phase = t - c * period;
    if (!active || phase > fall) {
      pos.setXYZ(0, 0, -100, 0);
      pos.needsUpdate = true;
      if (active && phase > fall && cycle.current !== c) {
        cycle.current = c;
        pushRipple({ x: targets.drip.x, z: 0, t, strength: 0.9 });
      }
      return;
    }
    const k = phase / fall;
    const eased = k * k * (2 - k * 0.6); // gravity-ish
    const y = targets.drip.y - (targets.drip.y - WATER_Y + 0.05) * eased;
    pos.setXYZ(0, targets.drip.x, y, 0.05);
    pos.needsUpdate = true;
    mat.uniforms.uOpacity.value = 0.9 * Math.min(1, k * 6);
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}

/** Cursor on the hero: soft ripples on the water and a little parallax on the cloud. */
function PointerRipples({ container }: { container: RefObject<HTMLElement | null> }) {
  const camera = useThree((s) => s.camera);
  const clock = useThree((s) => s.clock);
  const last = useRef({ x: 0, z: 0, t: -10 });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const v = new Vector3();
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      heroState.pointer.x = nx;
      heroState.pointer.y = ny;
      heroState.pointer.active = true;

      // Ray from the camera through the pointer, down to the water plane.
      v.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
      if (v.y >= -0.001) return;
      const dist = (WATER_Y - camera.position.y) / v.y;
      const x = camera.position.x + v.x * dist;
      const z = camera.position.z + v.z * dist;
      if (z > 8 || z < -30) return;
      const t = clock.elapsedTime;
      const l = last.current;
      const moved = Math.hypot(x - l.x, z - l.z);
      if (t - l.t < 0.14 || moved < 0.45) return;
      last.current = { x, z, t };
      pushRipple({ x, z, t, strength: Math.min(0.7, 0.25 + moved * 0.12) });
    };
    const onLeave = () => {
      heroState.pointer.active = false;
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [container, camera, clock]);

  return null;
}
