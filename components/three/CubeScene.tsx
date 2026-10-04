"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import type { ClientMemory } from "@/lib/clientCard";
import { trailSeed } from "@/lib/trailColour";
import { orbitRotation } from "@/lib/cometOrbit";
import { trailSeedFor } from "@/lib/trailCurve";
import { Canvas } from "@react-three/fiber";
import { Asteroids } from "./Asteroids";
import { ShootingStars } from "./ShootingStars";
import { SpeedStreaks } from "./SpeedStreaks";
import type { CardFace } from "@/types/card";
import type { CameraPhase } from "@/lib/experienceState";
import { CameraRig } from "./CameraRig";
import { MessageCube } from "./MessageCube";
import { OrbitScene, SatelliteCarrier } from "./OrbitScene";
import { DawnProvider } from "./DawnProvider";
import { DawnSky } from "./DawnSky";
import { SunFlare } from "./SunFlare";
import { Orbiters } from "./Orbiters";
import { SignalPulses } from "./SignalPulses";
import { Bloom, type BloomRequest } from "./Bloom";
import { Comet, type CometTone } from "./Comet";
import { MemoryPanel } from "./MemoryPanel";
import { CapsuleBoarding } from "./CapsuleBoarding";
import { CometDeparture } from "./CometDeparture";
import { MeteorShower } from "./MeteorShower";
import { ReplyStar } from "./ReplyStar";
import { RocketLaunch } from "./RocketLaunch";
import { Trail } from "./Trail";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { asteroidSeed } from "@/lib/asteroids";
import { shootingStarSeed } from "@/lib/shootingStars";
import type { Sky } from "@/lib/skyAge";
import type { CometStatus } from "@/lib/cometOrbit";
import { orbiterSeed } from "@/lib/orbiters";
import { FOV } from "./framing";

/** The one comet, resolved to the numbers the scene needs. */
export type SceneComet = {
  /** Today's progress along its orbit, 0 = just left, 1 = back. */
  progress: number;
  /** Where it is in its current cycle, which is what the dawn follows (r7 §3). */
  status: CometStatus;
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
  /** The backdrop, aged by how long ago the letter was sent (`lib/skyAge.ts`). */
  sky: Sky;
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
  /** How long it runs: shorter once the reader has watched it (`REPLAY_SCALE`). */
  deployMs?: number;
  /** True whenever the cube should be drawn in its satellite form. */
  deployed: boolean;
  onDeployEnd?: () => void;
  /** The arrival beat (r7 §11). A counter: each increment is one arrival. */
  propel?: number;
  /** A bloom has just opened, so the card can sound its three bells (§12). */
  onBloom?: () => void;
  reducedMotion: boolean;
  onTransitionEnd: () => void;
  onZoomEnd: () => void;
};

