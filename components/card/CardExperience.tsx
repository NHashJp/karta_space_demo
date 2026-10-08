"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { landingNote, type ClientCard } from "@/lib/clientCard";
import { formatFuzzyDate } from "@/lib/fuzzyDate";
import { formatReturn } from "@/lib/returnLabel";
import type { OrbitPanel } from "@/lib/experienceState";
import { CubeScene, type SceneComet } from "@/components/three/CubeScene";
import { CardLanding } from "./CardLanding";
import { CardProgress } from "./CardProgress";
import { CompletionState } from "./CompletionState";
import { OrbitOverlay } from "./OrbitOverlay";
import { CometSheet } from "./CometSheet";
import { CometIntro } from "./CometIntro";
import { CrossroadsPanel } from "./CrossroadsPanel";
import { TrajectoryPanel } from "./TrajectoryPanel";
import { ReplyPanel } from "./ReplyPanel";
import { TrailOverlay } from "./TrailOverlay";
import { AmbientOverlay } from "./AmbientOverlay";
import { SoundToggle } from "./SoundToggle";
import * as sound from "@/lib/sound";
import { useFaceNavigation, usePrefersReducedMotion } from "@/lib/useFaceNavigation";
import { jumpEvents, type VisitMode } from "@/lib/devJump";
import {
  previewVisit,
  readVisit,
  toFlags,
  writeVisit,
  type CometVisit,
} from "@/lib/cometVisit";
import { lightSeed } from "@/lib/sceneLight";
import { dawn as dawnOf } from "@/lib/dawn";
import { elapsedDays, skyFor } from "@/lib/skyAge";
import { DEPLOY_MS, replayed } from "@/lib/timing";
import { orbitRotation, progress as cometProgress } from "@/lib/cometOrbit";
import {
  readLaunched,
  readReleased,
  writeLaunched,
  writeReleased,
  type ReleasedComet,
} from "@/lib/localMarks";
import {
  acceptsInput,
  breathesAtRest,
  cameraPhase,
  dimsScene,
  initialExperience,
  isDeployed,
  isWithinCube,
  reduceExperience,
  revealsMemory,
  revealsSecret,
  revealsText,
  showsCometSheet,
  showsCompletion,
} from "@/lib/experienceState";

