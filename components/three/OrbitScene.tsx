"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RING_OPACITY, useOrbitRing } from "./OrbitRing";
import { Planet } from "./Planet";
import { orbitPosition } from "./framing";
import { ORBIT_PERIOD_S } from "@/lib/timing";
import { deploymentAt, SAT_SCALE } from "@/lib/deployment";

export { SAT_SCALE } from "@/lib/deployment";

type Props = {
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
  /**
   * 0 while docked, 1 once fully in orbit. A ref, written by `MessageCube`
   * every frame: it owns the deployment, and this is how the rest of the scene
   * follows along without a React render per frame.
   */
  presence: React.RefObject<number>;
};

/**
 * What exists in the orbit view but not before it: the planet the letter now
 * circles, and the line it circles on (spec v0.2 §8.3).
 *
 * Mounted only when the card is deployed, so a v0.1 card never pays for a
 * planet it does not have, and the shader compile happens on the way out of
 * the closing screen rather than on first load.
 */
export function OrbitScene({ seed, returned, reducedMotion, presence }: Props) {
  const ring = useOrbitRing();

  useFrame(() => {
    // The ring fades in under the satellite rather than appearing with it:
    // nothing at all until the cube is on its way, then up to full as it
    // settles onto the ellipse.
    const material = ring.material as THREE.Material & { opacity: number };
    material.opacity = RING_OPACITY * Math.max(0, presence.current * 2 - 1);
    ring.visible = material.opacity > 0.002;
  });

  return (
    <group>
      <Planet seed={seed} returned={returned} reducedMotion={reducedMotion} />
      <primitive object={ring} />
    </group>
  );
}

/**
 * Carries the cube around its orbit.
 *
 * It is a separate group from the cube itself so that the two motions stay
 * independent: the cube keeps turning to whichever face is being read, and
 * this only decides *where in the sky* that cube is. During deployment
 * `presence` eases from 0 to 1, which slides the cube out of the reading
 * position and onto the ellipse without either component knowing about the
 * other's timing.
 */
export function SatelliteCarrier({
  presence,
  reducedMotion,
  returned = false,
  children,
}: {
  presence: React.RefObject<number>;
  reducedMotion: boolean;
  /** The satellite's day has come: it gains a warm glow and a slow halo. */
  returned?: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const carrier = group.current;
    if (!carrier) return;

    if (halo.current) {
      // Steady, with a four-second breath under it. Not a blink: the satellite
      // is not signalling, it is simply warm today (§8.4).
      const pulse = reducedMotion
        ? 1
        : 0.82 + 0.18 * Math.sin((clock.elapsedTime / 4) * Math.PI * 2);
      halo.current.intensity = returned ? 2.6 * pulse * presence.current : 0;
    }

    const theta = reducedMotion ? 0.9 : (clock.elapsedTime / ORBIT_PERIOD_S) * Math.PI * 2 + 0.9;
    const [x, y, z] = orbitPosition(theta);

    // Only the last part of the deployment moves the cube — it turns and
    // unfolds where it is, then leaves (spec v0.2 §8.2, the RISE window).
    const rise = deploymentAt(presence.current).rise;

    // Docked, the cube is at the origin at full size; deployed, it is on the
    // ellipse at satellite scale. Everything between is the journey.
    carrier.position.set(x * rise, y * rise, z * rise);
    carrier.scale.setScalar(1 + (SAT_SCALE - 1) * rise);
  });

  return (
    <group ref={group}>
      <pointLight ref={halo} intensity={0} distance={7} color="#ffd8a0" />
      {children}
    </group>
  );
}
