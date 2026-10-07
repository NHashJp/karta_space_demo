"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Comet, type CometTone } from "./Comet";
import { cometAt, hubProject, worldPerPixel } from "./framing";
import { introProgress, previewFrame } from "@/lib/cometPreview";

/**
 * The comet's way home, in the first-launch intro (see `lib/cometPreview.ts`).
 *
 * A dashed line from where the comet is today back to the planet, drawn out
 * once the days have been announced, and **the comet itself** flown home
 * along it while the caption counts down — the real one, with its real tails,
 * so it brightens and its tail lengthens on the way in exactly as it will on
 * the actual approach, and at zero it is the comet of the reunion morning.
 * Then it is rewound to today with the dawn, and handed back to the scene.
 *
 * The path is sampled from `cometAt`, the one answer to where the comet is
 * drawn for a given day, so the dashes lie exactly on the road it travels.
 */

const SAMPLES = 72;

/** As with the dawn: small even steps rather than a re-render every frame. */
const STEP = 0.002;

type Props = {
  /** Today's raw progress along the orbit. */
  progress: number;
  slug: string;
  releasedOn: string;
  tone: CometTone;
  reducedMotion: boolean;
};

export function CometPreview({ progress, slug, releasedOn, tone, reducedMotion }: Props) {
  const size = useThree((state) => state.size);
  const startedAt = useRef<number | null>(null);
  const [at, setAt] = useState(progress);

  /** Today → home. */
  const points = useMemo(() => {
    const from = Math.min(progress, 1);
    return Array.from({ length: SAMPLES }, (_, i) => {
      const p = from + ((1 - from) * i) / (SAMPLES - 1);
      return new THREE.Vector3(...cometAt(p, size.width, size.height));
    });
  }, [progress, size.width, size.height]);

  /** One pixel at the comet's depth, so the dashes are sized in pixels. */
  const pixel = useMemo(() => {
    const depth = hubProject([points[0].x, points[0].y, points[0].z], size.width, size.height).depth;
    return worldPerPixel(depth, size.height);
  }, [points, size.width, size.height]);

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const path = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({
        // Sunrise gold rather than the comet's ion blue: this is the way to
        // the morning, and it is drawn in that morning's light.
        color: "#ffd6a0",
        dashSize: pixel * 9,
        gapSize: pixel * 7,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    path.computeLineDistances();
    path.renderOrder = 8;
    return path;
  }, [points, pixel]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const frame = previewFrame((clock.elapsedTime - startedAt.current) * 1000, reducedMotion);

    // Drawn out from the comet's end towards home, and gone as it rewinds.
    line.geometry.setDrawRange(0, Math.max(2, Math.round(frame.draw * SAMPLES)));
    const material = line.material as THREE.LineDashedMaterial;
    material.opacity = 0.85 * Math.min(1, frame.draw * 2) * (1 - frame.out);

    const next = Math.round(introProgress(progress, frame) / STEP) * STEP;
    setAt((current) => (current === next ? current : next));
  });

  return (
    <group>
      <primitive object={line} />
      <Comet
        progress={at}
        slug={slug}
        releasedOn={releasedOn}
        tone={tone}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}
