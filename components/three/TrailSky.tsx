"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FOV } from "./framing";
import { useStagedTrail } from "./useStagedTrail";
import { trailEra } from "@/lib/trailColour";
import { memoryU } from "@/lib/trailCurve";

/**
 * The sky behind the trail, ageing with the journey.
 *
 * Travelling the trail is travelling back in time, and the contrail already
 * says so in its colour (`trailEra`): ion-cool by the newest memories, amber
 * by the oldest. This lays the same era's light into the background as a
 * soft vertical gradient, so it is the whole scene that changes as the reader
 * goes back — not only the line they are following.
 *
 * Eased rather than stepped: the colour follows the camera's memory slowly,
 * so a drift from one memory to the next carries the sky with it over the
 * move instead of snapping it on arrival. Faded out entirely off the trail,
 * so the hub's own dawn is untouched.
 */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/*
 * Written as screen colours and decoded before the blend, as the dawn sky's
 * limb is, so the tint is the colour named here rather than a paler one.
 */
const fragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    // Top to bottom, with the lower glow gathered towards the middle.
    vec3 colour = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    float centre = 1.0 - smoothstep(0.2, 0.9, abs(vUv.x - 0.5) * 2.0);
    colour *= 0.75 + 0.25 * centre;
    vec3 lit = pow(clamp(colour * uStrength, 0.0, 1.0), vec3(2.2));
    if (max(lit.r, max(lit.g, lit.b)) < 0.0005) discard;
    gl_FragColor = vec4(lit, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Behind the trail and its panels, inside the camera's far plane. */
const DISTANCE = 95;
/** How strong the tint is at the top of the frame, and at the bottom. */
const TOP = 0.45;
const BOTTOM = 0.28;

type Props = {
  curveSeed: number;
  memoryCount: number;
  activeMemory: number;
  /** The camera is on the trail. */
  shown: boolean;
};

export function TrailSky({ curveSeed, memoryCount, activeMemory, shown }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const size = useThree((state) => state.size);
  const points = useStagedTrail(curveSeed);
  const at = useRef<number | null>(null);
  const fade = useRef(0);

  const target = useMemo(
    () => memoryU(points, Math.min(activeMemory, Math.max(memoryCount - 1, 0)), memoryCount),
    [points, activeMemory, memoryCount],
  );

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Vector3() },
      uBottom: { value: new THREE.Vector3() },
      uStrength: { value: 0 },
    }),
    [],
  );

  useFrame(({ camera }, delta) => {
    const sky = mesh.current;
    if (!sky) return;

    fade.current = THREE.MathUtils.damp(fade.current, shown ? 1 : 0, 2.2, delta);
    // Slow enough to be carried across a whole drift between memories.
    at.current = at.current === null ? target : THREE.MathUtils.damp(at.current, target, 1.4, delta);
    sky.visible = fade.current > 0.003;
    if (!sky.visible) return;

    const height = 2 * Math.tan(((FOV * Math.PI) / 180) / 2);
    sky.quaternion.copy(camera.quaternion);
    sky.position.copy(camera.position);
    sky.translateZ(-DISTANCE);
    sky.scale.set(height * (size.width / size.height) * DISTANCE, height * DISTANCE, 1);

    // The era here above, and a little further back below: the horizon of
    // the journey is always slightly older than where the reader stands.
    const top = trailEra(at.current);
    const bottom = trailEra(Math.min(at.current + 0.18, 1));
    uniforms.uTop.value.set(top[0] * TOP, top[1] * TOP, top[2] * TOP);
    uniforms.uBottom.value.set(bottom[0] * BOTTOM, bottom[1] * BOTTOM, bottom[2] * BOTTOM);
    uniforms.uStrength.value = fade.current;
  });

  return (
    <mesh ref={mesh} renderOrder={-7} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
