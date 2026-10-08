"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PLANET_RADIUS, cometAt, hubPlanet, orbitPosition } from "./framing";
import { DEPART_MS, REDUCED_MS } from "@/lib/timing";

/**
 * The comet leaving (spec v0.2 rev 5, §8.4).
 *
 * This is the moment the promise is made. The comet comes round the planet's
 * limb already bright and moving, **brushes past the satellite** — the
 * hand-over — and then time-lapses out along its orbit to wherever today
 * actually puts it.
 *
 * The time-lapse is the idea. A comet that simply appeared at its position
 * would be a fact; watching months of travel compressed into two seconds is
 * what makes the distance mean something, and it ends at exactly the speck the
 * reader will see in the hub from then on.
 */

/** When it passes the satellite, and how long the hand-over glow lasts. */
const HANDOVER_FROM = 0.25;
const HANDOVER_TO = 0.45;

type Props = {
  /** Where the comet ends up: today's progress along its orbit. */
  progress: number;
  rotation: number;
  reducedMotion: boolean;
  onDone: () => void;
};

export function CometDeparture({ progress, rotation, reducedMotion, onDone }: Props) {
  const size = useThree((state) => state.size);
  const spark = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const startedAt = useRef<number | null>(null);
  const finished = useRef(false);

  /*
   * Where the planet actually is on screen, not where `PLANET_CENTRE` puts it
   * in the world: the hub stages it per aspect ratio (`hubPlanet`), and a
   * capsule that leaves from the world constant leaves from empty sky.
   */
  const planet = useMemo(
    () => new THREE.Vector3(...hubPlanet(size.width, size.height)),
    [size.width, size.height],
  );

  /** Coming round the limb from behind: below and behind the planet. */
  const birth = useMemo(
    () =>
      planet
        .clone()
        .add(new THREE.Vector3(-0.85, -0.2, -0.5).normalize().multiplyScalar(PLANET_RADIUS * 1.05)),
    [planet],
  );

  /** Just beneath the satellite's own ellipse, so the two visibly pass. */
  const handover = useMemo(
    () => new THREE.Vector3(...orbitPosition(1.6)).add(new THREE.Vector3(0, -0.45, 0)),
    [],
  );

  /**
   * Where it stops: today's place on the orbit — where the hub draws the
   * comet (`cometAt`), so the departure hands over to the comet that is
   * there from then on, rather than to a point of its own.
   */
  const destination = useMemo(
    () => new THREE.Vector3(...cometAt(progress, size.width, size.height)),
    [progress, size.width, size.height],
  );

  useFrame(({ clock }) => {
    if (finished.current) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;

    const duration = (reducedMotion ? REDUCED_MS : DEPART_MS) / 1000;
    const t = Math.min((clock.elapsedTime - startedAt.current) / duration, 1);

    const position = at(t, { birth, handover, destination });
    // It shrinks as it goes, ending as the faint speck it will be for months.
    const scale = 1 - 0.78 * easeOutCubic(Math.max(0, (t - HANDOVER_TO) / (1 - HANDOVER_TO)));
    const near = t > HANDOVER_FROM && t < HANDOVER_TO;

    if (spark.current) {
      spark.current.position.copy(position);
      spark.current.scale.setScalar(scale);
      const material = spark.current.material as THREE.Material & { opacity: number };
      material.opacity = Math.min(t * 8, 1);
    }
    if (halo.current) {
      halo.current.position.copy(position);
      halo.current.scale.setScalar(scale * (near ? 1.7 : 1));
      const material = halo.current.material as THREE.Material & { opacity: number };
      material.opacity = Math.min(t * 6, 1) * (near ? 0.55 : 0.28);
    }
    // Its own light sweeps a glint across the satellite's panels as it passes.
    if (light.current) {
      light.current.position.copy(position);
      light.current.intensity = near ? 2.6 : Math.max(0, 1.4 * (1 - t));
    }

    if (t >= 1) {
      finished.current = true;
      onDone();
    }
  });

  return (
    <group>
      <mesh ref={spark}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial
          color="#c9f0ff"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial
          color="#7fd4f5"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={light} intensity={0} distance={5} color="#9fd8ff" />
    </group>
  );
}

/**
 * Three legs: round the limb to the satellite, the hand-over hold, then the
 * time-lapse out. `easeOutCubic` on the last one is what makes it read as
 * months compressed — fast at first, then settling.
 */
function at(
  t: number,
  points: { birth: THREE.Vector3; handover: THREE.Vector3; destination: THREE.Vector3 },
): THREE.Vector3 {
  if (t <= HANDOVER_FROM) {
    return points.birth.clone().lerp(points.handover, easeOutCubic(t / HANDOVER_FROM));
  }
  if (t <= HANDOVER_TO) return points.handover.clone();

  const local = easeOutCubic((t - HANDOVER_TO) / (1 - HANDOVER_TO));
  return points.handover.clone().lerp(points.destination, local);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
