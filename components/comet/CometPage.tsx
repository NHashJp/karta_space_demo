"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { SpaceEnvironment } from "@/components/three/SpaceEnvironment";
import { Planet } from "@/components/three/Planet";
import { Comet } from "@/components/three/Comet";
import { CometOrbitMini } from "@/components/card/CometOrbitMini";
import { AmbientOverlay } from "@/components/card/AmbientOverlay";
import { FOV, orbitPose } from "@/components/three/framing";
import { formatFuzzyDate } from "@/lib/fuzzyDate";
import { daysBetween } from "@/lib/orbitClock";
import { progress as cometProgress } from "@/lib/cometOrbit";
import { lightSeed } from "@/lib/sceneLight";
import { skyFor } from "@/lib/skyAge";
import { usePrefersReducedMotion } from "@/lib/useFaceNavigation";
import type { Opened } from "@/lib/cometSeal";

/**
 * What the sender opens from the email (spec v0.2 §11.7).
 *
 * Deliberately the same sky as the card, not a notification page: the sender
 * should recognise where their comet is, and each time they check it should be
 * a little further round. In the final weeks it visibly comes home, which is
 * the entire feature — the countdown is a place, not a number.
 */
export function CometPage({ comet, today }: { comet: Opened; today: string }) {
  const reducedMotion = usePrefersReducedMotion();

  if (comet.status === "invalid") {
    return (
      <main className="screen">
        <p className="comet-page__invalid" lang="ja">
          この彗星は見つかりませんでした。
        </p>
      </main>
    );
  }

  const progress = cometProgress(comet.leftOn, comet.returnsOn, today);
  const daysUntil = daysBetween(today, comet.returnsOn);
  const returned = comet.status === "returned";

  return (
    <main className="comet-page">
      <div className="comet-page__scene" aria-hidden="true">
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false }}
          camera={{ fov: FOV, position: orbitPose(1200, 800).position, near: 0.1, far: 120 }}
        >
          <SpaceEnvironment
            reducedMotion={reducedMotion}
            dimmed={false}
            seed={lightSeed(comet.slug)}
            returned={returned}
            /*
              Aged from the day this comet left, so the sender checking on it
              sees the same thinning sky the receiver does. It is the one page
              where the ageing is the point rather than the atmosphere: coming
              back to it after a season, the gas has opened up and the comet
              has moved, and those two things are saying the same thing.
            */
            sky={skyFor({ comet: { leftOn: comet.leftOn } }, today)}
          />
          <Planet
            seed={lightSeed(comet.slug)}
            returned={returned}
            reducedMotion={reducedMotion}
          />
          <Comet
            progress={progress}
            slug={comet.slug}
            releasedOn={comet.leftOn}
            tone="receiver"
            reducedMotion={reducedMotion}
            showOrbit
          />
        </Canvas>
      </div>

      <AmbientOverlay />

      <div className="comet-page__panel">
        <CometOrbitMini
          progress={progress}
          tone="receiver"
          label={formatFuzzyDate(comet.returnsOn)}
        />

        {returned ? (
          <>
            <h1 className="comet__headline" lang="ja">
              {comet.name}さんの言葉が、戻ってきました。
            </h1>
            <p className="comet__meta" lang="ja">
              {formatFuzzyDate(comet.boardedOn)}に、彗星にのりました
            </p>
            <Message body={comet.body} slug={comet.slug} />
          </>
        ) : (
          <>
            <h1 className="comet__headline" lang="ja">
              {comet.name}さんの言葉
            </h1>
            <p className="comet__meta" lang="ja">
              約束の彗星にのって、{formatFuzzyDate(comet.returnsOn)}に戻ってきます。
            </p>
            <p className="comet__meta" lang="ja">
              あと{daysUntil}日
            </p>
          </>
        )}
      </div>
    </main>
  );
}

/**
 * The message itself, faded in line by line — but only the first time this
 * browser sees it. Someone re-reading a letter should not have to wait for it
 * again; the ceremony belongs to the first reading.
 */
function Message({ body, slug }: { body: string; slug: string }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const key = `ks_opened_${slug}`;
    try {
      if (!window.localStorage.getItem(key)) {
        setAnimate(true);
        window.localStorage.setItem(key, "1");
      }
    } catch {
      // Storage blocked: show it plainly rather than replaying the ceremony
      // on every visit.
    }
  }, [slug]);

  const lines = body.split("\n");

  return (
    <div className="comet-page__message" lang="ja">
      {lines.map((line, index) => (
        <p
          key={index}
          data-animate={animate}
          style={animate ? { animationDelay: `${index * 420}ms` } : undefined}
        >
          {line || " "}
        </p>
      ))}
    </div>
  );
}
