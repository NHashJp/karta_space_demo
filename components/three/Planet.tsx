"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PLANET_CENTRE, PLANET_RADIUS } from "./framing";
import { atmosphereFragmentShader, atmosphereVertexShader } from "./shaders/atmosphere";
import { planetFragmentShader, planetVertexShader } from "./shaders/planet";
import { keyLight } from "@/lib/sceneLight";

/**
 * One turn of the surface, and of the clouds.
 *
 * §22 says 20 minutes and 14. That is the right number for a planet you are
 * *on*, and the wrong one for a planet you are looking at for ninety seconds:
 * at that rate nothing visibly turns, and the sender asked for a planet that
 * reads as moving alongside the cube. Two minutes a turn is slow enough to
 * stay calm — under a degree a second — and fast enough that the coastline
 * under the terminator is somewhere else by the time you look back.
 */
const SURFACE_PERIOD_S = 120;
const CLOUD_PERIOD_S = 86;

/** The atmosphere shell, as a fraction of the planet's radius. */
const SHELL_SCALE = 1.14;

const LOW_DETAIL_WIDTH = 700;

type Props = {
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
};

/**
 * 「あなたの星」 (spec v0.2 §23.4).
 *
 * Two meshes: the world, and the air around it. Both are lit by the same
 * `keyLight` as everything else in the scene, which is the reason that
 * function is a pure module rather than a hook — a planet whose terminator
 * disagrees with the satellite's shadows by ten degrees looks broken in a way
 * that is very hard to point at.
 */
export function Planet({ seed, returned, reducedMotion }: Props) {
  const surface = useRef<THREE.ShaderMaterial>(null);
  const air = useRef<THREE.ShaderMaterial>(null);
  const lowDetail = useThree((state) => state.size.width) < LOW_DETAIL_WIDTH;

  const surfaceUniforms = useMemo(
    () => ({
      uSurfaceAngle: { value: 0 },
      uCloudAngle: { value: 0 },
      uSun: { value: new THREE.Vector3(0, 0, 1) },
      uSunColor: { value: new THREE.Color("#fff4e6") },
      uNight: { value: 1 },
    }),
    [],
  );

  const airUniforms = useMemo(
    () => ({
      uSun: { value: new THREE.Vector3(0, 0, 1) },
      uLit: { value: new THREE.Color("#9ae7ff") },
      uShadow: { value: new THREE.Color("#6a56bd") },
      uScale: { value: SHELL_SCALE },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const sun = keyLight(t, seed, returned, { reducedMotion });

    if (surface.current) {
      const u = surface.current.uniforms;
      // A planet that does not turn is a painting of a planet. Twenty minutes
      // a turn is far too slow to watch and exactly fast enough that the same
      // coastline is not on the same edge when you come back.
      u.uSurfaceAngle.value = reducedMotion ? 0 : (t / SURFACE_PERIOD_S) * Math.PI * 2;
      u.uCloudAngle.value = reducedMotion ? 0 : (t / CLOUD_PERIOD_S) * Math.PI * 2;
      u.uSun.value.set(...sun.dir);
      u.uSunColor.value.set(sun.color);
    }
    if (air.current) {
      air.current.uniforms.uSun.value.set(...sun.dir);
    }
  });

  return (
    <group position={PLANET_CENTRE}>
      <mesh>
        <sphereGeometry args={[PLANET_RADIUS, lowDetail ? 48 : 96, lowDetail ? 32 : 64]} />
        <shaderMaterial
          key={lowDetail ? "low" : "high"}
          ref={surface}
          defines={lowDetail ? { LOW_DETAIL: "" } : {}}
          uniforms={surfaceUniforms}
          vertexShader={planetVertexShader}
          fragmentShader={planetFragmentShader}
          toneMapped={false}
        />
      </mesh>

      {/*
        Back faces, additive and depth-write off: the air is something light
        passes through, so it has to accumulate rather than occlude.
      */}
      <mesh scale={SHELL_SCALE}>
        <sphereGeometry args={[PLANET_RADIUS, 48, 32]} />
        <shaderMaterial
          ref={air}
          uniforms={airUniforms}
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
