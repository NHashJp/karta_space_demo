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
      /*
       * Pushed towards the mockups' sky (M5, M12–M14): a teal that reads as
       * teal rather than as dark blue, and a magenta in the warm gas instead
       * of a plum that went grey as soon as it was dimmed. The card is mostly
       * this backdrop, and it was the one part of the composition doing its
       * job in monochrome.
       */
      uDeep: { value: new THREE.Color("#10203a") },
      uNebula: { value: new THREE.Color("#4a3676") },
      uIon: { value: new THREE.Color("#1a86b4") },
      uEmber: { value: new THREE.Color("#8d4374") },
      // The filament palette of §23.2: violet through to cyan.
      uFilamentCool: { value: new THREE.Color("#4fc3f0") },
      uFilamentWarm: { value: new THREE.Color("#b07fd6") },
      uIntensity: { value: 1.15 },
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
      dimmed ? 0.34 : 1.15,
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
