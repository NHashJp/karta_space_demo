"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BrightStars } from "./BrightStars";
import { DustMotes } from "./DustMotes";
import { NebulaBackdrop } from "./NebulaBackdrop";
import { Starfield } from "./Starfield";
import { WanderingLights } from "./WanderingLights";
import { keyLight } from "@/lib/sceneLight";

type Props = {
  reducedMotion: boolean;
  /** Closing screen: pull the scene back so the drawn message can be read. */
  dimmed: boolean;
  /** Shifts this card's sun to a different point in the same slow sweep. */
  seed: number;
  /** The satellite or a comet has come back: the day is a warmer one. */
  returned?: boolean;
  /**
   * In the hub the sky turns slowly about the planet's axis (rev 6 §3.2).
   * That turn *is* the orbit: the satellite holds its place, so the only way
   * the motion can be felt is from behind it.
   */
  skyTurning?: boolean;
};

/**
 * Near-black void, nebula dust, shining stars, drifting lights (spec §14),
 * layered front to back as spec v0.2 §23.2 sets out.
 */
export function SpaceEnvironment({
  reducedMotion,
  dimmed,
  seed,
  returned = false,
  skyTurning = false,
}: Props) {
  return (
    <>
      <color attach="background" args={["#05070c"]} />

      <NebulaBackdrop reducedMotion={reducedMotion} dimmed={dimmed} />
      <Starfield reducedMotion={reducedMotion} turning={skyTurning} />
      <BrightStars reducedMotion={reducedMotion} />

      {/* Ambient and a violet fill; the sun itself moves, below. */}
      <ambientLight intensity={0.5} color="#b0b4ba" />
      <KeyLight seed={seed} returned={returned} reducedMotion={reducedMotion} />
      <directionalLight position={[-5, -2, 3]} intensity={0.35} color="#5d4b94" />

      <WanderingLights reducedMotion={reducedMotion} dimmed={dimmed} />
      <DustMotes reducedMotion={reducedMotion} />
    </>
  );
}

/**
 * The one light everything else agrees about (§23.3). Its direction comes from
 * `lib/sceneLight.ts` rather than from here, so the planet's terminator, the
 * glint on the satellite's panels and this light cannot drift apart.
 */
const DISTANCE = 12;

function KeyLight({
  seed,
  returned,
  reducedMotion,
}: {
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
}) {
  const light = useRef<THREE.DirectionalLight>(null);

  useFrame(({ clock }) => {
    const target = light.current;
    if (!target) return;
    const sun = keyLight(clock.elapsedTime, seed, returned, { reducedMotion });
    target.position.set(sun.dir[0] * DISTANCE, sun.dir[1] * DISTANCE, sun.dir[2] * DISTANCE);
    target.intensity = 1.35 * sun.intensity;
    target.color.set(sun.color);
  });

  return <directionalLight ref={light} intensity={1.35} color="#fff4e6" />;
}
