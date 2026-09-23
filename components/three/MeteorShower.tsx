"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The returned day's flourish (spec v0.2 §11.1, §11.2).
 *
 * Three to five slow streaks across the sky, **once**, when the orbit view
 * first opens on a day something has come back. A meteor shower was considered
 * and rejected as the time-capsule metaphor itself — it is many streaks, not
 * one message — but it is exactly right as a way of marking the day.
 *
 * Once is the whole design. A shower that repeated would become weather, and
 * the day would stop being a day.
 */

const COUNT = 5;
const DURATION_S = 4.2;
const LENGTH = 9;

export function MeteorShower({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);

  const streaks = useMemo(() => {
    let state = 77137 >>> 0;
    const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000;

    return Array.from({ length: COUNT }, (_, i) => ({
      // Spread across the upper sky, entering from the top-left.
      from: new THREE.Vector3(
        -14 + random() * 8,
        7 + random() * 6,
        -12 - random() * 10,
      ),
      direction: new THREE.Vector3(1, -0.55 - random() * 0.2, 0.1).normalize(),
      // Staggered, so it reads as a shower rather than a volley.
      delay: i * 0.55 + random() * 0.4,
      speed: 5 + random() * 3,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (done.current || !group.current) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;

    const elapsed = clock.elapsedTime - startedAt.current;

    group.current.children.forEach((child, index) => {
      const streak = streaks[index];
      const local = elapsed - streak.delay;
      const span = DURATION_S - streak.delay;

      if (local < 0 || local > span) {
        child.visible = false;
        return;
      }

      const t = local / span;
      child.visible = true;
      child.position
        .copy(streak.from)
        .addScaledVector(streak.direction, streak.speed * local);

      // Bright in the middle of its flight, nothing at either end: a meteor
      // that appears and disappears mid-sky, which is what they do.
      const material = (child as THREE.Mesh).material as THREE.Material & { opacity: number };
      material.opacity = Math.sin(Math.PI * t) * 0.85;
    });

    if (elapsed > DURATION_S) {
      done.current = true;
      group.current.visible = false;
    }
  });

  // Reduced motion gets no shower at all. A streak across the sky is the one
  // thing here that cannot be made into a gentle crossfade, and the panel and
  // the landing line both already say the day has come.
  if (reducedMotion) return null;

  return (
    <group ref={group}>
      {streaks.map((streak, index) => (
        <mesh
          key={index}
          visible={false}
          quaternion={new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            streak.direction,
          )}
        >
          <cylinderGeometry args={[0.012, 0.055, LENGTH, 6, 1, true]} />
          <meshBasicMaterial
            color="#ffe9c9"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
