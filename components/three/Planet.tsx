"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PLANET_RADIUS, hubPlanetScreen, hubSunAngle, planetSunDisc } from "./framing";
import { atmosphereFragmentShader, atmosphereVertexShader } from "./shaders/atmosphere";
import { planetFragmentShader, planetVertexShader } from "./shaders/planet";
import { keyLight } from "@/lib/sceneLight";
import { useDawn } from "./DawnProvider";

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

/**
 * How far past the limb the air ring reaches, in planet radii.
 *
 * Enough for §6's widest pass (a haze 0.03R wide, blurred) and for the
 * aurora's tallest strand (0.065R), with room for both to fade to nothing
 * before the geometry stops — a ring whose edge you can see is worse than
 * no ring at all.
 */
const AIR_OUTER = 1.13;
const AIR_INNER = 0.9;

const LOW_DETAIL_WIDTH = 700;

type Props = {
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
};

/**
 * 「あなたの星」 (spec v0.2 §23.4).
 *
 * Two meshes: the world, and the air around it.
 *
 * Drawn at **its parent's origin**, which the caller places. It used to put
 * itself at `PLANET_CENTRE` as well as being positioned by `OrbitScene`, so
 * the planet was drawn at the sum of the two: about 40% further out and a
 * third of the size the composition asked for. Nothing caught it, because
 * every check measured `hubPlanet` — where the planet is *meant* to be — and
 * nothing measured the mesh.
 *
 * Revision 7.1 is what makes it matter. R22 and R25 hang the sun, the
 * crescent, the city lights, the aurora and the whole set of orbiting things
 * (§8.3) off the planet's **screen disc**, so a planet that is not where
 * `hubPlanetScreen` says it is puts every one of them in the wrong place.
 * §14 step 0 calls for exactly this: fix the planet arc before adding
 * anything to it.
 */
export function Planet({ seed, returned, reducedMotion }: Props) {
  const surface = useRef<THREE.ShaderMaterial>(null);
  const airMaterial = useRef<THREE.ShaderMaterial>(null);
  const lowDetail = useThree((state) => state.size.width) < LOW_DETAIL_WIDTH;

  const surfaceUniforms = useMemo(
    () => ({
      uSurfaceAngle: { value: 0 },
      uCloudAngle: { value: 0 },
      uSun: { value: new THREE.Vector3(0, 0, 1) },
      uSunColor: { value: new THREE.Color("#fff4e6") },
      uNight: { value: 1 },
      uDawn: { value: 0.2 },
      uTime: { value: 0 },
      uSunPos: { value: new THREE.Vector2(1, 0) },
    }),
    [],
  );

  const airUniforms = useMemo(
    () => ({
      uDawn: { value: 0.2 },
      uTime: { value: 0 },
      uSunAngle: { value: 0 },
      uVisibleArc: { value: new THREE.Vector2(0, Math.PI) },
      uPixel: { value: 0.002 },
    }),
    [],
  );

  const { d, active, toSun } = useDawn();
  const size = useThree((state) => state.size);

  /*
   * Everything the air ring needs about this frame, solved once per viewport.
   *
   * All of it is in the **disc's own plane** — bearings from the planet's
   * centre, with y up — because that is how §6 writes the conic gradient and
   * the aurora's arc, and because it is the only frame in which "where the
   * sun is on the limb" is a single number.
   */
  const air = useMemo(() => {
    const disc = hubPlanetScreen(size.width, size.height);
    // Screen y is down and the ring's y is up, hence the negation.
    const sunAngle = -hubSunAngle(size.width, size.height);

    /*
     * The arc of limb the frame actually shows: from where it crosses the
     * bottom edge round to where it crosses the right edge. The aurora lives
     * on that arc and nowhere else — strands drawn round the back of the
     * planet are strands nobody will ever see.
     *
     * In the disc's own frame, so y is up and an angle is a bearing from the
     * planet's centre.
     */
    const yBottom = Math.min(1, Math.max(-1, (disc.cy - size.height) / disc.r));
    const xRight = Math.min(1, Math.max(-1, (size.width - disc.cx) / disc.r));
    const angleBottom = Math.atan2(yBottom, -Math.sqrt(Math.max(0, 1 - yBottom * yBottom)));
    const angleRight = Math.atan2(Math.sqrt(Math.max(0, 1 - xRight * xRight)), xRight);
    const arc: [number, number] = [angleBottom, angleRight];

    return {
      sunAngle,
      arc,
      // One screen pixel, in planet radii.
      pixel: 1 / disc.r,
      // Where the sun sits on the disc, which is what lights the surface.
      sunDisc: planetSunDisc(size.width, size.height, d.sunElevation),
    };
  }, [size.width, size.height, d.sunElevation]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const sun = keyLight(t, seed, active ? d : undefined, {
      reducedMotion,
      returned,
      toSun,
    });
    // A date, not a motion: reduced motion still gets the right sky (§3).
    const time = reducedMotion ? 0 : t;

    if (surface.current) {
      const u = surface.current.uniforms;
      // A planet that does not turn is a painting of a planet. Twenty minutes
      // a turn is far too slow to watch and exactly fast enough that the same
      // coastline is not on the same edge when you come back.
      u.uSurfaceAngle.value = reducedMotion ? 0 : (t / SURFACE_PERIOD_S) * Math.PI * 2;
      u.uCloudAngle.value = reducedMotion ? 0 : (t / CLOUD_PERIOD_S) * Math.PI * 2;
      u.uSun.value.set(...sun.dir);
      u.uSunColor.value.set(sun.color);
      u.uDawn.value = d.p;
      u.uTime.value = time;
      u.uSunPos.value.set(air.sunDisc[0], air.sunDisc[1]);
    }
    if (airMaterial.current) {
      const u = airMaterial.current.uniforms;
      u.uDawn.value = d.p;
      u.uTime.value = time;
      u.uSunAngle.value = air.sunAngle;
      u.uVisibleArc.value.set(air.arc[0], air.arc[1]);
      u.uPixel.value = air.pixel;
    }
  });

  return (
    <group>
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
        The air, as a ring across the limb (§6). Additive and depth-write off,
        because light passing through air accumulates rather than occludes —
        but depth *testing* is left on, so the satellite still passes in front
        of it the way it passes in front of the planet.

        Drawn after the surface, so the hairline sits on top of the disc's
        own edge rather than being hidden by it.
      */}
      <mesh renderOrder={1} scale={PLANET_RADIUS}>
        {/* In planet radii, so the shader's maths is the document's maths. */}
        <ringGeometry args={[AIR_INNER, AIR_OUTER, 256, 1]} />
        <shaderMaterial
          ref={airMaterial}
          uniforms={airUniforms}
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
