"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { glowFragmentShader, glowVertexShader } from "./shaders/glow";

/**
 * Three slow drifting lights. Each is a point light, so the cube picks up
 * coloured reflections, plus an additive glow behind it so the light itself
 * is visible as nebula haze.
 *
 * Every axis is a sum of two sines whose periods share no common multiple, so
 * a light never retraces its path — it wanders. Periods run 20-130s: present,
 * never distracting.
 */
const LIGHTS = [
  {
    color: "#00aeef",
    intensity: 26,
    size: 26,
    opacity: 0.2,
    amplitude: [7.5, 3.4, 3.2] as const,
    frequency: [0.0147, 0.0091, 0.0063] as const,
    wobble: [0.0331, 0.0233, 0.0179] as const,
    phase: [0.0, 1.9, 0.6] as const,
    depth: -9,
  },
  {
    color: "#6d54ad",
    intensity: 30,
    size: 32,
    opacity: 0.24,
    amplitude: [8.4, 4.2, 3.8] as const,
    frequency: [0.0089, 0.0127, 0.0051] as const,
    wobble: [0.0217, 0.0293, 0.0143] as const,
    phase: [2.4, 0.4, 3.1] as const,
    depth: -12,
  },
  {
    color: "#2fa8b8",
    intensity: 16,
    size: 20,
    opacity: 0.14,
    amplitude: [6.2, 4.8, 2.6] as const,
    frequency: [0.0071, 0.0113, 0.0041] as const,
    wobble: [0.0163, 0.0251, 0.0127] as const,
    phase: [4.1, 2.8, 1.4] as const,
    depth: -6,
  },
];

/** Two unrelated sines: a slow sweep the eye follows, plus a faster wobble. */
function wander(time: number, frequency: number, wobble: number, phase: number): number {
  const tau = Math.PI * 2;
  return (
    Math.sin(time * frequency * tau + phase) * 0.74 +
    Math.sin(time * wobble * tau + phase * 1.7 + 0.9) * 0.26
  );
}

type Props = {
  reducedMotion: boolean;
  /** Fades the glows back so the closing message can be read over them. */
  dimmed: boolean;
};

export function WanderingLights({ reducedMotion, dimmed }: Props) {
  const group = useRef<(THREE.Group | null)[]>([]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const dim = useRef(0);

  const glowUniforms = useMemo(
    () =>
      LIGHTS.map((light) => ({
        uColor: { value: new THREE.Color(light.color) },
        uOpacity: { value: light.opacity },
      })),
    [],
  );

  useFrame(({ clock }, delta) => {
    dim.current = THREE.MathUtils.damp(dim.current, dimmed ? 1 : 0, 3, delta);
    const fade = 1 - dim.current * 0.82;
    const time = clock.elapsedTime;

    LIGHTS.forEach((light, index) => {
      const node = group.current[index];
      if (node && !reducedMotion) {
        const [ax, ay, az] = light.amplitude;
        node.position.set(
          wander(time, light.frequency[0], light.wobble[0], light.phase[0]) * ax,
          wander(time, light.frequency[1], light.wobble[1], light.phase[1]) * ay,
          light.depth + wander(time, light.frequency[2], light.wobble[2], light.phase[2]) * az,
        );
      }

      const point = lights.current[index];
      if (point) point.intensity = light.intensity * fade;

      const glow = node?.children.find(
        (child): child is THREE.Mesh => (child as THREE.Mesh).isMesh,
      );
      const material = glow?.material as THREE.ShaderMaterial | undefined;
      if (material) material.uniforms.uOpacity.value = light.opacity * fade;
    });
  });

  return (
    <>
      {LIGHTS.map((light, index) => (
        <group
          key={light.color}
          ref={(node) => {
            group.current[index] = node;
          }}
          position={[light.amplitude[0] * 0.4, light.amplitude[1] * 0.3, light.depth]}
        >
          <pointLight
            ref={(node) => {
              lights.current[index] = node;
            }}
            color={light.color}
            intensity={light.intensity}
            distance={34}
            decay={1.6}
          />
          {/* The camera never rotates, so a plane always faces it. */}
          <mesh renderOrder={-3}>
            <planeGeometry args={[light.size, light.size]} />
            <shaderMaterial
              uniforms={glowUniforms[index]}
              vertexShader={glowVertexShader}
              fragmentShader={glowFragmentShader}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}
