"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { SpaceEnvironment } from "@/components/three/SpaceEnvironment";
import { DawnProvider } from "@/components/three/DawnProvider";
import { Planet } from "@/components/three/Planet";
import { Comet } from "@/components/three/Comet";
import { CometOrbitMini } from "@/components/card/CometOrbitMini";
import { AmbientOverlay } from "@/components/card/AmbientOverlay";
import { FOV, PLANET_CENTRE, orbitPose } from "@/components/three/framing";
import { formatFuzzyDate } from "@/lib/fuzzyDate";
import { daysBetween } from "@/lib/orbitClock";
import { progress as cometProgress } from "@/lib/cometOrbit";
import { lightSeed } from "@/lib/sceneLight";
import { skyFor } from "@/lib/skyAge";
import { usePrefersReducedMotion } from "@/lib/useFaceNavigation";
import type { Opened } from "@/lib/cometSeal";
import { strings, type Lang } from "@/lib/i18n";
import { LangProvider, useLang } from "@/components/card/LangContext";

/**
 * What the sender opens from the email (spec v0.2 §11.7).
 *
 * Deliberately the same sky as the card, not a notification page: the sender
 * should recognise where their comet is, and each time they check it should be
 * a little further round. In the final weeks it visibly comes home, which is
 * the entire feature — the countdown is a place, not a number.
 */
export function CometPage({
  comet,
  today,
  lang = "ja",
}: {
  comet: Opened;
  today: string;
  /** The card's language: the comet page speaks the card's words. */
  lang?: Lang;
}) {
  return (
    <LangProvider lang={lang}>
      <CometPageBody comet={comet} today={today} lang={lang} />
    </LangProvider>
  );
}

function CometPageBody({ comet, today, lang }: { comet: Opened; today: string; lang: Lang }) {
  const reducedMotion = usePrefersReducedMotion();
  const t = strings(lang).cometPage;

  if (comet.status === "invalid") {
    return (
      <main className="screen">
        <p className="comet-page__invalid" lang={lang}>
          {t.notFound}
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
          {/*
            The same dawn the card has (rev 7.1 §3): the sender checking on
            their comet sees the same sunrise over the same planet, at the same
            point in the same wait. It is the whole reason this page is a sky
            rather than a status line.
          */}
          <DawnProvider f={progress} status={returned ? "returned" : "away"} active>
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
          {/*
            `Planet` draws at its parent's origin and the caller places it
            (r7 §14 step 0). The card's hub stages it per aspect ratio; this
            page has one fixed framing, so it gets the world constant.
          */}
          <group position={PLANET_CENTRE}>
            <Planet
              seed={lightSeed(comet.slug)}
              returned={returned}
              reducedMotion={reducedMotion}
            />
          </group>
          <Comet
            progress={progress}
            slug={comet.slug}
            releasedOn={comet.leftOn}
            tone="receiver"
            reducedMotion={reducedMotion}
            showOrbit
          />
          </DawnProvider>
        </Canvas>
      </div>

      <AmbientOverlay />

      <div className="comet-page__panel">
        <CometOrbitMini
          progress={progress}
          tone="receiver"
          label={formatFuzzyDate(comet.returnsOn, { lang })}
        />

        {returned ? (
          <>
            <h1 className="comet__headline" lang={lang}>
              {t.returned(comet.name)}
            </h1>
            <p className="comet__meta" lang={lang}>
              {t.boardedOn(formatFuzzyDate(comet.boardedOn, { lang }))}
            </p>
            <Message body={comet.body} slug={comet.slug} />
          </>
        ) : (
          <>
            <h1 className="comet__headline" lang={lang}>
              {t.words(comet.name)}
            </h1>
            <p className="comet__meta" lang={lang}>
              {t.returnsOn(formatFuzzyDate(comet.returnsOn, { lang }))}
            </p>
            <p className="comet__meta" lang={lang}>
              {t.daysLeft(daysUntil)}
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
  const lang = useLang();

  return (
    <div className="comet-page__message" lang={lang}>
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
