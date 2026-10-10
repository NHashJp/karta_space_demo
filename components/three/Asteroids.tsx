"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  PASS_MEAN_S,
  POOL,
  SHAPES,
  asteroidPasses,
  type AsteroidPass,
} from "@/lib/asteroids";
import { companyLevel } from "@/lib/orbiters";

/**
 * Debris crossing the hub, roughly every half minute (rev 6 §3.2).
 *
 * The timetable and every path come from `lib/asteroids.ts`; this draws them
 * and nothing else. That split is deliberate — the one hard requirement is
 * that a rock never touches the satellite, and that is checked in the verify
 * suite against the pure module, which means no change to this file can break
 * it without the check noticing.
 *
 * `POOL` meshes are recycled rather than mounted per pass. A pass is a thing
 * with a start time, not a React component: mounting one would mean a render
 * every thirty seconds, and the frame that mounts it is the frame it has to
 * already be moving in.
 */

/** Enough timetable for a three-hour sitting at the usual pace; a busier sky
 *  gets proportionally more. Nobody will reach the end. */
const SCHEDULE = 400;

/** Lit by the one key light, like everything else, so they read as rock. */
const DARK = new THREE.Color("#6d6559");
const PALE = new THREE.Color("#a89c8c");

/**
 * A rock.
 *
 * The displacement is a function of *position*, not of vertex index, and that
 * is not a style choice: an icosahedron geometry is non-indexed, so each
 * corner appears in three faces as three separate vertices. Pushing them by
 * index moves the same corner three different ways and tears the mesh open.
 * A function of where the vertex is moves all three copies identically.
 */
function rock(shape: number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const s = 1 + shape * 2.7;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const lump =
      1 +
      0.17 * Math.sin(2.8 * x + s) * Math.cos(3.3 * y + s * 1.7) +
      0.13 * Math.sin(4.1 * z + s * 2.3) * Math.cos(2.2 * x - s);
    position.setXYZ(i, x * lump, y * lump, z * lump);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function Asteroids({
  seed,
  company = 1,
  reducedMotion,
}: {
  /** The card's own, so two cards never share a timetable. */
  seed: number;
  /** The card's `company`: a busier sky sends rocks past that much more often. */
  company?: number;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  /*
   * When the hub opened. The component is mounted with the hub and unmounted
   * when the reader leaves it, so coming back starts the timetable again
   * rather than resuming one that has been running out of sight — which is
   * both cheaper and better: nobody returns to the hub and is owed a rock.
   */
  const started = useRef<number | null>(null);
  /** Which pass each pool slot is flying, or null if it is free. */
  const flying = useRef<(AsteroidPass | null)[]>(Array.from({ length: POOL }, () => null));
  const cursor = useRef(0);

  const passes = useMemo(() => {
    const level = companyLevel(company);
    return asteroidPasses(seed, Math.ceil(SCHEDULE * level), PASS_MEAN_S / level);
  }, [seed, company]);
  const shapes = useMemo(() => Array.from({ length: SHAPES }, (_, i) => rock(i)), []);

  // r3f disposes what JSX owns; a geometry handed in as a prop is ours.
  useEffect(() => () => shapes.forEach((geometry) => geometry.dispose()), [shapes]);

  useFrame(({ clock }) => {
    const parent = group.current;
    if (!parent) return;
    if (started.current === null) started.current = clock.elapsedTime;
    const now = clock.elapsedTime - started.current;

    // Retire anything that has finished crossing.
    for (let slot = 0; slot < POOL; slot++) {
      const pass = flying.current[slot];
      if (pass && now > pass.startAt + pass.duration) flying.current[slot] = null;
    }

    // Admit anything whose time has come.
    while (cursor.current < passes.length && passes[cursor.current].startAt <= now) {
      const pass = passes[cursor.current];
      cursor.current++;
      /*
       * Already over. The clock does not advance while the tab is in the
       * background — no frames, no deltas — and then the first frame back
       * carries the whole gap at once, which can step clean over a crossing.
       * Starting it halfway would put a rock in the middle of the frame out of
       * nowhere, so a pass that was missed is simply missed.
       */
      if (now > pass.startAt + pass.duration) continue;

      const free = flying.current.indexOf(null);
      /*
       * Nothing free, so this one is not drawn. The pool is sized from the
       * timetable and verify asserts it is deep enough across sixty cards, so
       * this should never happen — it is here because the alternative to a
       * dropped pass is an exception in the middle of the render loop.
       */
      if (free === -1) continue;
      flying.current[free] = pass;

      const mesh = parent.children[free] as THREE.Mesh;
      mesh.geometry = shapes[pass.shape];
      (mesh.material as THREE.MeshStandardMaterial).color
        .copy(DARK)
        .lerp(PALE, pass.tint);
      mesh.scale.setScalar(pass.radius);
    }

    // Fly them.
    for (let slot = 0; slot < POOL; slot++) {
      const pass = flying.current[slot];
      const mesh = parent.children[slot] as THREE.Mesh;
      if (!pass) {
        mesh.visible = false;
        continue;
      }

      const local = now - pass.startAt;
      const travelled = pass.speed * local;
      mesh.visible = true;
      mesh.position.set(
        pass.from[0] + pass.direction[0] * travelled,
        pass.from[1] + pass.direction[1] * travelled,
        pass.from[2] + pass.direction[2] * travelled,
      );
      // Absolute rather than accumulated, so a dropped frame cannot drift it.
      mesh.rotation.set(
        pass.spin[0] * local,
        pass.spin[1] * local,
        pass.spin[2] * local,
      );
    }
  });

  /*
   * Reduced motion gets none, for the same reason the meteor shower does not
   * appear: a rock crossing the frame is motion with no still equivalent —
   * parked somewhere it is a lump in the sky that was never there before — and
   * nothing in the card depends on having seen one.
   */
  if (reducedMotion) return null;

  return (
    <group ref={group}>
      {/*
        Frustum culling stays **on**, unlike the sky around it. The nebula and
        the starfield are enormous and centred on the camera, so culling them
        only ever costs; a rock is small and spends most of its crossing
        outside the frame, which is precisely the case culling is for.
      */}
      {Array.from({ length: POOL }, (_, slot) => (
        <mesh key={slot} geometry={shapes[0]} visible={false}>
          <meshStandardMaterial color={DARK} roughness={0.94} metalness={0.06} flatShading />
        </mesh>
      ))}
    </group>
  );
}
