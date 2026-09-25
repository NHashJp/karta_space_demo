"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { seededUnit } from "@/lib/seed";

/**
 * The feeling of speed (spec v0.2 rev 6, §3.2).
 *
 * A satellite that holds its place on screen has a composition problem: it is
 * the right picture and the wrong sensation. Nothing in the frame moves, so
 * nothing says the thing is travelling at eight kilometres a second — it looks
 * parked. The station-keeping drift and the turning sky are both true and both
 * far too slow to read as motion.
 *
 * So: particles, drawn as short streaks, sweeping past the lens. They are the
 * one cue the eye reads as velocity without being told, which is why every
 * flight sim and every warp effect ever made is built out of them. The length
 * of each streak *is* the speed — that is the whole trick, and it is why this
 * cannot be done with round points.
 *
 * Kept honest by two rules:
 *
 * - **At rest they do not exist.** Opacity is the speed, so a still scene is a
 *   still scene. Nothing sparkles behind a paragraph being read.
 * - **They never lead the camera.** The direction comes from where the camera
 *   actually went last frame, so a streak field can never disagree with the
 *   motion it is supposed to be describing.
 */

const COUNT = 150;

/** The cylinder the streaks live in, around the view axis. */
const RADIUS_NEAR = 0.7;
const RADIUS_FAR = 8;
const Z_NEAR = -1.6;
const Z_FAR = -38;

/** World units per second that counts as "full speed". */
const FULL_SPEED = 22;
/** A streak at full speed, in world units. */
const MAX_LENGTH = 3.4;

type Props = {
  seed: number;
  reducedMotion: boolean;
  /**
   * A floor under the speed, for scenes where the camera holds still but the
   * thing it is watching does not — the hub, where the satellite keeps station
   * and the sensation of orbital velocity has to come from somewhere.
   */
  idle?: number;
};

export function SpeedStreaks({ seed, reducedMotion, idle = 0 }: Props) {
  const lines = useRef<THREE.LineSegments>(null);
  const camera = useThree((state) => state.camera);

  /** Each streak's resting place in camera-local space, and its own pace. */
  const field = useMemo(() => {
    const at = new Float32Array(COUNT * 3);
    const pace = new Float32Array(COUNT);

    /*
     * Four draws per streak, so the stride is four.
     *
     * It was three, with the pace taken from `i * 3 + 7` — which is exactly
     * `(i + 2) * 3 + 1`, the angle of the streak two along. Every streak's
     * speed was therefore another streak's direction: a correlation running
     * through the whole field, from an offset that looked like it was just
     * reaching for an unused number.
     */
    for (let i = 0; i < COUNT; i++) {
      const angle = seededUnit(seed, i * 4 + 1) * Math.PI * 2;
      // Square-rooted, so they are spread evenly over the disc rather than
      // crowding the axis — which would read as a tunnel, not as open space.
      const radius =
        RADIUS_NEAR +
        (RADIUS_FAR - RADIUS_NEAR) * Math.sqrt(seededUnit(seed, i * 4 + 2));

      at[i * 3] = Math.cos(angle) * radius;
      at[i * 3 + 1] = Math.sin(angle) * radius;
      at[i * 3 + 2] = Z_NEAR + (Z_FAR - Z_NEAR) * seededUnit(seed, i * 4 + 3);
      // A spread of paces, so the field has depth rather than moving as a sheet.
      pace[i] = 0.55 + seededUnit(seed, i * 4 + 4) * 0.9;
    }

    return { at, pace };
  }, [seed]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3));
    return geo;
  }, []);

  const last = useRef(new THREE.Vector3());
  const travelled = useRef(0);
  /** Smoothed, so a single long frame is not a burst of speed. */
  const eased = useRef(0);

  useFrame((_, delta) => {
    const node = lines.current;
    if (!node) return;

    if (reducedMotion) {
      node.visible = false;
      return;
    }

    // How far the camera actually moved, in world units per second. Measured
    // rather than asked for: a streak field that disagrees with the camera is
    // worse than none, and this cannot.
    const moved = camera.position.distanceTo(last.current);
    const rate = delta > 0 ? moved / delta : 0;
    last.current.copy(camera.position);

    const want = Math.min(Math.max(rate / FULL_SPEED, idle), 1);
    // Rising fast and falling slow: the streaks should arrive with the move
    // and draw out behind it, not blink off the instant the camera lands.
    eased.current = THREE.MathUtils.damp(eased.current, want, want > eased.current ? 9 : 2.6, delta);
    const u = eased.current;
    node.visible = u > 0.01;
    if (!node.visible) return;

    // The field rides with the camera, so it is always around the lens.
    node.position.copy(camera.position);
    node.quaternion.copy(camera.quaternion);

    travelled.current += delta * (0.6 + u * 9);

    const positions = geometry.attributes.position.array as Float32Array;
    const length = MAX_LENGTH * u;
    const span = Z_FAR - Z_NEAR;

    for (let i = 0; i < COUNT; i++) {
      // Drifting towards the lens and wrapping round, so the field never runs
      // out however long the reader stays.
      const drift = (travelled.current * field.pace[i]) % span;
      let z = field.at[i * 3 + 2] + drift;
      if (z > Z_NEAR) z -= span;

      const o = i * 6;
      positions[o] = field.at[i * 3];
      positions[o + 1] = field.at[i * 3 + 1];
      positions[o + 2] = z;
      positions[o + 3] = field.at[i * 3];
      positions[o + 4] = field.at[i * 3 + 1];
      // Trailing *behind* where it is going: the streak is the path just
      // travelled, so it must point back down the direction of travel.
      positions[o + 5] = z - length * field.pace[i];
    }

    geometry.attributes.position.needsUpdate = true;
    const material = node.material as THREE.LineBasicMaterial;
    material.opacity = 0.5 * u;
  });

  return (
    <lineSegments ref={lines} geometry={geometry} frustumCulled={false} visible={false}>
      <lineBasicMaterial
        color="#cfe4f2"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
