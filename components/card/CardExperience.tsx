"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { useProgress } from "@react-three/drei";
import type { CardConfig } from "@/types/card";
import { CubeScene } from "@/components/three/CubeScene";
import { CardLanding } from "./CardLanding";
import { CardProgress } from "./CardProgress";
import { CompletionState } from "./CompletionState";
import { useFaceNavigation, usePrefersReducedMotion } from "@/lib/useFaceNavigation";
import {
  acceptsInput,
  dimsScene,
  initialExperience,
  isZoomedIn,
  reduceExperience,
  revealsText,
} from "@/lib/experienceState";

export function CardExperience({ card }: { card: CardConfig }) {
  const [{ state, activeFace }, dispatch] = useReducer(reduceExperience, initialExperience);
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

  const move = useCallback(
    (direction: 1 | -1) => dispatch({ type: "move", direction }),
    [],
  );
  const onTransitionEnd = useCallback(() => dispatch({ type: "rotationEnd" }), []);
  const onZoomEnd = useCallback(() => dispatch({ type: "zoomEnd" }), []);

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
          zoomedIn={isZoomedIn(state)}
          reducedMotion={reducedMotion}
          onTransitionEnd={onTransitionEnd}
          onZoomEnd={onZoomEnd}
        />
      </div>

      {state === "landing" || state === "entering" ? (
        <CardLanding
          title={card.title}
          subtitle={card.subtitle}
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

      {state === "completed" || state === "returning" ? (
        <CompletionState
          closing={card.closing}
          social={card.social}
          leaving={state === "returning"}
          onReplay={() => dispatch({ type: "replay" })}
        />
      ) : null}

      {/* Paragraph text also lives here as plain DOM, for assistive tech. */}
      <div className="sr-only">
        <h1 lang="ja">{card.title}</h1>
        {card.faces.map((face, index) => (
          <p key={index} lang="ja">
            {face.type === "text" ? face.body : face.alt}
          </p>
        ))}
      </div>
    </main>
  );
}
