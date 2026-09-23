"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { landingNote, type ClientCard } from "@/lib/clientCard";
import { formatFuzzyDate } from "@/lib/fuzzyDate";
import type { OrbitPanel } from "@/lib/experienceState";
import { CubeScene, type SceneComet } from "@/components/three/CubeScene";
import { CardLanding } from "./CardLanding";
import { CardProgress } from "./CardProgress";
import { CompletionState } from "./CompletionState";
import { OrbitOverlay } from "./OrbitOverlay";
import { SatellitePanel } from "./SatellitePanel";
import { CometPanel } from "./CometPanel";
import { ReplyPanel } from "./ReplyPanel";
import { TrailOverlay } from "./TrailOverlay";
import { AmbientOverlay } from "./AmbientOverlay";
import { SoundToggle } from "./SoundToggle";
import * as sound from "@/lib/sound";
import { useFaceNavigation, usePrefersReducedMotion } from "@/lib/useFaceNavigation";
import { jumpEvents } from "@/lib/devJump";
import { lightSeed } from "@/lib/sceneLight";
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
} from "@/lib/experienceState";

export function CardExperience({ card, jumpTo }: { card: ClientCard; jumpTo?: string }) {
  const memoryCount = card.memories?.length ?? 0;
  const [experience, dispatch] = useReducer(
    reduceExperience,
    { memoryCount, hasOrbit: card.hasOrbit },
    initialExperience,
  );
  // `released` is deliberately not read here: whether the receiver's comet is
  // in the sky is decided by `releasedComet` below, which survives a reload.
  const { state, activeFace, activeMemory, panel, launched } = experience;
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
  const onLaunchEnd = useCallback(() => dispatch({ type: "launchEnd" }), []);
  const onReleaseEnd = useCallback(() => dispatch({ type: "releaseEnd" }), []);
  const onDock = useCallback(() => dispatch({ type: "dock" }), []);
  const onLookBack = useCallback(() => dispatch({ type: "lookBack" }), []);
  const onClosePanel = useCallback(() => dispatch({ type: "closePanel" }), []);
  const onOpenPanel = useCallback(
    (panel: Exclude<OrbitPanel, null>) => dispatch({ type: "openPanel", panel }),
    [],
  );

  const secret = card.secret?.trim() || undefined;
  const memories = card.memories ?? [];
  const phase = cameraPhase(state);

  const seed = useMemo(() => lightSeed(card.slug), [card.slug]);

  // A warmer light on the day something comes back (§23.3), and the one cue
  // in the sound palette that is allowed to be bright (§12.2).
  const returned =
    card.satelliteStatus === "returned" || card.senderComet?.status === "returned";

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
    else if (state === "deploying") sound.cue("deploy");
    else if (state === "remembering") sound.cue("memory", activeMemory);
    else if (state === "launching") sound.cue("launch");
    else if (state === "releasing") sound.cue("release");
    else if (state === "orbit" && was === "deploying" && returned) sound.cue("returned");
  }, [soundAvailable, state, activeFace, activeMemory, returned]);

  /**
   * The comets in the sky, as positions rather than as configuration. The
   * sender's is wherever its dates put it today; the receiver's appears only
   * once they have actually released one, and then sits at the start of its
   * own orbit.
   */
  const comets = useMemo<SceneComet[]>(() => {
    const out: SceneComet[] = [];
    if (card.senderComet) {
      out.push({
        key: "sender",
        progress: cometProgress(
          card.senderComet.releasedOn,
          card.senderComet.returnsOn,
          card.today,
        ),
        releasedOn: card.senderComet.releasedOn,
        tone: "sender",
        onSelect: () => dispatch({ type: "openPanel", panel: "comet" }),
      });
    }
    // The receiver's own comet appears once they have actually released one —
    // in this session, or on an earlier visit in this browser.
    if (releasedComet) {
      out.push({
        key: "receiver",
        progress: cometProgress(
          releasedComet.releasedOn,
          releasedComet.returnsOn,
          card.today,
        ),
        releasedOn: releasedComet.releasedOn,
        tone: "receiver",
        onSelect: () => dispatch({ type: "openPanel", panel: "comet" }),
      });
    }
    return out;
  }, [card.senderComet, card.today, releasedComet]);
  const atRest = breathesAtRest(state);

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
          returned={returned}
          atRest={atRest}
          memories={card.memories}
          activeMemory={activeMemory}
          revealMemory={revealsMemory(state)}
          slug={card.slug}
          comets={comets}
          openPanel={panel}
          launching={state === "launching"}
          launched={launched || launchedBefore}
          onLaunchEnd={onLaunchEnd}
          releasing={state === "releasing"}
          releaseRotation={releaseRotation}
          onReleaseEnd={onReleaseEnd}
          deploying={deploying}
          deployed={isDeployed(state)}
          onDeployEnd={onDeployEnd}
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

      {state === "completed" ||
      state === "returning" ||
      state === "descending" ||
      state === "deploying" ? (
        <CompletionState
          closing={card.closing}
          social={card.social}
          leaving={state !== "completed"}
          hasSecret={Boolean(secret)}
          hasOrbit={card.hasOrbit}
          signature={card.signature}
          onReveal={onReveal}
          onReplay={() => dispatch({ type: "replay" })}
          onDeploy={onDeploy}
        />
      ) : null}

      {phase === "orbit" && state !== "deploying" ? (
        <OrbitOverlay
          card={card}
          panel={panel}
          launched={launched || launchedBefore}
          onOpenPanel={onOpenPanel}
          onLookBack={onLookBack}
          onDock={onDock}
        />
      ) : null}

      {panel === "satellite" ? (
        <SatellitePanel card={card} onClose={onClosePanel} />
      ) : null}

      {panel === "comet" ? (
        <CometPanel
          card={card}
          today={card.today}
          released={releasedComet}
          onClose={onClosePanel}
          onReleased={(comet) => {
            // Kept in this browser so the warm comet is still on its orbit
            // next time (§11.6). The token is never stored — it is the
            // message, and its one home is the email it went out in.
            setReleasedComet(comet);
            writeReleased(card.slug, comet);
            dispatch({ type: "release" });
          }}
        />
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

        {card.satellite ? (
          <section lang="ja">
            <h2>衛星</h2>
            <p>{card.satellite.message}</p>
            <p>
              {card.satelliteStatus === "returned"
                ? "この日が、来ましたね。"
                : `${formatFuzzyDate(card.satelliteNext ?? card.satellite.date)}${
                    typeof card.daysUntil === "number" ? ` · あと${card.daysUntil}日` : ""
                  }`}
            </p>
          </section>
        ) : null}

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

        {card.senderComet ? (
          <section lang="ja">
            <h2>彗星</h2>
            {card.senderComet.status === "returned" ? (
              <>
                <p>{card.from}の彗星が、戻ってきました。</p>
                <p>{card.senderComet.message}</p>
              </>
            ) : (
              <p>
                {card.from}の彗星。{formatFuzzyDate(card.senderComet.returnsOn)}
                に戻ってきます。
              </p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