export function CardExperience({
  card,
  jumpTo,
  visitMode,
}: {
  card: ClientCard;
  jumpTo?: string;
  visitMode?: VisitMode;
}) {
  const memoryCount = card.memories?.length ?? 0;

  /*
   * What this browser has already seen of the comet (§11.5). It is read once,
   * synchronously, before the reducer is created — the very first thing the
   * machine does is decide where a deployment lands, and that decision needs
   * these flags. Reading storage in an effect would be one render too late.
   *
   * `useState` with an initialiser rather than `useMemo`, so it runs exactly
   * once and never on the server.
   */
  const [visit, setVisit] = useState<CometVisit>(() =>
    typeof window === "undefined"
      ? { cycle: card.comet?.returnsOn ?? "" }
      : (previewVisit(visitMode, card.comet?.returnsOn ?? "") ??
        readVisit(card.slug, card.comet?.returnsOn ?? "")),
  );

  const [experience, dispatch] = useReducer(
    reduceExperience,
    {
      memoryCount,
      hasOrbit: card.hasOrbit,
      hasCrossroads: card.hasCrossroads,
      comet: toFlags(card.comet, visit),
    },
    initialExperience,
  );
  const { state, activeFace, activeMemory, panel, launched, closings, deployments } = experience;
  const [settled, setSettled] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { active: loading, errors } = useProgress();

  // Give the loader a moment to register work before calling the scene ready.
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(timer);
  }, []);

  const ready = settled && !loading;
  const failed = errors.length > 0;

  const reduced = useRef(reducedMotion);
  reduced.current = reducedMotion;

  // The editor's preview asks for a state rather than walking to it. The
  // reducer has no way in other than the reader's own events, so the jump is
  // exactly those events, replayed at once (spec v0.2 §6.6). It is a no-op in
  // production, where `jumpEvents` refuses whatever the query string says.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current) return;
    jumped.current = true;
    const events = jumpEvents(jumpTo);
    if (events) for (const event of events) dispatch(event);
  }, [jumpTo]);

  const move = useCallback((direction: 1 | -1) => dispatch({ type: "move", direction }), []);
  const onTransitionEnd = useCallback(() => dispatch({ type: "rotationEnd" }), []);
  const onZoomEnd = useCallback(() => dispatch({ type: "zoomEnd" }), []);
  const onReveal = useCallback(() => dispatch({ type: "reveal" }), []);
  const onDeploy = useCallback(() => dispatch({ type: "deploy" }), []);
  const onDeployEnd = useCallback(() => dispatch({ type: "deployEnd" }), []);
  /*
   * The reply has just overtaken the comet. Distinct from `launched`, which
   * stays true forever: this is the *moment*, and it is what the toast and
   * the bloom are hung on (r7 §11, §13).
   */
  const [overtook, setOvertook] = useState(false);
  const onLaunchEnd = useCallback(() => {
    setOvertook(true);
    dispatch({ type: "launchEnd" });
  }, []);
  const onOpenChart = useCallback(() => dispatch({ type: "openChart" }), []);
  const onLeaveChart = useCallback(() => dispatch({ type: "leaveChart" }), []);
  const onDock = useCallback(() => dispatch({ type: "dock" }), []);

  /*
   * Into the satellite, from orbit (rev 6). One event: the reducer owns the
   * whole journey, including not stopping at the closing screen on the way
   * in and coming back out to orbit rather than to it.
   */
  const onEnterSatellite = useCallback(() => dispatch({ type: "enterSatellite" }), []);
  const onLookBack = useCallback(() => dispatch({ type: "lookBack" }), []);
  const onClosePanel = useCallback(() => dispatch({ type: "closePanel" }), []);
  const onOpenPanel = useCallback(
    (panel: Exclude<OrbitPanel, null>) => dispatch({ type: "openPanel", panel }),
    [],
  );

  const secret = card.secret?.trim() || undefined;
  const memories = card.memories ?? [];
  const phase = cameraPhase(state);

  /*
   * How long the deployment runs, and how fast the sound plays under it.
   *
   * Counted per trip rather than per direction, so the first launch *and* the
   * first return home are both watched in full — the closing screen coming
   * back is the other half of the same ceremony. From the second trip on, the
   * reader is commuting between the letter and its orbit, and both halves are
   * brisk (`REPLAY_SCALE`).
   */
  const deployMs = replayed(DEPLOY_MS, deployments > 1);

  const seed = useMemo(() => lightSeed(card.slug), [card.slug]);

  /*
   * The sky, aged by how long ago this was sent (`lib/skyAge.ts`).
   *
   * `card.today` rather than the browser's clock, and the same civil date the
   * comet's position and the return label were computed from on the server —
   * so the three cannot disagree, and `?now=` moves all of them together.
   */
  const sky = useMemo(() => skyFor(card, card.today), [card]);

  // A warmer light on the day the comet comes back (§23.3), and the one cue
  // in the sound palette that is allowed to be bright (§12.2).
  const returned = card.comet?.status === "returned";
  const aboard = Boolean(visit.sent);

  /*
   * The link to watch the comet, for the rest of this session only.
   *
   * It lives here rather than in the sheet because the sheet is unmounted
   * while the boarding animation plays and mounted again afterwards — so a
   * token held inside it was always thrown away between the send and the
   * screen that offers to copy it, and the button never appeared.
   *
   * In memory, never written down. The token *is* the message, and its one
   * home is the email it went out in (§11.5); this is the same courtesy a
   * component-level variable was, held somewhere that survives a remount.
   */
  const [cometLink, setCometLink] = useState<string | null>(null);

  /** Remember what this browser has now seen, and tell the reducer. */
  const remember = useCallback(
    (patch: Partial<CometVisit>) => {
      setVisit((current) => {
        const next = { ...current, ...patch };
        writeVisit(card.slug, next);
        return next;
      });
    },
    [card.slug],
  );

  const onDepartEnd = useCallback(() => {
    // Watched once per cycle: a second deployment goes straight to the chart.
    remember({ departed: true });
    dispatch({ type: "departEnd" });
  }, [remember]);

  const onBoardEnd = useCallback(() => dispatch({ type: "boardEnd" }), []);
  /*
   * The intro's moment at zero: the scene shows the reunion morning — the
   * warm light and the meteors the card really has that day — and the one
   * bright sound in the palette. Off again as it rewinds to today.
   */
  const [introDay, setIntroDay] = useState(false);
  const onIntroDay = useCallback(
    (day: boolean) => {
      setIntroDay(day);
      if (day && card.sound !== false) sound.cue("returned");
    },
    [card.sound],
  );
  useEffect(() => {
    if (state !== "previewing") setIntroDay(false);
  }, [state]);

  const onPreviewEnd = useCallback(() => {
    // Once per cycle, like the departure it stands in for.
    remember({ introduced: true, departed: true });
    dispatch({ type: "previewEnd" });
  }, [remember]);

  /*
   * The invite has been shown. Written the first time the sheet offers to
   * carry their words, so a later deployment can ask the shorter way (§11.6,
   * mockup M13e).
   *
   * `nudged` was in the visit record and in `?visit=`, but nothing ever set
   * it — so the second ask was unreachable outside the editor's preview, and
   * every repeat visitor read the first-time copy again.
   */
  const askedBefore = Boolean(visit.nudged);
  const onAsked = useCallback(() => {
    if (!visit.nudged) remember({ nudged: true });
  }, [visit.nudged, remember]);

  /* ---------------------------------------------------------------------
   * Sound (spec v0.2 §12.2). Cues are fired by watching the state change,
   * never from inside the reducer, which stays pure and testable.
   * ------------------------------------------------------------------- */
  const soundAvailable = card.sound !== false;
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    if (soundAvailable) setSoundOn(sound.readPreference());
  }, [soundAvailable]);

  useEffect(() => {
    if (!soundAvailable) return;
    sound.setEnabled(soundOn);
  }, [soundAvailable, soundOn]);

  useEffect(() => {
    if (!soundAvailable) return;
    // A background tab should be silent, and should not keep an oscillator
    // running on someone's phone.
    const onVisibility = () =>
      document.visibilityState === "hidden" ? sound.suspend() : sound.resume();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      sound.stop();
    };
  }, [soundAvailable]);

  /*
   * The two marks a previous visit left, in this browser only (§10.4, §11.6).
   * Read after mount rather than during render: the server has no idea what is
   * in someone's localStorage, and assuming would mean a hydration mismatch.
   */
  const [launchedBefore, setLaunchedBefore] = useState(false);
  const [releasedComet, setReleasedComet] = useState<ReleasedComet | null>(null);
  useEffect(() => {
    setLaunchedBefore(readLaunched(card.slug));
    setReleasedComet(readReleased(card.slug));
  }, [card.slug]);

  // Its orbit is seeded from the day it was released, exactly as the sender's
  // is, so the two never lie on top of each other.
  const releaseRotation = useMemo(
    () => orbitRotation(card.slug, releasedComet?.releasedOn ?? card.today),
    [card.slug, releasedComet?.releasedOn, card.today],
  );

  useEffect(() => {
    if (launched) writeLaunched(card.slug);
  }, [launched, card.slug]);

  const previousState = useRef(state);
  useEffect(() => {
    if (!soundAvailable) return;
    const was = previousState.current;
    previousState.current = state;
    if (was === state) return;

    if (state === "reading" && was === "transitioning") sound.cue("faceLand", activeFace);
    else if (state === "reading" && (was === "entering" || was === "returning")) {
      sound.cue("faceLand", activeFace);
    } else if (state === "leaving") sound.cue("leave");
    else if (state === "deploying") sound.cue("deploy", 0, DEPLOY_MS / deployMs);
    else if (state === "remembering") sound.cue("memory", activeMemory);
    else if (state === "launching") sound.cue("launch");
    else if (state === "boarding") sound.cue("release");
    else if (state === "departing") sound.cue("deploy");
    // The comet is back, and this is the one bright sound in the palette.
    else if (state === "nudging" && returned) sound.cue("returned");
  }, [soundAvailable, state, activeFace, activeMemory, returned, deployMs]);

  /**
   * The comets in the sky, as positions rather than as configuration. The
   * sender's is wherever its dates put it today; the receiver's appears only
   * once they have actually released one, and then sits at the start of its
   * own orbit.
   */
  const comet = useMemo<SceneComet | undefined>(() => {
    if (!card.comet) return undefined;
    return {
      progress: cometProgress(card.comet.leftOn, card.comet.returnsOn, card.today),
      // The dawn follows this, not the raw progress: a comet held at
      // perihelion is past its day, and the sky should say so (r7 §3).
      status: card.comet.status,
      leftOn: card.comet.leftOn,
      aboard,
      onSelect: () => dispatch({ type: "openChart" }),
    };
  }, [card.comet, card.today, aboard]);
  const atRest = breathesAtRest(state);

  /*
   * The ambient bed opens with the dawn (r7 §12). Computed here rather than
   * in the scene because it is a fact about the card's dates, and the sound
   * module knows nothing about cards.
   */
  useEffect(() => {
    if (!soundAvailable || !comet) return;
    sound.setDawn(introDay ? 1 : dawnOf(comet.progress, comet.status).p);
  }, [soundAvailable, comet, introDay]);

  /** Three bells as the reply goes past the comet (§12). */
  const onBloom = useCallback(() => {
    if (soundAvailable) sound.cue("bloom");
  }, [soundAvailable]);

  /*
   * Propel (r7 §11): the arrival beat, the first time the hub opens in this
   * visit and on every arrival from the deployment or from the chart. Held in
   * state rather than derived, because what triggers it is an *edge* — the
   * moment `orbit` is reached — and the camera phase alone cannot see one.
   */
  const [propelling, setPropelling] = useState(0);
  const propelledFrom = useRef<string | null>(null);
  useEffect(() => {
    const arrived = state === "orbit";
    const from = propelledFrom.current;
    propelledFrom.current = state;
    if (!arrived) return;
    if (from !== "deploying" && from !== "homing" && from !== null) return;
    setPropelling((n) => n + 1);
    if (soundAvailable) sound.cue("dawn");
  }, [state, soundAvailable]);

  // The cube owns the deployment animation and says when it is done; this
  // only tells it which way to run (spec v0.2 §8.2).
  const deploying =
    state === "deploying" ? ("out" as const) : state === "undeploying" ? ("in" as const) : null;

  useFaceNavigation(move, !acceptsInput(state), state !== "landing");

  if (failed) {
    return (
      <div className="screen">
        <div className="notice">
          <p lang="ja">カードを読み込めませんでした。もう一度お試しください。</p>
          <button className="button button--ghost" onClick={() => location.reload()} lang="ja">
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="experience" data-state={state}>
      <div className="experience__scene" aria-hidden={state !== "reading"}>
        <CubeScene
          faces={card.faces}
          activeFace={activeFace}
          isTransitioning={state === "transitioning"}
          revealText={revealsText(state)}
          dimmed={dimsScene(state)}
          cameraPhase={phase}
          cameraLeg={activeMemory}
          seed={seed}
          returned={returned || introDay}
          sky={sky}
          atRest={atRest}
          memories={card.memories}
          activeMemory={activeMemory}
          revealMemory={revealsMemory(state)}
          slug={card.slug}
          comet={comet}
          showCometOrbit={phase === "chart"}
          launching={state === "launching"}
          launched={launched || launchedBefore}
          onLaunchEnd={onLaunchEnd}
          departing={state === "departing"}
          onDepartEnd={onDepartEnd}
          previewing={state === "previewing"}
          boarding={state === "boarding"}
          onBoardEnd={onBoardEnd}
          deploying={deploying}
          deployMs={deployMs}
          deployed={isDeployed(state)}
          // The closing screen is up and the orbit is the way on: build it now,
          // hidden, so 軌道へ送り出す starts the animation with nothing to wait for.
          prepare={card.hasOrbit && (state === "leaving" || state === "completed")}
          onDeployEnd={onDeployEnd}
          propel={propelling}
          onBloom={onBloom}
          secret={secret}
          within={isWithinCube(state)}
          revealSecret={revealsSecret(state)}
          reducedMotion={reducedMotion}
          onTransitionEnd={onTransitionEnd}
          onZoomEnd={onZoomEnd}
        />
      </div>

      {state === "landing" || state === "entering" ? (
        <CardLanding
          title={card.title}
          subtitle={card.subtitle}
          note={landingNote(card)}
          ready={ready}
          leaving={state === "entering"}
          onOpen={() => {
            // The one user gesture the whole session gets: browsers will only
            // start an AudioContext from inside one.
            if (soundAvailable && soundOn) sound.start();
            dispatch({ type: "open" });
          }}
        />
      ) : null}

      {state === "reading" || state === "transitioning" ? (
        <>
          <CardProgress active={activeFace} total={6} />
          <p className="hint" data-visible={state === "reading" && activeFace === 0} lang="ja">
            スクロール／スワイプ
          </p>
        </>
      ) : null}

      {showsCompletion(experience) ? (
        <CompletionState
          closing={card.closing}
          social={card.social}
          leaving={state !== "completed"}
          hasSecret={Boolean(secret)}
          hasOrbit={card.hasOrbit}
          signature={card.signature}
          again={closings > 1}
          onReveal={onReveal}
          onReplay={() => dispatch({ type: "replay" })}
          onDeploy={onDeploy}
        />
      ) : null}

      {phase === "orbit" && state !== "deploying" && state !== "previewing" ? (
        <OrbitOverlay
          card={card}
          panel={panel}
          launched={launched || launchedBefore}
          aboard={aboard}
          onOpenPanel={onOpenPanel}
          onOpenChart={onOpenChart}
          onLookBack={onLookBack}
          onDock={onDock}
          onEnterSatellite={onEnterSatellite}
          hasSecret={Boolean(secret)}
          onFindReply={onOpenChart}
          overtook={overtook}
        />
      ) : null}

      {/* The first time the comet leaves, what it is for — before it asks. */}
      {state === "previewing" ? (
        <CometIntro
          card={card}
          reducedMotion={reducedMotion}
          onDay={onIntroDay}
          onDone={onPreviewEnd}
        />
      ) : null}

      {/* The comet sheet: the end of every comet moment (§8.6). */}
      {showsCometSheet(state) ? (
        <CometSheet
          card={card}
          aboard={aboard}
          justBoardedLink={cometLink}
          askedBefore={askedBefore}
          onAsked={onAsked}
          onBoarded={(token) => {
            // Remembered in this browser so the nudge does not come back, and
            // so the chip in the hub can say where their words got to. The
            // token is never stored — it is the message, and its one home is
            // the email it went out in (§11.5).
            if (token) setCometLink(`${window.location.origin}/comet/${token}`);
            remember({ sent: { on: card.today } });
            dispatch({ type: "board" });
          }}
          onLeave={onLeaveChart}
        />
      ) : null}

      {panel === "crossroads" ? (
        <CrossroadsPanel
          card={card}
          onLookBack={onLookBack}
          onReply={() => onOpenPanel("reply")}
          onTrajectory={() => onOpenPanel("trajectory")}
          onClose={onClosePanel}
        />
      ) : null}

      {panel === "trajectory" ? (
        <TrajectoryPanel card={card} aboard={aboard} onClose={onClosePanel} />
      ) : null}

      {panel === "reply" ? (
        <ReplyPanel
          card={card}
          onClose={onClosePanel}
          onSent={() => dispatch({ type: "launch" })}
        />
      ) : null}

      {phase === "trail" && memories.length > 0 ? (
        <TrailOverlay
          memories={memories}
          active={activeMemory}
          revealed={revealsMemory(state)}
          onBack={onLookBack}
        />
      ) : null}

      {state === "inside" || state === "ascending" ? (
        <div className="screen screen--inside" data-leaving={state === "ascending"}>
          <div className="inside">
            <p className="inside__hint" lang="ja">
              スクロールして外へ
            </p>
            <button
              className="button button--ghost"
              onClick={onReveal}
              disabled={state === "ascending"}
              lang="ja"
            >
              外に戻る
            </button>
          </div>
        </div>
      ) : null}

      {soundAvailable && state !== "landing" ? (
        <SoundToggle on={soundOn} onToggle={() => setSoundOn((on) => !on)} />
      ) : null}

      <AmbientOverlay />

      {/* Paragraph text also lives here as plain DOM, for assistive tech. */}
      {/*
        The whole card as plain DOM, for assistive tech (§18). Everything the
        3D scene says is here in text — including the memories, which are
        otherwise textures and <Html> inside a canvas.

        The sender's comet message appears here only when it has returned, and
        for the same reason it appears nowhere else before then: it is not in
        the payload at all until its date (§14.1).
      */}
      <div className="sr-only">
        <h1 lang="ja">{card.title}</h1>
        {card.faces.map((face, index) => (
          <p key={index} lang="ja">
            {face.type === "text" ? face.body : face.alt}
          </p>
        ))}
        {secret ? <p lang="ja">{secret}</p> : null}

        {memories.length > 0 ? (
          <section lang="ja">
            <h2>航跡</h2>
            {memories.map((memory, index) => (
              <article key={index}>
                <h3>{memory.title}</h3>
                <p>{formatFuzzyDate(memory.date, memory)}</p>
                {memory.caption ? <p>{memory.caption}</p> : null}
                {memory.image ? <p>{memory.image.alt}</p> : null}
              </article>
            ))}
          </section>
        ) : null}

        {card.comet ? (
          <section lang="ja">
            <h2>彗星</h2>
            {card.comet.promise ? <p>{card.comet.promise}</p> : null}
            <p>{formatReturn(card.comet.label)}</p>
            {card.comet.message ? (
              <>
                <p>{card.from}からの言葉</p>
                <p>{card.comet.message}</p>
              </>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
