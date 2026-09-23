"use client";

import { Suspense, useMemo, useRef } from "react";
import { Html, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MEMORY_PANEL_WORLD, memoryPanelFraming } from "./framing";
import { toCss, trailColour, type TrailSeed } from "@/lib/trailColour";
import { memoryU, trailPoint, trailTangent, type Point3 } from "@/lib/trailCurve";
import { formatFuzzyDate } from "@/lib/fuzzyDate";
import type { ClientMemory } from "@/lib/clientCard";

/**
 * One memory, hanging on the trail (spec v0.2 §9.2).
 *
 * The photograph is a texture; the words are real DOM through `<Html
 * transform>`, on the same 40px-per-world-unit rule as a cube face, so
 * Japanese sets and breaks properly and a screen reader can read it.
 *
 * Its border takes the trail's colour at its own point on the curve, which is
 * why each memory carries a slightly different, slowly shifting tint — the one
 * detail that makes a row of panels feel like points on a journey rather than
 * a gallery.
 */

const CAPTION_SCALE = 40;

type Props = {
  memory: ClientMemory;
  index: number;
  count: number;
  points: Point3[];
  seed: TrailSeed;
  /** Text is attached only while this memory is the one being read (§6.5). */
  revealed: boolean;
  reducedMotion: boolean;
};

export function MemoryPanel({
  memory,
  index,
  count,
  points,
  seed,
  revealed,
  reducedMotion,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const border = useRef<THREE.LineSegments>(null);
  const size = useThree((state) => state.size);
  const panelPx = memoryPanelFraming(size.width, size.height).screenPx;

  const u = memoryU(index, count);

  const { position, quaternion } = useMemo(() => {
    const at = trailPoint(points, u);
    const tangent = new THREE.Vector3(...trailTangent(points, u));
    // Facing back down the trail, at whoever is travelling it: the camera
    // arrives along the tangent, so the panel squares up to it exactly.
    const look = new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      tangent.clone().negate(),
      new THREE.Vector3(0, 1, 0),
    );
    return {
      position: new THREE.Vector3(...at),
      quaternion: new THREE.Quaternion().setFromRotationMatrix(look),
    };
  }, [points, u]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // The border is the trail's own colour here, from the same function the
    // ribbon is drawn with.
    if (border.current) {
      const [r, g, b] = trailColour(u, t, seed, reducedMotion);
      const material = border.current.material as THREE.LineBasicMaterial;
      material.color.setRGB(r, g, b);
    }

    // A slow float, so a memory is suspended rather than mounted.
    if (group.current && !reducedMotion) {
      group.current.position.y = position.y + Math.sin((t / 6) * Math.PI * 2 + index) * 0.03;
    }
  });

  const tint = useMemo(() => toCss(trailColour(u, 0, seed, true)), [u, seed]);

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      {memory.image ? (
        <Suspense fallback={<Shimmer />}>
          <Photograph url={memory.image.url} fit={memory.image.fit ?? "cover"} />
        </Suspense>
      ) : null}

      {/* A frame in the trail's local colour, which is what ties the two. */}
      <lineSegments ref={border}>
        <edgesGeometry
          args={[new THREE.PlaneGeometry(MEMORY_PANEL_WORLD, MEMORY_PANEL_WORLD * 0.75)]}
        />
        <lineBasicMaterial transparent opacity={0.45} toneMapped={false} />
      </lineSegments>

      <Html
        transform
        scale={MEMORY_PANEL_WORLD / CAPTION_SCALE}
        position={[0, memory.image ? -MEMORY_PANEL_WORLD * 0.5 : 0, 0.02]}
        zIndexRange={[20, 10]}
        pointerEvents="none"
      >
        <div
          className="memory"
          style={{ width: panelPx, ["--memory-tint" as string]: tint }}
          data-visible={revealed}
          aria-hidden={!revealed}
          lang="ja"
        >
          <p className="memory__date">{formatFuzzyDate(memory.date, memory)}</p>
          <h2 className="memory__title">{memory.title}</h2>
          {memory.caption ? <p className="memory__caption">{memory.caption}</p> : null}
        </div>
      </Html>
    </group>
  );
}

function Photograph({ url, fit }: { url: string; fit: "cover" | "contain" }) {
  const texture = useTexture(url);
  // `image` is typed loosely because a texture's source may be a canvas or a
  // video as well as an <img>; all three carry these two numbers.
  const source = texture.image as { width?: number; height?: number } | undefined;
  const aspect = source?.width && source.height ? source.width / source.height : 4 / 3;

  // "cover" fills the frame and crops; "contain" fits the whole photograph in.
  const height = MEMORY_PANEL_WORLD * 0.75;
  const scale: [number, number] =
    fit === "contain" && aspect < MEMORY_PANEL_WORLD / height
      ? [height * aspect, height]
      : [MEMORY_PANEL_WORLD, MEMORY_PANEL_WORLD / aspect];

  return (
    <mesh>
      <planeGeometry args={[Math.min(scale[0], MEMORY_PANEL_WORLD), Math.min(scale[1], height)]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * What stands in while a photograph is still loading. Never a spinner and
 * never a blocked navigation: the reader can walk straight past a memory whose
 * image has not arrived, and it will simply be there next time (§9.4).
 */
function Shimmer() {
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (material.current) {
      material.current.opacity = 0.1 + 0.06 * Math.sin(clock.elapsedTime * 1.8);
    }
  });

  return (
    <mesh>
      <planeGeometry args={[MEMORY_PANEL_WORLD, MEMORY_PANEL_WORLD * 0.75]} />
      <meshBasicMaterial ref={material} color="#9fb4c9" transparent opacity={0.12} />
    </mesh>
  );
}
