"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLANET_CENTRE, PLANET_RADIUS, orbitPosition } from "./framing";
import { displayedProgress, orbitPoint, toWorld } from "@/lib/cometOrbit";
import { RELEASE_MS, REDUCED_MS } from "@/lib/timing";

/**
 * The receiver's comet, setting off (spec v0.2 §11.4).
 *
 * A warm point forms at the planet's limb, swings once around the planet —
 * passing just beneath the satellite, which is the moment of hand-over — and
 * then heads out along its orbit, shrinking, until it is the faint glint it
 * will be for the next several months.
 *
 * There is no exhaust ribbon and no thruster here, deliberately. A comet is
 * *thrown*, not powered: the slingshot around the planet is what sends it, and
 * adding a rocket plume would make it a probe instead.
 */

/** When it passes under the satellite, and how long the hand-over glow lasts. */
const HANDOVER_AT = 0.42;
const HANDOVER_MS = 0.25;

type Props = {
  rotation: number;
  reducedMotion: boolean;
  onDone: () => void;
};

export function CometRelease({ rotation, reducedMotion, onDone }: Props) {
  const spark = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const startedAt = useRef<number | null>(null);
  const finished = useRef(false);

  const planet = useMemo(() => new THREE.Vector3(...PLANET_CENTRE), []);

  /** Where the comet will sit once this is over: its displayed start position. */
  const settle = useMemo(() => {
    const world = toWorld(orbitPoint(displayedProgress(0)), rotation);
    return planet.clone().add(new THREE.Vector3(world.x, world.y, world.z));
  }, [planet, rotation]);

  const birth = useMemo(
    () => planet.clone().add(new THREE.Vector3(-0.6, 0.78, 0.2).normalize().multiplyScalar(PLANET_RADIUS)),
    [planet],
  );

  const handover = useMemo(() => {
    // Just beneath the satellite's own ellipse, so the two visibly pass.
    const point = new THREE.Vector3(...orbitPosition(1.6));
    return point.add(new THREE.Vector3(0, -0.45, 0));
  }, []);

  useFrame(({ clock }) => {
    if (finished.current) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;

    const duration = (reducedMotion ? REDUCED_MS : RELEASE_MS) / 1000;
    const t = Math.min((clock.elapsedTime - startedAt.current) / duration, 1);

    const position = at(t, { birth, handover, settle, planet });
    // Shrinking as it goes: by the end it is the same faint speck the sender's
    // comet has been all along.
    const scale = 1 - 0.72 * ease(t);

    // A brief brightening as it passes the satellite — the hand-over.
    const near = Math.abs(t - HANDOVER_AT) < HANDOVER_MS / 2;

    if (spark.current) {
      spark.current.position.copy(position);
      spark.current.scale.setScalar(scale);
      const material = spark.current.material as THREE.Material & { opacity: number };
      material.opacity = Math.min(t * 6, 1) * (near ? 1 : 0.85);
    }
    if (halo.current) {
      halo.current.position.copy(position);
      halo.current.scale.setScalar(scale * (near ? 1.6 : 1));
      const material = halo.current.material as THREE.Material & { opacity: number };
      material.opacity = Math.min(t * 5, 1) * (near ? 0.5 : 0.25);
    }
    if (light.current) {
      light.current.position.copy(position);
      light.current.intensity = near ? 2.2 : 0.6 * (1 - t);
    }

    if (t >= 1) {
      finished.current = true;
      onDone();
    }
  });

  return (
    <group>
      <mesh ref={spark}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial
          color="#ffeccc"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshBasicMaterial
          color="#ffd8a0"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={light} intensity={0} distance={4} color="#ffd8a0" />
    </group>
  );
}

/**
 * The slingshot. Around the planet to the hand-over point, then away along the
 * orbit — two arcs rather than a line, because a comet that left in a straight
 * line would not have been *thrown* by anything.
 */
function at(
  t: number,
  points: {
    birth: THREE.Vector3;
    handover: THREE.Vector3;
    settle: THREE.Vector3;
    planet: THREE.Vector3;
  },
): THREE.Vector3 {
  if (t <= HANDOVER_AT) {
    const local = ease(t / HANDOVER_AT);
    // Bulged around the far side of the planet, which is what makes the first
    // leg read as a swing rather than a hop.
    const mid = points.birth
      .clone()
      .lerp(points.handover, 0.5)
      .sub(points.planet)
      .multiplyScalar(1.5)
      .add(points.planet);
    return quadratic(points.birth, mid, points.handover, local);
  }

  const local = ease((t - HANDOVER_AT) / (1 - HANDOVER_AT));
  const mid = points.handover.clone().lerp(points.settle, 0.4).add(new THREE.Vector3(0, 0.8, 0));
  return quadratic(points.handover, mid, points.settle, local);
}

function quadratic(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number) {
  return a
    .clone()
    .multiplyScalar((1 - t) * (1 - t))
    .addScaledVector(b, 2 * (1 - t) * t)
    .addScaledVector(c, t * t);
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
