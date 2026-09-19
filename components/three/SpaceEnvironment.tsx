"use client";

import { NebulaBackdrop } from "./NebulaBackdrop";
import { Starfield } from "./Starfield";
import { WanderingLights } from "./WanderingLights";

type Props = {
  reducedMotion: boolean;
  /** Closing screen: pull the scene back so the drawn message can be read. */
  dimmed: boolean;
};

/** Near-black void, nebula dust, shining stars, drifting lights (spec §14). */
export function SpaceEnvironment({ reducedMotion, dimmed }: Props) {
  return (
    <>
      <color attach="background" args={["#05070c"]} />

      <NebulaBackdrop reducedMotion={reducedMotion} dimmed={dimmed} />
      <Starfield reducedMotion={reducedMotion} />

      {/* Key light keeps the cube's edges and metal legible against the dust. */}
      <ambientLight intensity={0.5} color="#b0b4ba" />
      <directionalLight position={[4, 6, 7]} intensity={1.35} color="#e8e9eb" />
      <directionalLight position={[-5, -2, 3]} intensity={0.35} color="#5d4b94" />

      <WanderingLights reducedMotion={reducedMotion} dimmed={dimmed} />
    </>
  );
}
