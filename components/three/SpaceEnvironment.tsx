"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BrightStars } from "./BrightStars";
import { DustMotes } from "./DustMotes";
import { NebulaBackdrop } from "./NebulaBackdrop";
import { Starfield, TANABATA, TanabataStars } from "./Starfield";
import { WanderingLights } from "./WanderingLights";
import { keyLight } from "@/lib/sceneLight";
import { useDawn } from "./DawnProvider";
import { sky as freshSky, type Sky } from "@/lib/skyAge";

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
  /**
   * How long ago the letter was sent, resolved to a sky (`lib/skyAge.ts`).
   *
   * Everything downstream of this is a *fact about the card*, not a state of
   * the view, so it is the same on the landing screen as it is in the hub: a
   * reader who opens a two-year-old card is further from home from the first
   * frame. Defaulted, so a scene with no card behind it — the comet page —
   * simply gets the sky as sent.
   */
  sky?: Sky;
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
  sky = freshSky(0),
}: Props) {
  return (
    <>
      <color attach="background" args={["#05070c"]} />

      <NebulaBackdrop reducedMotion={reducedMotion} dimmed={dimmed} sky={sky} />
      <Starfield reducedMotion={reducedMotion} turning={skyTurning} brightness={sky.stars} />
      <BrightStars reducedMotion={reducedMotion} />
      {/* Optional, and off by default — see TANABATA for why (r7 §4, R29). */}
      {TANABATA ? <TanabataStars reducedMotion={reducedMotion} /> : null}

      {/* Ambient and a violet fill; the sun itself moves, below. */}
      {/*
        Lifted, so the cube's shadowed faces are dark glass rather than
        cut-outs. The mockups draw the satellite as one pale object seen from
        one side (M5, M14b); with only the key light on it, the three faces
        turned away from the sun fell to black and the box read as a hole in
        the nebula behind it.
      */}
      <ambientLight intensity={0.78} color="#b6bccb" />
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
  const fill = useRef<THREE.DirectionalLight>(null);
  const { d, active, toSun } = useDawn();

  useFrame(({ clock }) => {
    const target = light.current;
    if (!target) return;
    const sun = keyLight(clock.elapsedTime, seed, active ? d : undefined, {
      reducedMotion,
      returned,
      toSun,
    });
    target.position.set(sun.dir[0] * DISTANCE, sun.dir[1] * DISTANCE, sun.dir[2] * DISTANCE);
    target.intensity = 1.35 * sun.intensity;
    target.color.set(sun.color);

    /*
     * The fill (rev 7.1 §5). Low and cool, from the other side, so the face
     * turned away from a low sun is a dark *shape* rather than a hole. It is
     * only mounted in the orbit scene: before the card is deployed the light
     * is r5's, and r5's scenes are supposed to look exactly as they did.
     */
    const bounce = fill.current;
    if (bounce) {
      bounce.position.set(
        sun.fill.dir[0] * DISTANCE,
        sun.fill.dir[1] * DISTANCE,
        sun.fill.dir[2] * DISTANCE,
      );
      bounce.intensity = active ? 1.35 * sun.fill.intensity : 0;
      bounce.color.set(sun.fill.color);
    }
  });

  return (
    <>
      <directionalLight ref={light} intensity={1.35} color="#fff4e6" />
      <directionalLight ref={fill} intensity={0} color="#6f86c4" />
    </>
  );
}
