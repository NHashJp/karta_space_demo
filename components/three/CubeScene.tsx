"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import type { CardFace } from "@/types/card";
import type { CameraPhase } from "@/lib/experienceState";
import { CameraRig } from "./CameraRig";
import { MessageCube } from "./MessageCube";
import { OrbitScene, SatelliteCarrier } from "./OrbitScene";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { FOV } from "./framing";

type Props = {
  faces: CardFace[];
  activeFace: number;
  isTransitioning: boolean;
  /** Text is only attached to the face while the card is actually being read. */
  revealText: boolean;
  /** Where the camera should be: far back, at the face, or inside the cube. */
  cameraPhase: CameraPhase;
  /** Which stop along the trail, when the camera is on it. */
  cameraLeg?: number;
  /** This card's light seed, and whether its day is a warm one (§23.3). */
  seed: number;
  returned?: boolean;
  /** The camera breathes only where nothing is being read (§23.2). */
  atRest: boolean;
  /** How many memories hang on the trail, which sets where its stops are. */
  memoryCount?: number;
  /** One short line on the inside of the far wall, if this card has one. */
  secret?: string;
  within: boolean;
  revealSecret: boolean;
  /** Closing screen: cube and scene recede so the drawn message reads clearly. */
  dimmed: boolean;
  /**
   * 0 while the cube is the letter, 1 once it is a satellite in orbit. The
   * deployment is the journey between, and it is the cube that drives it.
   */
  presence: number;
  reducedMotion: boolean;
  onTransitionEnd: () => void;
  onZoomEnd: () => void;
};

export function CubeScene({
  cameraPhase,
  cameraLeg,
  seed,
  returned,
  atRest,
  memoryCount,
  dimmed,
  presence,
  onZoomEnd,
  ...cube
}: Props) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: FOV, position: [0, 0, 16], near: 0.1, far: 120 }}
    >
      <CameraRig
        phase={cameraPhase}
        leg={cameraLeg}
        memoryCount={memoryCount}
        seed={seed}
        breathing={atRest}
        reducedMotion={cube.reducedMotion}
        onArrive={onZoomEnd}
      />
      <SpaceEnvironment
        reducedMotion={cube.reducedMotion}
        dimmed={dimmed}
        seed={seed}
        returned={returned}
      />
      {/* A card without an orbit never pays for a planet it does not have. */}
      {presence > 0 ? (
        <OrbitScene
          seed={seed}
          returned={Boolean(returned)}
          reducedMotion={cube.reducedMotion}
          presence={presence}
        />
      ) : null}

      <Suspense fallback={null}>
        <SatelliteCarrier presence={presence} reducedMotion={cube.reducedMotion}>
          <MessageCube {...cube} dimmed={dimmed} />
        </SatelliteCarrier>
      </Suspense>
    </Canvas>
  );
}
