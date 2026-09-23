"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitRing } from "./OrbitRing";
import { Planet } from "./Planet";
import { orbitPosition } from "./framing";
import { ORBIT_PERIOD_S } from "@/lib/timing";

/** The satellite's size once the cube has become one (spec v0.2 §22). */
export const SAT_SCALE = 0.42;

type Props = {
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
  /** 0 while docked, 1 once fully in orbit; the deployment crosses it. */
  presence: number;
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
  const ring = useRef<THREE.Group>(null);

  useFrame(() => {
    // The ring fades in behind the satellite rather than appearing with it.
    if (ring.current) ring.current.visible = presence > 0.05;
  });

  return (
    <group>
      <Planet seed={seed} returned={returned} reducedMotion={reducedMotion} />
      <group ref={ring}>
        <OrbitRing opacity={0.18 * presence} />
      </group>
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
  children,
}: {
  presence: number;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const carrier = group.current;
    if (!carrier) return;

    const theta = reducedMotion ? 0.9 : (clock.elapsedTime / ORBIT_PERIOD_S) * Math.PI * 2 + 0.9;
    const [x, y, z] = orbitPosition(theta);

    // Docked, the cube is at the origin at full size; deployed, it is on the
    // ellipse at satellite scale. Everything between is the deployment.
    carrier.position.set(x * presence, y * presence, z * presence);
    const scale = 1 + (SAT_SCALE - 1) * presence;
    carrier.scale.setScalar(scale);
  });

  return <group ref={group}>{children}</group>;
}
