"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { nebulaFragmentShader, nebulaVertexShader } from "./shaders/nebula";

/** Coloured dust on the inside of a sphere that encloses the whole scene. */
type Props = {
  reducedMotion: boolean;
  /** Closing screen: the dust recedes so the drawn message stays legible. */
  dimmed: boolean;
};

export function NebulaBackdrop({ reducedMotion, dimmed }: Props) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const shell = useRef<THREE.Mesh>(null);
  const lowDetail = useThree((state) => state.size.width) < 700;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVoid: { value: new THREE.Color("#05070c") },
      uDeep: { value: new THREE.Color("#0d1b2a") },
      uNebula: { value: new THREE.Color("#3b2e63") },
      uIon: { value: new THREE.Color("#0f6d96") },
      uEmber: { value: new THREE.Color("#6b3a63") },
      // The filament palette of §23.2: violet through to cyan.
      uFilamentCool: { value: new THREE.Color("#4fc3f0") },
      uFilamentWarm: { value: new THREE.Color("#8f7fd6") },
      uIntensity: { value: 0.9 },
    }),
    [],
  );

  useFrame(({ clock, camera }, delta) => {
    // The gas is the far distance, so its sphere travels with the camera. The
    // trail runs out to z = -70 inside a sphere of radius 90; left at the
    // origin, the near wall would be 20 units away by the end of it.
    shell.current?.position.copy(camera.position);

    const shader = material.current;
    if (!shader) return;
    if (!reducedMotion) shader.uniforms.uTime.value = clock.elapsedTime;
    shader.uniforms.uIntensity.value = THREE.MathUtils.damp(
      shader.uniforms.uIntensity.value,
      dimmed ? 0.34 : 0.9,
      3,
      delta,
    );
  });

  return (
    <mesh ref={shell} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[90, 32, 24]} />
      <shaderMaterial
        // Remounts the material when the detail level changes, so the
        // #define is actually recompiled into the shader.
        key={lowDetail ? "low" : "high"}
        ref={material}
        defines={lowDetail ? { LOW_DETAIL: "" } : {}}
        uniforms={uniforms}
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
