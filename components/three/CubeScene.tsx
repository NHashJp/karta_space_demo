"use client";

import { Suspense, useMemo, useRef } from "react";
import type { ClientMemory } from "@/lib/clientCard";
import { trailSeed } from "@/lib/trailColour";
import { orbitRotation } from "@/lib/cometOrbit";
import { trailControlPoints, trailSeedFor } from "@/lib/trailCurve";
import { Canvas } from "@react-three/fiber";
import type { CardFace } from "@/types/card";
import type { CameraPhase } from "@/lib/experienceState";
import { CameraRig } from "./CameraRig";
import { MessageCube } from "./MessageCube";
import { OrbitScene, SatelliteCarrier } from "./OrbitScene";
import { Comet, type CometTone } from "./Comet";
import { MemoryPanel } from "./MemoryPanel";
import { CapsuleBoarding } from "./CapsuleBoarding";
import { CometDeparture } from "./CometDeparture";
import { MeteorShower } from "./MeteorShower";
import { ReplyStar } from "./ReplyStar";
import { RocketLaunch } from "./RocketLaunch";
import { Trail } from "./Trail";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { FOV } from "./framing";

/** The one comet, resolved to the numbers the scene needs. */
export type SceneComet = {
  /** Today's progress along its orbit, 0 = just left, 1 = back. */
  progress: number;
  leftOn: string;
  /** The receiver's words are aboard: a warm strand runs through the tail. */
  aboard: boolean;
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
  /** The comet on its long orbit (§11.2). */
  comet?: SceneComet;
  /** Its dotted orbit is drawn while the chart is up. */
  showCometOrbit?: boolean;
  /** A reply is on its way up, or has already settled as a star (§10.3). */
  launching?: boolean;
  launched?: boolean;
  onLaunchEnd?: () => void;
  /** A comet is on its way out (§11.4). */
  /** The comet moment (§8.4, §8.7). */
  departing?: boolean;
  onDepartEnd?: () => void;
  boarding?: boolean;
  onBoardEnd?: () => void;
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
  comet,
  showCometOrbit,
  launching,
  launched,
  onLaunchEnd,
  departing,
  onDepartEnd,
  boarding,
  onBoardEnd,
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
  // The comet's orbit is rotated by its own seed, and the departure and the
  // boarding both have to fly along exactly that orbit.
  const cometRotation = useMemo(
    () => (comet ? orbitRotation(slug, comet.leftOn) : 0),
    [slug, comet],
  );

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
        The comet is drawn from its dates, so it is simply *where it is* — no
        animation, no state. It is hidden only while the departure is flying
        it out, which is the one time something else is drawing it.
      */}
      {deployed && comet && !departing ? (
        <Comet
          progress={comet.progress}
          slug={slug}
          releasedOn={comet.leftOn}
          tone={comet.aboard ? "receiver" : "sender"}
          reducedMotion={cube.reducedMotion}
          showOrbit={showCometOrbit}
          onSelect={comet.onSelect}
        />
      ) : null}

      {departing && comet && onDepartEnd ? (
        <CometDeparture
          progress={comet.progress}
          rotation={cometRotation}
          reducedMotion={cube.reducedMotion}
          onDone={onDepartEnd}
        />
      ) : null}

      {boarding && comet && onBoardEnd ? (
        <CapsuleBoarding
          progress={comet.progress}
          rotation={cometRotation}
          reducedMotion={cube.reducedMotion}
          onDone={onBoardEnd}
        />
      ) : null}

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
