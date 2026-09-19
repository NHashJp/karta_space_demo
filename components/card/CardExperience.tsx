"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import type { CardConfig } from "@/types/card";
import { CubeScene } from "@/components/three/CubeScene";
import { CardLanding } from "./CardLanding";
import { CardProgress } from "./CardProgress";
import { CompletionState } from "./CompletionState";
import { useFaceNavigation, usePrefersReducedMotion } from "@/lib/useFaceNavigation";

type ExperienceState = "landing" | "transitioning" | "reading" | "completed";

const LAST_FACE = 5;

export function CardExperience({ card }: { card: CardConfig }) {
  const [state, setState] = useState<ExperienceState>("landing");
  const [activeFace, setActiveFace] = useState(0);
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

  // Read the live state from a ref so the handler never nests state updates.
  const stateRef = useRef(state);
  stateRef.current = state;

  const move = useCallback(
    (direction: 1 | -1) => {
      const current = stateRef.current;

      if (current === "completed") {
        // Scrolling back up returns to the final face.
        if (direction === -1) setState("reading");
        return;
      }
      if (current !== "reading") return;

      if (direction === 1) {
        if (activeFace === LAST_FACE) {
          setState("completed");
          return;
        }
        setActiveFace(activeFace + 1);
        setState("transitioning");
        return;
      }
      if (activeFace === 0) return;
      setActiveFace(activeFace - 1);
      setState("transitioning");
    },
    [activeFace],
  );

  const onTransitionEnd = useCallback(() => {
    setState((current) => (current === "transitioning" ? "reading" : current));
  }, []);

  const replay = useCallback(() => {
    setActiveFace(0);
    setState("transitioning");
  }, []);

  useFaceNavigation(move, state === "transitioning" || state === "landing", state !== "landing");

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
      <div className="experience__scene" aria-hidden={state === "landing"}>
        <CubeScene
          faces={card.faces}
          activeFace={activeFace}
          isTransitioning={state === "transitioning"}
          reducedMotion={reducedMotion}
          onTransitionEnd={onTransitionEnd}
        />
      </div>

      {state === "landing" ? (
        <CardLanding
          title={card.title}
          subtitle={card.subtitle}
          ready={ready}
          onOpen={() => setState("reading")}
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

      {state === "completed" ? (
        <CompletionState closing={card.closing} onReplay={replay} />
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
