"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { landingNote, type ClientCard } from "@/lib/clientCard";
import type { ExperienceEvent, OrbitPanel } from "@/lib/experienceState";
import { CubeScene } from "@/components/three/CubeScene";
import { CardLanding } from "./CardLanding";
import { CardProgress } from "./CardProgress";
import { CompletionState } from "./CompletionState";
import { OrbitOverlay } from "./OrbitOverlay";
import { Panel } from "./Panel";
import { SatellitePanel } from "./SatellitePanel";
import { TrailOverlay } from "./TrailOverlay";
import { AmbientOverlay } from "./AmbientOverlay";
import { useFaceNavigation, usePrefersReducedMotion } from "@/lib/useFaceNavigation";
import { LAUNCH_MS, RELEASE_MS, duration } from "@/lib/timing";
import { jumpEvents } from "@/lib/devJump";
import { lightSeed } from "@/lib/sceneLight";
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

/**
 * Animations whose owning component does not exist yet (spec §19 phases 13 and
 * 14 build them). Until then this keeps the flow walkable end to end: each
 * state still lasts its real duration and still ends by dispatching the event
 * its future owner will dispatch, so nothing but the visuals changes when
 * `RocketLaunch` and `CometRelease` take these over.
 */
const TIMED_PHASES: Partial<Record<string, { ms: number; event: ExperienceEvent }>> = {
  launching: { ms: LAUNCH_MS, event: { type: "launchEnd" } },
  releasing: { ms: RELEASE_MS, event: { type: "releaseEnd" } },
};

export function CardExperience({ card, jumpTo }: { card: ClientCard; jumpTo?: string }) {
  const memoryCount = card.memories?.length ?? 0;
  const [experience, dispatch] = useReducer(
    reduceExperience,
    { memoryCount, hasOrbit: card.hasOrbit },
    initialExperience,
  );
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

  useEffect(() => {
    const phase = TIMED_PHASES[state];
    if (!phase) return;
    const timer = setTimeout(
      () => dispatch(phase.event),
      duration(phase.ms, reduced.current),
    );
    return () => clearTimeout(timer);
  }, [state]);

  const move = useCallback((direction: 1 | -1) => dispatch({ type: "move", direction }), []);
  const onTransitionEnd = useCallback(() => dispatch({ type: "rotationEnd" }), []);
  const onZoomEnd = useCallback(() => dispatch({ type: "zoomEnd" }), []);
  const onReveal = useCallback(() => dispatch({ type: "reveal" }), []);
  const onDeploy = useCallback(() => dispatch({ type: "deploy" }), []);
  const onDeployEnd = useCallback(() => dispatch({ type: "deployEnd" }), []);
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
  // A warmer light on the day something comes back (§23.3).
  const returned =
    card.satelliteStatus === "returned" || card.senderComet?.status === "returned";
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
          memoryCount={memoryCount}
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
          onOpen={() => dispatch({ type: "open" })}
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
          launched={launched}
          onOpenPanel={onOpenPanel}
          onLookBack={onLookBack}
          onDock={onDock}
        />
      ) : null}

      {panel === "satellite" ? (
        <SatellitePanel card={card} onClose={onClosePanel} />
      ) : null}

      {/* Placeholder bodies until §19 phases 10 and 13 build the real ones. */}
      {panel === "comet" || panel === "reply" ? (
        <Panel title={panel === "comet" ? "彗星" : "返事"} onClose={onClosePanel}>
          <p className="panel__body" lang="ja">
            準備中
          </p>
        </Panel>
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

      <AmbientOverlay />

      {/* Paragraph text also lives here as plain DOM, for assistive tech. */}
      <div className="sr-only">
        <h1 lang="ja">{card.title}</h1>
        {card.faces.map((face, index) => (
          <p key={index} lang="ja">
            {face.type === "text" ? face.body : face.alt}
          </p>
        ))}
        {secret ? <p lang="ja">{secret}</p> : null}
      </div>
    </main>
  );
}
