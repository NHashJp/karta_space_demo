"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { stagedTrail } from "./framing";
import type { Point3 } from "@/lib/trailCurve";

/**
 * The card's trail, placed into the hub composition (spec v0.2 rev 6, §4.5).
 *
 * Every part of the scene that touches the trail — the ribbon, the memory
 * panels hanging off it, and the camera that travels it — asks for it here,
 * rather than one of them building it and passing it to the others. It is a
 * pure function of the seed and the viewport, so they all get the same curve,
 * and none of them can be handed a stale one after a rotation.
 *
 * The staging is what keeps the trail off the satellite. The raw curve starts
 * at the world origin, which is where revision 6 parks the satellite; drawn
 * unstaged, the first stretch of the trail came out of the middle of the
 * spacecraft.
 */
export function useStagedTrail(seed: number): Point3[] {
  const size = useThree((state) => state.size);
  return useMemo(
    () => stagedTrail(seed, size.width, size.height),
    [seed, size.width, size.height],
  );
}
