"use client";

import { createContext, useContext, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  hubPlanetScreen,
  hubSun,
  hubSunDirection,
  hubSunScreen,
  type ScreenDisc,
  type Vec3,
} from "./framing";
import { dawn, stillDawn, sunVisibility, type Dawn } from "@/lib/dawn";
import type { CometStatus } from "@/lib/cometOrbit";

/**
 * The dawn, resolved for this viewport, shared by everything that draws in it
 * (rev 7.1 §3, §5).
 *
 * A context rather than a prop, for one reason worth stating: the sun is now
 * a fact about the *scene*, not about any one object in it. The planet's
 * crescent, the rim on the satellite, the glint on a cubesat's panel, the
 * colour of the haze and the direction a comet's tail points are all the same
 * sun, and in revision 6 each of them had its own idea of where the light was
 * coming from. The one way to guarantee they cannot drift apart is for there
 * to be one answer, computed once per viewport.
 *
 * `active` is false everywhere r7 changes nothing (§3): the landing screen,
 * the reading of the card, the closing screen. There it still *provides* a
 * dawn — the sky's colours are wanted in the chart and the close-up — but it
 * withholds the sun, which is what keeps `keyLight` on r5's arc for the three
 * screens that are supposed to look exactly as they did.
 */
export type HubDawn = {
  d: Dawn;
  /** True in the orbit scene, where the staged sun applies. */
  active: boolean;
  /** Unit vector from the satellite towards the sun, or undefined if inactive. */
  toSun?: Vec3;
  /** The sun in world space, at the planet's depth. */
  sun: Vec3;
  /** The sun on screen, in CSS pixels. */
  sunScreen: [number, number];
  /** The planet's disc on screen. */
  planet: ScreenDisc;
  /** How far the disc has cleared the limb: 0 below, 1 fully up. */
  visibility: number;
};

const DawnContext = createContext<HubDawn | null>(null);

/**
 * The dawn, or a still one.
 *
 * It does **not** throw without a provider. Several of these components are
 * mounted by scenes that have no card behind them at all — the editor's
 * preview, and the sender's comet page before its dates are known — and a
 * missing provider there is not a bug, it is a scene with no countdown. What
 * it gets is the floor: blue hour, no staged sun, which is what `active:
 * false` means everywhere else.
 */
export function useDawn(): HubDawn {
  const value = useContext(DawnContext);
  return value ?? STILL;
}

const STILL: HubDawn = {
  d: stillDawn(),
  active: false,
  sun: [0, 0, 0],
  sunScreen: [0, 0],
  planet: { cx: 0, cy: 0, r: 1 },
  visibility: 0,
};

type Props = {
  /** The comet's progress in its current cycle, or undefined with no comet. */
  f?: number;
  status?: CometStatus;
  /** The orbit scene is mounted: the staged sun applies (§3). */
  active: boolean;
  children: React.ReactNode;
};

export function DawnProvider({ f, status, active, children }: Props) {
  const size = useThree((state) => state.size);

  const value = useMemo<HubDawn>(() => {
    const portrait = size.width < size.height;
    // A card with no comet has no countdown, so it holds at the floor: blue
    // hour with a gold line on the horizon, which is still not night.
    const d =
      f === undefined || status === undefined
        ? stillDawn({ portrait })
        : dawn(f, status, { portrait });

    return {
      d,
      active,
      toSun: active
        ? hubSunDirection(size.width, size.height, d.sunElevation)
        : undefined,
      sun: hubSun(size.width, size.height, d.sunElevation),
      sunScreen: hubSunScreen(size.width, size.height, d.sunElevation),
      planet: hubPlanetScreen(size.width, size.height),
      visibility: sunVisibility(d),
    };
  }, [f, status, active, size.width, size.height]);

  return <DawnContext.Provider value={value}>{children}</DawnContext.Provider>;
}
