"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, Points, ShaderMaterial } from "three";
import { heroState, PHASES } from "./hero-state";
import { pointsFragment, pointsVertex } from "./shaders";
import type { HeroTargets } from "./targets";

interface RisePointsProps {
  targets: HeroTargets;
  /** Draw a second, wide, faint pass per point: a cheap bloom. Off on the lite tier. */
  halo: boolean;
  /** Base point size in CSS pixels at the mark plane. */
  baseSize: number;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Per-point local progress: each point starts a little later (by its seed), so streams look alive, not mechanical. */
function local(p: number, seed: number, spread: number) {
  const t = (p - seed * spread) / (1 - spread);
  return t <= 0 ? 0 : t >= 1 ? 1 : smooth(t);
}

export function createPointsMaterial(halo: boolean, baseSize: number, opacity: number) {
  return new ShaderMaterial({
    vertexShader: pointsVertex,
    fragmentShader: pointsFragment,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: baseSize },
      uPixelRatio: { value: 1 },
      uHalo: { value: halo ? 1 : 0 },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
}

export function RisePoints({ targets, halo, baseSize }: RisePointsProps) {
  const group = useRef<Group>(null);
  const corePoints = useRef<Points>(null);
  const softPoints = useRef<Points>(null);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const position = new BufferAttribute(new Float32Array(targets.count * 3), 3);
    const color = new BufferAttribute(new Float32Array(targets.count * 3), 3);
    position.setUsage(DynamicDrawUsage);
    color.setUsage(DynamicDrawUsage);
    // Start under the water so the first frame shows nothing popping in.
    position.array.set(targets.start);
    color.array.set(targets.markColor);
    g.setAttribute("position", position);
    g.setAttribute("aColor", color);
    g.setAttribute("aSize", new BufferAttribute(targets.size, 1));
    g.setAttribute("aSeed", new BufferAttribute(targets.seed, 1));
    return g;
  }, [targets]);

  // Without the halo pass (lite tier) the core carries all the light, so it is a touch dimmer.
  const core = useMemo(() => createPointsMaterial(false, baseSize, halo ? 0.5 : 0.42), [baseSize, halo]);
  const soft = useMemo(() => createPointsMaterial(true, baseSize, 0.06), [baseSize]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => core.dispose(), [core]);
  useEffect(() => () => soft.dispose(), [soft]);

