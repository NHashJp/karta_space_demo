"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { nebulaFragmentShader, nebulaVertexShader } from "./shaders/nebula";
import { sky as freshSky, type Sky } from "@/lib/skyAge";
import { useDawn } from "./DawnProvider";

/**
 * How far the gas drifts, and over what (rev 7.1 §4). ±0.8% of a turn is
 * about ±2.9°, on two periods chosen not to beat against each other.
 */
const NEBULA_SWAY = 0.008 * Math.PI * 2;
const NEBULA_SWAY_A_S = 60;
const NEBULA_SWAY_B_S = 71;

/** Coloured dust on the inside of a sphere that encloses the whole scene. */
type Props = {
  reducedMotion: boolean;
  /** Closing screen: the dust recedes so the drawn message stays legible. */
  dimmed: boolean;
  /** How far from home the letter has got (lib/skyAge.ts). */
  sky?: Sky;
};

export function NebulaBackdrop({ reducedMotion, dimmed, sky = freshSky(0) }: Props) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { d, active } = useDawn();
  const shell = useRef<THREE.Mesh>(null);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const lowDetail = size.width < 700;

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
      /*
       * Age. Set from the card's own dates rather than animated, because it is
       * a fact about the letter and not a state of the view — the sky a reader
       * opens is simply the sky it is on the day they open it.
       */
      uGas: { value: 1 },
      uWarmth: { value: 1 },
      // The dawn (rev 7.1 §6). Off everywhere but the orbit scene.
      uDawnOn: { value: 0 },
      uDawn: { value: 0.2 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    }),
    [],
  );

  /*
   * The two body colours cool with age, in `lib/skyAge.ts` rather than here,
   * so the whole of "what an old card looks like" is decided in one place and
   * can be read off without a shader.
   */
  useEffect(() => {
    uniforms.uDeep.value.set(sky.deep);
    uniforms.uNebula.value.set(sky.nebula);
    uniforms.uGas.value = sky.gas;
    uniforms.uWarmth.value = sky.warmth;
  }, [uniforms, sky]);

  // The sky gradient is written in screen fractions, so the shader needs to
  // know how big the frame is in device pixels.
  useEffect(() => {
    uniforms.uResolution.value.set(size.width * dpr, size.height * dpr);
  }, [uniforms, size.width, size.height, dpr]);

  useFrame(({ clock, camera }, delta) => {
    // The gas is the far distance, so its sphere travels with the camera. The
    // trail runs out to z = -70 inside a sphere of radius 90; left at the
    // origin, the near wall would be 20 units away by the end of it.
    shell.current?.position.copy(camera.position);

    /*
     * A sway of ±0.8% on two periods that do not divide into each other
     * (rev 7.1 §4, §17). Revision 7.0 wanted the whole world sliding past;
     * 7.1 withdrew that, and this is what is left of it — far too small to
     * catch, and enough that the gas is not a painted backdrop.
     */
    if (shell.current && !reducedMotion) {
      const t = clock.elapsedTime;
      shell.current.rotation.y = NEBULA_SWAY * Math.sin((2 * Math.PI * t) / NEBULA_SWAY_A_S);
      shell.current.rotation.x = NEBULA_SWAY * Math.sin((2 * Math.PI * t) / NEBULA_SWAY_B_S);
    }

    const shader = material.current;
    if (!shader) return;
    if (!reducedMotion) shader.uniforms.uTime.value = clock.elapsedTime;
    shader.uniforms.uDawnOn.value = active ? 1 : 0;
    shader.uniforms.uDawn.value = d.p;
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
