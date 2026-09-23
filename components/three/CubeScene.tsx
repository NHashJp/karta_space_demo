"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import type { CardFace } from "@/types/card";
import type { CameraPhase } from "@/lib/experienceState";
import { CameraRig } from "./CameraRig";
import { MessageCube } from "./MessageCube";
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
  /** One short line on the inside of the far wall, if this card has one. */
  secret?: string;
  within: boolean;
  revealSecret: boolean;
  /** Closing screen: cube and scene recede so the drawn message reads clearly. */
  dimmed: boolean;
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
  dimmed,
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
      <Suspense fallback={null}>
        <MessageCube {...cube} dimmed={dimmed} />
      </Suspense>
    </Canvas>
  );
}