  useFrame((state) => {
    const pts = corePoints.current;
    if (!pts) return;
    const geom = pts.geometry;
    const coreMat = pts.material as ShaderMaterial;
    const softMat = softPoints.current?.material as ShaderMaterial | undefined;
    const t = state.clock.elapsedTime;
    const enter = heroState.enter;
    const scroll = heroState.scroll;
    const { count, seed, start, mark, numbers, petals, markColor, numberColor, petalColor } = targets;
    const posAttr = geom.getAttribute("position") as BufferAttribute;
    const colAttr = geom.getAttribute("aColor") as BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;

    const A = PHASES.toNumber;
    const B = PHASES.counting;
    const C = PHASES.hold;
    const D = PHASES.toPetals;
    const last = numbers.length - 1;
    const numLast = numbers[last];
    const breathe = 1 - Math.min(1, scroll * 25);
    const third = Math.ceil(count / 3);
    const PI = Math.PI;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const s = seed[i];
      let x: number, y: number, z: number, r: number, g: number, b: number;

      if (scroll < A) {
        // Rising out of the water and gathering into the mark.
        const e = local(enter, s, 0.5);
        const arc = Math.sin(e * PI);
        let mx = start[i3] + (mark[i3] - start[i3]) * e + Math.sin(t * 1.1 + s * 9.0) * 0.09 * arc;
        let my = start[i3 + 1] + (mark[i3 + 1] - start[i3 + 1]) * e + arc * 0.3 * (s - 0.5);
        const mz = start[i3 + 2] + (mark[i3 + 2] - start[i3 + 2]) * e;
        // Settled: a slow breath, and the whole mark bobs a little on its reflection.
        mx += Math.sin(t * 0.7 + s * 6.283) * 0.012 * e * breathe;
        my += (Math.cos(t * 0.55 + s * 4.1) * 0.012 + Math.sin(t * 0.5) * 0.02) * e * breathe;

        if (scroll <= 0) {
          x = mx;
          y = my;
          z = mz;
          r = markColor[i3];
          g = markColor[i3 + 1];
          b = markColor[i3 + 2];
        } else {
          // Streaming down into the first number frame.
          const p = local(scroll / A, s, 0.35);
          const n0 = numbers[0];
          x = mx + (n0[i3] - mx) * p;
          y = my + (n0[i3 + 1] - my) * p - Math.sin(p * PI) * 0.4 * (0.4 + s * 0.6);
          z = mz + (n0[i3 + 2] - mz) * p;
          r = markColor[i3] + (numberColor[i3] - markColor[i3]) * p;
          g = markColor[i3 + 1] + (numberColor[i3 + 1] - markColor[i3 + 1]) * p;
          b = markColor[i3 + 2] + (numberColor[i3 + 2] - markColor[i3 + 2]) * p;
        }
      } else if (scroll < B) {
        // Counting up: morph through the number frames.
        const u = ((scroll - A) / (B - A)) * last;
        let k = Math.floor(u);
        if (k >= last) k = last - 1;
        const p = local(u - k, s, 0.3);
        const f = numbers[k];
        const n = numbers[k + 1];
        const jitter = Math.sin(t * 2.0 + s * 12.0) * 0.006;
        x = f[i3] + (n[i3] - f[i3]) * p + jitter;
        y = f[i3 + 1] + (n[i3 + 1] - f[i3 + 1]) * p + Math.cos(t * 1.7 + s * 8.0) * 0.006;
        z = f[i3 + 2] + (n[i3 + 2] - f[i3 + 2]) * p;
        r = numberColor[i3];
        g = numberColor[i3 + 1];
        b = numberColor[i3 + 2];
      } else if (scroll < C) {
        // The full number holds and sparkles.
        x = numLast[i3] + Math.sin(t * 2.0 + s * 12.0) * 0.006;
        y = numLast[i3 + 1] + Math.cos(t * 1.7 + s * 8.0) * 0.006;
        z = numLast[i3 + 2];
        r = numberColor[i3];
        g = numberColor[i3 + 1];
        b = numberColor[i3 + 2];
      } else if (scroll < D) {
        // Splitting into three streams that settle as petals.
        const p = local((scroll - C) / (D - C), s, 0.45);
        const stream = Math.min(2, Math.floor(i / third)) - 1; // -1, 0, 1
        const arc = Math.sin(p * PI);
        x = numLast[i3] + (petals[i3] - numLast[i3]) * p + arc * stream * 0.6 * (0.5 + s * 0.5);
        y = numLast[i3 + 1] + (petals[i3 + 1] - numLast[i3 + 1]) * p + arc * 0.35 * (s - 0.3);
        z = numLast[i3 + 2] + (petals[i3 + 2] - numLast[i3 + 2]) * p;
        r = numberColor[i3] + (petalColor[i3] - numberColor[i3]) * p;
        g = numberColor[i3 + 1] + (petalColor[i3 + 1] - numberColor[i3 + 1]) * p;
        b = numberColor[i3 + 2] + (petalColor[i3 + 2] - numberColor[i3 + 2]) * p;
      } else {
        // Three petals, breathing, handing off to the cards below.
        x = petals[i3] + Math.sin(t * 0.7 + s * 6.283) * 0.01;
        y = petals[i3 + 1] + Math.cos(t * 0.55 + s * 4.1) * 0.01;
        z = petals[i3 + 2];
        r = petalColor[i3];
        g = petalColor[i3 + 1];
        b = petalColor[i3 + 2];
      }

      pos[i3] = x;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z;
      col[i3] = r;
      col[i3 + 1] = g;
      col[i3 + 2] = b;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    // Point size follows the shape: the mark and the petals are denser than the big number, so
    // their points are smaller, and the light stays light instead of clipping to white.
    let stageScale: number;
    if (scroll < A) stageScale = 0.8 + 0.2 * Math.min(1, scroll / A);
    else if (scroll < C) stageScale = 1;
    else if (scroll < D) stageScale = 1 - 0.3 * ((scroll - C) / (D - C));
    else stageScale = 0.7;
    const dpr = state.viewport.dpr;
    coreMat.uniforms.uTime.value = t;
    coreMat.uniforms.uPixelRatio.value = dpr;
    coreMat.uniforms.uScale.value = baseSize * stageScale;
    if (softMat) {
      softMat.uniforms.uTime.value = t;
      softMat.uniforms.uPixelRatio.value = dpr;
      softMat.uniforms.uScale.value = baseSize * stageScale;
    }

    // Pointer parallax: the cloud leans a touch toward the cursor. Eases out as the scroll takes over.
    if (group.current) {
      const k = 1 - Math.min(1, scroll * 4);
      const targetY = heroState.pointer.active ? heroState.pointer.x * 0.07 * k : 0;
      const targetX = heroState.pointer.active ? -heroState.pointer.y * 0.035 * k : 0;
      group.current.rotation.y += (targetY - group.current.rotation.y) * 0.04;
      group.current.rotation.x += (targetX - group.current.rotation.x) * 0.04;
    }
  });

  return (
    <group ref={group}>
      {halo ? <points ref={softPoints} geometry={geometry} material={soft} frustumCulled={false} renderOrder={1} /> : null}
      <points ref={corePoints} geometry={geometry} material={core} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
