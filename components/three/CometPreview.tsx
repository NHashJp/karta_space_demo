"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cometAt, hubProject, worldPerPixel } from "./framing";
import { previewFrame } from "@/lib/cometPreview";

/**
 * The comet's way home, in the first-launch intro (see `lib/cometPreview.ts`).
 *
 * Nothing while the days are announced. Then a dashed line from where the
 * comet is today back to the planet, drawn out from the comet's end, and a
 * ghost of the comet running home along it while the caption counts down. The real comet stays where it is
 * throughout: the ghost is *what will happen*, and the speck it leaves behind
 * is where things actually stand.
 *
 * The path is sampled from `cometAt`, the one answer to where the comet is
 * drawn for a given day, so the dashes lie exactly on the road the real comet
 * will travel — including its speeding up at the end, which the ghost shows
 * by covering the last few dashes far faster than the first.
 */

const SAMPLES = 72;

type Props = {
  /** Today's raw progress along the orbit. */
  progress: number;
  reducedMotion: boolean;
};

export function CometPreview({ progress, reducedMotion }: Props) {
  const size = useThree((state) => state.size);
  const ghost = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);

  /** Today → home, sampled evenly in *time*, so the ghost can walk it by index. */
  const points = useMemo(() => {
    const from = Math.min(progress, 1);
    return Array.from({ length: SAMPLES }, (_, i) => {
      const p = from + ((1 - from) * i) / (SAMPLES - 1);
      return new THREE.Vector3(...cometAt(p, size.width, size.height));
    });
  }, [progress, size.width, size.height]);

  /** One pixel at the comet's depth, so the dashes and the ghost are sized in pixels. */
  const pixel = useMemo(() => {
    const depth = hubProject([points[0].x, points[0].y, points[0].z], size.width, size.height).depth;
    return worldPerPixel(depth, size.height);
  }, [points, size.width, size.height]);

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const path = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({
        color: "#7fd4f5",
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
    const fade = 1 - frame.out;

    // Drawn out from the comet's end towards home.
    line.geometry.setDrawRange(0, Math.max(2, Math.round(frame.draw * SAMPLES)));
    const material = line.material as THREE.LineDashedMaterial;
    material.opacity = 0.85 * Math.min(1, frame.draw * 2) * fade;

    // The ghost walks the samples by time, so it inherits the orbit's pace.
    const at = frame.run * (SAMPLES - 1);
    const i = Math.min(Math.floor(at), SAMPLES - 2);
    const position = points[i].clone().lerp(points[i + 1], at - i);
    const visible = frame.draw >= 1 ? 1 : 0;

    if (ghost.current) {
      ghost.current.position.copy(position);
      ghost.current.scale.setScalar(pixel * 5);
      (ghost.current.material as THREE.MeshBasicMaterial).opacity = visible * fade;
    }
    if (halo.current) {
      halo.current.position.copy(position);
      // Home: a slow swell, the one bright moment of the explanation.
      const swell = frame.arrived
        ? 1.6 + 0.25 * Math.sin(clock.elapsedTime * 4)
        : 1 + 0.6 * frame.run;
      halo.current.scale.setScalar(pixel * 16 * swell);
      (halo.current.material as THREE.MeshBasicMaterial).opacity =
        visible * (frame.arrived ? 0.6 : 0.35) * fade;
    }
  });

  return (
    <group>
      <primitive object={line} />
      <mesh ref={ghost} renderOrder={9}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color="#e8f6ff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={halo} renderOrder={9}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#7fd4f5"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