export function CubeScene({
  cameraPhase,
  cameraLeg,
  seed,
  returned,
  sky,
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
  deployMs,
  deployed,
  onDeployEnd,
  propel = 0,
  onBloom,
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
  // The comet's orbit is rotated by its own seed, and the departure and the
  // boarding both have to fly along exactly that orbit.
  const cometRotation = useMemo(
    () => (comet ? orbitRotation(slug, comet.leftOn) : 0),
    [slug, comet],
  );

  /** This card's own sky of orbiting things (r7 §8.2). */
  const orbSeed = useMemo(() => orbiterSeed(slug), [slug]);

  /*
   * The Propel flare, written by the camera rig and read by the sky's haze.
   * A ref rather than state: it changes every frame for 2.4 seconds and not
   * one of those should be a React render.
   */
  const flare = useRef(0);

  /** The hub and everything staged in it (r7 §8.7). */
  const inHub = cameraPhase === "orbit";

  /*
   * Blooms in flight (r7 §11).
   *
   * Held here rather than by the animations that open them, because each of
   * those unmounts the moment its flight is over and a bloom is the *end* of
   * the beat: the sparks should still be settling when the reply star
   * appears. Each one removes itself when it has burned out.
   */
  const [blooms, setBlooms] = useState<(BloomRequest & { id: number })[]>([]);
  const nextBloom = useRef(0);
  const addBloom = useCallback(
    (bloom: BloomRequest) => {
      const id = nextBloom.current++;
      setBlooms((open) => [...open, { ...bloom, id }]);
      onBloom?.();
    },
    [onBloom],
  );
  const endBloom = useCallback((id: number) => {
    setBlooms((open) => open.filter((bloom) => bloom.id !== id));
  }, []);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: FOV, position: [0, 0, 16], near: 0.1, far: 120 }}
    >
      <DawnProvider f={comet?.progress} status={comet?.status} active={deployed}>
      <CameraRig
        phase={cameraPhase}
        leg={cameraLeg}
        memoryCount={memories?.length ?? 0}
        seed={curveSeed}
        breathing={atRest}
        reducedMotion={cube.reducedMotion}
        propel={propel}
        flare={flare}
        onArrive={onZoomEnd}
      />
      <SpaceEnvironment
        reducedMotion={cube.reducedMotion}
        dimmed={dimmed}
        seed={seed}
        returned={returned}
        skyTurning={cameraPhase === "orbit"}
        sky={sky}
      />
      {/*
        The dawn's own sky (r7 §6). Only once the card is deployed: §3 leaves
        the landing screen, the reading and the closing screen exactly as they
        were, and those are the three places this is not mounted.
      */}
      {deployed ? <DawnSky flare={flare} /> : null}

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
        The sun, coming up behind the planet. In the hub only: §3 gives the
        chart and the close-up the sky colours and the haze but no flare,
        because a flare belongs to one framing and those are other framings.

        Faded rather than unmounted, like the orbiting things. The camera
        phase becomes `orbit` the *moment* the reader asks to come back from
        the trail, and the move back takes up to three seconds — so anything
        mounted on the phase appears in one frame while the camera is still
        down on the curve.
      */}
      {deployed ? <SunFlare reducedMotion={cube.reducedMotion} shown={inHub} /> : null}

      {/*
        Company (r7 §8). Mounted for the whole of the deployed scene and
        faded out when the camera leaves the hub, rather than unmounted: the
        set has to be the same set when the reader comes back, and its clock
        has to have kept running while they were away.
      */}
      {deployed ? (
        <Orbiters
          seed={orbSeed}
          trailSeed={curveSeed}
          hasTrail={Boolean(memories?.length)}
          reducedMotion={cube.reducedMotion}
          visible={inHub}
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
          onBloom={addBloom}
          onDone={onBoardEnd}
        />
      ) : null}

      {/*
        Aimed at the comet, so it overtakes the thing it is racing. Without a
        comet on this card it still flies the same way — out past where one
        would be — which keeps the reply going *somewhere* rather than up.
      */}
      {launching && onLaunchEnd ? (
        <RocketLaunch
          cometProgress={comet?.progress ?? 0.5}
          reducedMotion={cube.reducedMotion}
          onBloom={addBloom}
          onDone={onLaunchEnd}
        />
      ) : null}
      {blooms.map((bloom) => (
        <Bloom
          key={bloom.id}
          {...bloom}
          reducedMotion={cube.reducedMotion}
          onDone={() => endBloom(bloom.id)}
        />
      ))}

      {deployed && launched && !launching ? (
        <ReplyStar cometProgress={comet?.progress ?? 0.5} reducedMotion={cube.reducedMotion} />
      ) : null}

      {/* Once, on the day, and never again while the page is open. */}
      {deployed && returned ? <MeteorShower reducedMotion={cube.reducedMotion} /> : null}

      {/*
        Debris, roughly every half minute, and only in the hub. The hub is the
        one screen a reader *sits* in rather than reads, which is both where a
        thirty-second rhythm has time to mean anything and the only place where
        something crossing the frame is not crossing a sentence. The paths are
        built to pass well behind the satellite and never near it (§3.2, and the
        clearance check in verify).
      */}
      {cameraPhase === "orbit" ? (
        <Asteroids seed={asteroidSeed(slug)} reducedMotion={cube.reducedMotion} />
      ) : null}

      {/*
        Shooting stars, wherever the sky is the thing being looked at.
        Broader than the asteroids, which are objects passing the satellite
        and only belong in the hub: these are far-off sky, so they suit the
        landing screen and the trail as well.

        Not over a letter, though — `near` is a face being read and `inside`
        is the line written in the cube, and a streak across either is a
        sentence nobody finishes. Not on the closing screen either, which is
        what `dimmed` excludes: the farewell is drawn stroke by stroke there,
        and that is the one moment the sky should hold completely still.

        On a returned day the field waits, so the meteor shower — five slow
        warm streaks, once, and the whole point of the day — is not muddled
        by an ordinary one crossing it.
      */}
      {cameraPhase !== "near" && cameraPhase !== "inside" && !dimmed ? (
        <ShootingStars
          seed={shootingStarSeed(slug)}
          reducedMotion={cube.reducedMotion}
          showering={Boolean(deployed && returned)}
        />
      ) : null}

      {/*
        Speed. Only in the two scenes that are actually moving: the hub, where
        the satellite holds its mark and something has to carry the sense of
        orbital velocity, and the trail, where the camera really is travelling.
        Never where a letter is being read — a paragraph with particles
        streaming past it is a paragraph nobody finishes.
      */}
      {cameraPhase === "orbit" || cameraPhase === "trail" ? (
        <SpeedStreaks
          seed={curveSeed}
          reducedMotion={cube.reducedMotion}
          // The hub camera barely moves, so its speed is given rather than
          // measured; on the trail the camera's own travel is the whole story.
          idle={cameraPhase === "orbit" ? 0.16 : 0}
        />
      ) : null}

      {/*
        The trail exists from the landing screen onwards, faintly, so the card
        hints at what is behind it before anyone has been told (§7).
      */}
      {memories?.length ? (
        <Trail
          curveSeed={curveSeed}
          seed={colourSeed}
          memoryCount={memories.length}
          reducedMotion={cube.reducedMotion}
          intensity={cameraPhase === "trail" || cameraPhase === "orbit" ? 1 : 0.25}
          /*
            Still while it is being travelled — down there the camera flies to
            fixed points on the curve and the memory panels are pinned to it.
            Everywhere else it is scenery, and scenery that never moves is
            what made it read as a painted stripe.
          */
          sway={cameraPhase === "trail" ? 0 : 1}
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
                curveSeed={curveSeed}
                seed={colourSeed}
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
          stowed={cameraPhase === "trail"}
          seed={seed}
          propel={flare}
        >
          <MessageCube
            {...cube}
            dimmed={dimmed}
            stowed={cameraPhase === "trail"}
            deploying={deploying}
            deployMs={deployMs}
            deployed={deployed}
            progress={presence}
            onDeployEnd={onDeployEnd}
            seed={seed}
            returned={returned}
          />
        </SatelliteCarrier>
      </Suspense>

      {/*
        Still connected (r7 §9). Last in the tree because it reaches from the
        satellite's mast, and the mast is the satellite's business — this only
        needs to know where it ended up.
      */}
      {deployed ? (
        <SignalPulses
          cometProgress={comet?.progress}
          warm={Boolean(launched || comet?.aboard)}
          shown={inHub}
          reducedMotion={cube.reducedMotion}
        />
      ) : null}
      </DawnProvider>
    </Canvas>
  );
}
