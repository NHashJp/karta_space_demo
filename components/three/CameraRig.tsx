"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  INSIDE_DISTANCE,
  ZOOM_DISTANCE,
  ZOOM_IN_MS,
  ZOOM_INSIDE_MS,
  ZOOM_OUT_MS,
  ZOOM_REDUCED_MS,
  cameraDistance,
} from "./framing";
import { easeInOutQuint } from "./rotationPresets";
import type { CameraPhase } from "@/lib/experienceState";

type Props = {
  /** far on the landing and closing screens, near while reading, inside the cube. */
  phase: CameraPhase;
  reducedMotion: boolean;
  onArrive: () => void;
};

/**
 * Sole owner of the camera's distance: it frames the cube responsively, dollies
 * in when the card opens, out when it closes, and through the wall when the
 * card has something inside it.
 */
export function CameraRig({ phase, reducedMotion, onArrive }: Props) {
  const { camera, size } = useThree();

  const reading = cameraDistance(size.width, size.height);
  const waiting = reading + ZOOM_DISTANCE;
  const target = phase === "inside" ? INSIDE_DISTANCE : phase === "near" ? reading : waiting;

  const from = useRef(target);
  const to = useRef(target);
  const startedAt = useRef(0);
  const duration = useRef(0);
  const running = useRef(false);
  const mounted = useRef(false);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  const previousPhase = useRef(phase);

  useEffect(() => {
    // First paint: sit at the target rather than drifting toward it.
    if (!mounted.current) {
      mounted.current = true;
      previousPhase.current = phase;
      to.current = target;
      camera.position.set(0, 0, target);
      camera.lookAt(0, 0, 0);
      return;
    }

    // A resize only re-frames — retarget without animating.
    if (previousPhase.current === phase) {
      to.current = target;
      if (!running.current) {
        camera.position.z = target;
        camera.lookAt(0, 0, 0);
      }
      return;
    }

    previousPhase.current = phase;
    from.current = camera.position.z;
    to.current = target;
    startedAt.current = performance.now();
    duration.current = reducedMotion
      ? ZOOM_REDUCED_MS
      : phase === "inside"
        ? ZOOM_INSIDE_MS
        : phase === "near"
          ? ZOOM_IN_MS
          : ZOOM_OUT_MS;
    running.current = true;
  }, [camera, phase, target, reducedMotion]);

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
