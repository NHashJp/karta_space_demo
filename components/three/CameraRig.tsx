"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  INSIDE_DISTANCE,
  ORBIT_DISTANCE,
  TRAIL_DISTANCE,
  ZOOM_DISTANCE,
  ZOOM_IN_MS,
  ZOOM_INSIDE_MS,
  ZOOM_OUT_MS,
  ZOOM_REDUCED_MS,
  cameraDistance,
} from "./framing";
import { easeInOutQuint } from "./rotationPresets";
import { DRIFT_MS, REWIND_MS, RESURFACE_MS } from "@/lib/timing";
import type { CameraPhase } from "@/lib/experienceState";

type Props = {
  /** far on the landing and closing screens, near while reading, inside the cube. */
  phase: CameraPhase;
  /**
   * Which stop along the trail the camera is heading for. The phase alone is
   * not enough there: moving from one memory to the next never leaves "trail",
   * so without this the rig would think it had already arrived and the second
   * memory would never announce itself.
   */
  leg?: number;
  reducedMotion: boolean;
  onArrive: () => void;
};

/**
 * Sole owner of the camera's distance: it frames the cube responsively, dollies
 * in when the card opens, out when it closes, and through the wall when the
 * card has something inside it.
 */
export function CameraRig({ phase, leg = 0, reducedMotion, onArrive }: Props) {
  const { camera, size } = useThree();

  const reading = cameraDistance(size.width, size.height);
  const waiting = reading + ZOOM_DISTANCE;
  const target =
    phase === "inside"
      ? INSIDE_DISTANCE
      : phase === "near"
        ? reading
        : phase === "orbit"
          ? ORBIT_DISTANCE
          : phase === "trail"
            ? TRAIL_DISTANCE
            : waiting;

  // One identity for "where the camera should be", so a move along the trail
  // counts as a move even though the phase has not changed.
  const pose = `${phase}:${phase === "trail" ? leg : 0}`;

  const from = useRef(target);
  const to = useRef(target);
  const startedAt = useRef(0);
  const duration = useRef(0);
  const running = useRef(false);
  const mounted = useRef(false);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  const previousPose = useRef(pose);

  useEffect(() => {
    // First paint: sit at the target rather than drifting toward it.
    if (!mounted.current) {
      mounted.current = true;
      previousPose.current = pose;
      to.current = target;
      camera.position.set(0, 0, target);
      camera.lookAt(0, 0, 0);
      return;
    }

    // A resize only re-frames — retarget without animating.
    if (previousPose.current === pose) {
      to.current = target;
      if (!running.current) {
        camera.position.z = target;
        camera.lookAt(0, 0, 0);
      }
      return;
    }

    const leavingTrail = previousPose.current.startsWith("trail:");
    previousPose.current = pose;
    from.current = camera.position.z;
    to.current = target;
    startedAt.current = performance.now();
    duration.current = reducedMotion
      ? ZOOM_REDUCED_MS
      : phase === "inside"
        ? ZOOM_INSIDE_MS
        : phase === "near"
          ? ZOOM_IN_MS
          : phase === "trail"
            ? // Along the trail the camera is already there; only arriving on
              // it from orbit is a journey.
              leavingTrail
              ? DRIFT_MS
              : REWIND_MS
            : leavingTrail
              ? RESURFACE_MS
              : ZOOM_OUT_MS;
    running.current = true;
  }, [camera, phase, pose, target, reducedMotion]);

  useFrame(() => {
    if (!running.current) return;
    const t = Math.min((performance.now() - startedAt.current) / duration.current, 1);
    camera.position.z = THREE.MathUtils.lerp(from.current, to.current, easeInOutQuint(t));
    // Still the origin, even from inside: at z = INSIDE_DISTANCE that is a look
    // straight down -z, at the far wall.
    camera.lookAt(0, 0, 0);

    if (t >= 1) {
      camera.position.z = to.current;
      running.current = false;
      arrive.current();
    }
  });

  return null;
}
