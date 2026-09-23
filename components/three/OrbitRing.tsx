"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { orbitPosition } from "./framing";

const SEGMENTS = 192;
const OPACITY = 0.18;

/**
 * The line the satellite travels (spec v0.2 §8.3).
 *
 * One hairline at 18% opacity, and it does a lot of work for that: without it
 * the satellite is a bright speck wandering near a planet, and with it the
 * speck is visibly *in orbit* — the shape tells you it will come back round.
 * Drawn from the same `orbitPosition` the satellite follows, so the two can
 * never disagree about where the orbit is.
 */
export function OrbitRing({ opacity = OPACITY }: { opacity?: number }) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      points.push(new THREE.Vector3(...orbitPosition((i / SEGMENTS) * Math.PI * 2)));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial
        color="#9fb4c9"
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </line>
  );
}
