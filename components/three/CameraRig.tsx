"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  ZOOM_DISTANCE,
  ZOOM_IN_MS,
  ZOOM_OUT_MS,
  ZOOM_REDUCED_MS,
  cameraDistance,
} from "./framing";
import { easeInOutQuint } from "./rotationPresets";

type Props = {
  /** True while the card is being read; false on the landing and closing screens. */
  near: boolean;
  reducedMotion: boolean;
  onArrive: () => void;
};

/**
 * Sole owner of the camera's distance: it frames the cube responsively and
 * dollies in when the card opens, out when it closes.
 */
export function CameraRig({ near, reducedMotion, onArrive }: Props) {
  const { camera, size } = useThree();

  const reading = cameraDistance(size.width, size.height);
  const waiting = reading + ZOOM_DISTANCE;
  const target = near ? reading : waiting;

  const from = useRef(target);
  const to = useRef(target);
  const startedAt = useRef(0);
  const duration = useRef(0);
  const running = useRef(false);
  const mounted = useRef(false);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  const previousPhase = useRef(near);

  useEffect(() => {
    // First paint: sit at the target rather than drifting toward it.
    if (!mounted.current) {
      mounted.current = true;
      previousPhase.current = near;
      to.current = target;
      camera.position.set(0, 0, target);
      camera.lookAt(0, 0, 0);
      return;
    }

    // A resize only re-frames — retarget without animating.
    if (previousPhase.current === near) {
      to.current = target;
      if (!running.current) {
        camera.position.z = target;
        camera.lookAt(0, 0, 0);
      }
      return;
    }

    previousPhase.current = near;
    from.current = camera.position.z;
    to.current = target;
    startedAt.current = performance.now();
    duration.current = reducedMotion
      ? ZOOM_REDUCED_MS
      : near
        ? ZOOM_IN_MS
        : ZOOM_OUT_MS;
    running.current = true;
  }, [camera, near, target, reducedMotion]);

  useFrame(() => {
    if (!running.current) return;
    const t = Math.min((performance.now() - startedAt.current) / duration.current, 1);
    camera.position.z = THREE.MathUtils.lerp(from.current, to.current, easeInOutQuint(t));
    camera.lookAt(0, 0, 0);

    if (t >= 1) {
      camera.position.z = to.current;
      running.current = false;
      arrive.current();
    }
  });

  return null;
}
