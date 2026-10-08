"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PLANET_RADIUS, cometAt, hubPlanet } from "./framing";
import { displayOrbitPoint, displayedProgress, toWorld } from "@/lib/cometOrbit";
import { BOARD_MS, REDUCED_MS } from "@/lib/timing";
import type { BloomRequest } from "./Bloom";

/**
 * The receiver's words, going aboard (spec v0.2 rev 5, §8.7).
 *
 * A warm point lifts off the planet and runs **up the orbit line** to the
 * comet, then merges into its coma. From then on a warm strand runs through
 * the dust tail: their words are visibly *on* the thing that is coming back.
 *
 * There is no exhaust and no launch. The words are carried, not fired — and
 * the difference between those two readings is the whole difference between
 * this and the reply rocket.
 */

const TRAIL_POINTS = 22;

type Props = {
  /** Today's progress: where along the orbit the comet is waiting. */
  progress: number;
  rotation: number;
  reducedMotion: boolean;
  /** Opens the warm bloom; the scene owns it, so it outlives this flight. */
  onBloom?: (bloom: BloomRequest) => void;
  onDone: () => void;
};

export function CapsuleBoarding({
  progress,
  rotation,
  reducedMotion,
  onBloom,
  onDone,
}: Props) {
  const size = useThree((state) => state.size);
  const spark = useRef<THREE.Mesh>(null);
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

  /**
   * The path is the orbit line itself, from perihelion out to the comet — not
   * a straight line to it. Running up the line is what says "this is going
   * onto that", rather than "this is flying past".
   *
   * But the line has to *end on the comet*, and the comet is not drawn on its
   * true ellipse: the hub places it along a composition path (`cometAt`), so
   * the ellipse built here finished 7.6 units away from it and the words were
   * seen being carried to an empty patch of sky.
   *
   * So the ellipse is kept for its shape — that is what reads as "up the
   * line" — and bent onto the target by an offset that is zero at the planet
   * and the full miss at the comet. Eased, so the correction is spread over
   * the flight instead of appearing as a swerve at the end.
   */
  const path = useMemo(() => {
    const target = displayedProgress(progress);
    const raw: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const f = (target * i) / 48;
      const world = toWorld(displayOrbitPoint(f), rotation);
      raw.push(planet.clone().add(new THREE.Vector3(world.x, world.y, world.z)));
    }

    const comet = new THREE.Vector3(...cometAt(progress, size.width, size.height));
    const miss = comet.clone().sub(raw[raw.length - 1]);

    const points = raw.map((point, i) => {
      const u = i / (raw.length - 1);
      // Smoothstep: no kink at either end, all of the correction spent by the
      // time it arrives.
      return point.clone().addScaledVector(miss, u * u * (3 - 2 * u));
    });

    // It starts at the planet's surface rather than its centre.
    points[0] = planet
      .clone()
      .add(points[1].clone().sub(planet).normalize().multiplyScalar(PLANET_RADIUS));
    return new THREE.CatmullRomCurve3(points);
  }, [planet, rotation, progress, size.width, size.height]);

  const streak = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    );
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: "#f3d7a4",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
  }, []);

  /*
   * A warm bloom where it arrives (rev 7.1 §11). Quieter than the reply's —
   * the flash only, sixty pixels across, no sparks — because the two mean
   * different things: the reply *overtook* something, and this is a parcel
   * being put safely aboard. Then the warm strand lights, as before.
   */
  useFrame(({ clock }, delta) => {
    if (finished.current) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;

    const duration = (reducedMotion ? REDUCED_MS : BOARD_MS) / 1000;
    const t = Math.min((clock.elapsedTime - startedAt.current) / duration, 1);

    // Quick away, easing into the comet: it arrives rather than collides.
    const along = easeInOutSine(t);
    const position = path.getPoint(Math.min(along, 1));

    if (spark.current) {
      spark.current.position.copy(position);
      // A soft warm brightening as it merges into the coma.
      const merging = Math.max(0, (t - 0.88) / 0.12);
      spark.current.scale.setScalar(1 + merging * 2.2);
      const material = spark.current.material as THREE.Material & { opacity: number };
      material.opacity = Math.min(t * 8, 1) * (1 - merging * 0.4);
    }
    if (light.current) {
      light.current.position.copy(position);
      light.current.intensity = 1.6 + (t > 0.88 ? 1.4 : 0);
    }

    // A short warm streak behind it, gone by the time it arrives.
    const attribute = streak.geometry.getAttribute("position");
    const array = attribute.array as Float32Array;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const back = path.getPoint(Math.max(0, Math.min(along - (i / TRAIL_POINTS) * 0.14, 1)));
      array[i * 3] = back.x;
      array[i * 3 + 1] = back.y;
      array[i * 3 + 2] = back.z;
    }
    attribute.needsUpdate = true;
    const material = streak.material as THREE.Material & { opacity: number };
    material.opacity = THREE.MathUtils.damp(material.opacity, t > 0.9 ? 0 : 0.45, 6, delta);

    if (t >= 1) {
      finished.current = true;
      onBloom?.({
        at: [position.x, position.y, position.z],
        reachPx: 60,
        sparks: false,
        color: "#f3d7a4",
      });
      onDone();
    }
  });

  return (
    <group>
      <primitive object={streak} />
      <mesh ref={spark}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial
          color="#f3e6cf"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={light} intensity={0} distance={4} color="#f3d7a4" />
    </group>
  );
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
