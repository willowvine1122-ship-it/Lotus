"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, ShaderMaterial, Vector2, Vector3, Vector4 } from "three";
import { heroState, MAX_RIPPLES } from "./hero-state";
import { skyFragment, skyVertex, waterFragment, waterVertex } from "./shaders";

/** Full-screen Rise gradient behind everything (clip-space triangle; the camera does not matter). */
export function Sky() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: { uResolution: { value: new Vector2(1, 1) } },
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );
  const positions = useMemo(() => new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), []);
  const mesh = useRef<Mesh>(null);
  useFrame((state) => {
    const mat = mesh.current?.material as ShaderMaterial | undefined;
    if (!mat) return;
    const dpr = state.viewport.dpr;
    mat.uniforms.uResolution.value.set(state.size.width * dpr, state.size.height * dpr);
  });
  return (
    <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={-10}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
    </mesh>
  );
}

interface WaterProps {
  y: number;
  glow: { x: number; y: number };
  wave?: number;
}

export function Water({ y, glow, wave = 1 }: WaterProps) {
  const camera = useThree((s) => s.camera);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new Vector2(1, 1) },
          uCamera: { value: new Vector3() },
          uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new Vector4(0, 0, -100, 0)) },
          uGlowPos: { value: new Vector3() },
          uGlow: { value: 1 },
          uWave: { value: wave },
        },
      }),
    [wave],
  );

  const mesh = useRef<Mesh>(null);
  useFrame((state) => {
    const mat = mesh.current?.material as ShaderMaterial | undefined;
    if (!mat) return;
    const u = mat.uniforms;
    const dpr = state.viewport.dpr;
    u.uTime.value = state.clock.elapsedTime;
    u.uResolution.value.set(state.size.width * dpr, state.size.height * dpr);
    u.uCamera.value.copy(camera.position);
    u.uGlowPos.value.set(glow.x, y, 0);
    // The mark's reflection fades as the points leave the mark for the number.
    u.uGlow.value = heroState.enter * (1 - Math.min(1, heroState.scroll / 0.18));
    const ripples = heroState.ripples;
    const arr = u.uRipples.value as Vector4[];
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = ripples[ripples.length - 1 - i];
      if (r) arr[i].set(r.x, r.z, r.t, r.strength);
      else arr[i].set(0, 0, -100, 0);
    }
  });

  return (
    <mesh ref={mesh} material={material} rotation-x={-Math.PI / 2} position={[0, y, -8]} frustumCulled={false} renderOrder={-5}>
      <planeGeometry args={[140, 70]} />
    </mesh>
  );
}
