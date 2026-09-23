"use client";

import { Suspense, useMemo, useRef } from "react";
import type { ClientMemory } from "@/lib/clientCard";
import { trailSeed } from "@/lib/trailColour";
import { trailControlPoints, trailSeedFor } from "@/lib/trailCurve";
import { Canvas } from "@react-three/fiber";
import type { CardFace } from "@/types/card";
import type { CameraPhase } from "@/lib/experienceState";
import { CameraRig } from "./CameraRig";
import { MessageCube } from "./MessageCube";
import { OrbitScene, SatelliteCarrier } from "./OrbitScene";
import { Comet, type CometTone } from "./Comet";
import { MemoryPanel } from "./MemoryPanel";
import { MeteorShower } from "./MeteorShower";
import { ReplyStar } from "./ReplyStar";
import { RocketLaunch } from "./RocketLaunch";
import { Trail } from "./Trail";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { FOV } from "./framing";

/** One comet, already resolved to the numbers the scene needs. */
export type SceneComet = {
  key: string;
  progress: number;
  releasedOn: string;
  tone: CometTone;
  onSelect?: () => void;
};

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
  /** The memories that hang on the trail, newest first. */
  memories?: ClientMemory[];
  /** Which one is being read, and whether its words are attached yet. */
  activeMemory?: number;
  revealMemory?: boolean;
  /** The card's slug seeds its trail's shape and its colours. */
  slug: string;
  /** The comets on their long orbits, and which panel is open (§11.2). */
  comets?: SceneComet[];
  openPanel?: string | null;
  /** A reply is on its way up, or has already settled as a star (§10.3). */
  launching?: boolean;
  launched?: boolean;
  onLaunchEnd?: () => void;
  /** One short line on the inside of the far wall, if this card has one. */
  secret?: string;
  within: boolean;
  revealSecret: boolean;
  /** Closing screen: cube and scene recede so the drawn message reads clearly. */
  dimmed: boolean;
  /**
   * Which way the deployment is running, if it is. The cube owns the
   * animation and announces its own end (spec v0.2 §8.2).
   */
  deploying?: "out" | "in" | null;
  /** True whenever the cube should be drawn in its satellite form. */
  deployed: boolean;
  onDeployEnd?: () => void;
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
  memories,
  activeMemory = 0,
  revealMemory = false,
  slug,
  comets,
  openPanel,
  launching,
  launched,
  onLaunchEnd,
  dimmed,
  deploying,
  deployed,
  onDeployEnd,
  onZoomEnd,
  ...cube
}: Props) {
  /*
   * How far the cube has become a satellite, written by `MessageCube` each
   * frame and read by the carrier that flies it and the ring that fades in
   * under it. A ref rather than state: it changes 60 times a second, and none
   * of those should be React renders.
   */
  const presence = useRef(deployed ? 1 : 0);

  // The trail's shape and its colours are both seeded from the slug, so a card
  // keeps the same trail on every visit and no two cards share one.
  const curveSeed = useMemo(() => trailSeedFor(slug), [slug]);
  const colourSeed = useMemo(() => trailSeed(slug), [slug]);
  const trail = useMemo(() => trailControlPoints(curveSeed), [curveSeed]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: FOV, position: [0, 0, 16], near: 0.1, far: 120 }}
    >
      <CameraRig
        phase={cameraPhase}
        leg={cameraLeg}
        memoryCount={memories?.length ?? 0}
        seed={curveSeed}
        trail={trail}
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
      {deployed ? (
        <OrbitScene
          seed={seed}
          returned={Boolean(returned)}
          reducedMotion={cube.reducedMotion}
          presence={presence}
        />
      ) : null}

      {/*
        Comets are drawn from their dates, so they are simply *where they are*
        — no animation, no state. Opening the comet panel shows their orbits.
      */}
      {deployed && comets
        ? comets.map((comet) => (
            <Comet
              key={comet.key}
              progress={comet.progress}
              slug={slug}
              releasedOn={comet.releasedOn}
              tone={comet.tone}
              reducedMotion={cube.reducedMotion}
              showOrbit={openPanel === "comet"}
              onSelect={comet.onSelect}
            />
          ))
        : null}

      {launching && onLaunchEnd ? (
        <RocketLaunch reducedMotion={cube.reducedMotion} onDone={onLaunchEnd} />
      ) : null}
      {deployed && launched && !launching ? (
        <ReplyStar reducedMotion={cube.reducedMotion} />
      ) : null}

      {/* Once, on the day, and never again while the page is open. */}
      {deployed && returned ? <MeteorShower reducedMotion={cube.reducedMotion} /> : null}

      {/*
        The trail exists from the landing screen onwards, faintly, so the card
        hints at what is behind it before anyone has been told (§7).
      */}
      {memories?.length ? (
        <Trail
          points={trail}
          seed={colourSeed}
          memoryCount={memories.length}
          reducedMotion={cube.reducedMotion}
          intensity={cameraPhase === "trail" || cameraPhase === "orbit" ? 1 : 0.25}
        />
      ) : null}

      {/*
        Only the memory being read and its immediate neighbours are mounted as
        full panels; the rest are the glints the trail already draws (§9.2).
      */}
      {cameraPhase === "trail" && memories
        ? memories.map((memory, index) =>
            Math.abs(index - activeMemory) <= 1 ? (
              <MemoryPanel
                key={index}
                memory={memory}
                index={index}
                count={memories.length}
                points={trail}
                seed={colourSeed}
                revealed={revealMemory && index === activeMemory}
                reducedMotion={cube.reducedMotion}
              />
            ) : null,
          )
        : null}

      <Suspense fallback={null}>
        <SatelliteCarrier
          presence={presence}
          reducedMotion={cube.reducedMotion}
          returned={returned}
        >
          <MessageCube
            {...cube}
            dimmed={dimmed}
            deploying={deploying}
            progress={presence}
            onDeployEnd={onDeployEnd}
            seed={seed}
            returned={returned}
          />
        </SatelliteCarrier>
      </Suspense>
    </Canvas>
  );
}
