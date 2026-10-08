"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";

/**
 * Compiles a hidden part of the scene ahead of time, once.
 *
 * A material's shader program is built the first time it is drawn, and for
 * the orbit's planet, sky, sun and comet that is a noticeable stall — which
 * used to land in the first frames of the deployment, while the cube was
 * turning and unfolding. This builds them while nothing is moving: the
 * target is shown for the length of one `compile` call (which draws nothing)
 * and hidden again in the same frame, so the programs are in the renderer's
 * cache before anyone asks for them.
 */
export function Precompile({
  target,
  when,
}: {
  target: React.RefObject<THREE.Object3D | null>;
  /** Compile on the first frame this is true; once is enough. */
  when: boolean;
}) {
  const { gl, scene, camera } = useThree();
  const done = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    if (when && !done.current) pending.current = true;
  }, [when]);

  useFrame(() => {
    if (!pending.current || done.current) return;
    const object = target.current;
    // Mounted children arrive a frame after the group; wait for them.
    if (!object || object.children.length === 0) return;
    pending.current = false;
    done.current = true;

    const wasVisible = object.visible;
    object.visible = true;
    try {
      gl.compile(scene, camera);
    } finally {
      object.visible = wasVisible;
    }
  });

  return null;
}
