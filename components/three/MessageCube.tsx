"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { CardFace } from "@/types/card";
import { TextFace } from "./TextFace";
import { ImageFace } from "./ImageFace";
import {
  FACE_ORIENTATIONS,
  REDUCED_MOTION_PRESET,
  orientationAt,
  pickPreset,
  type RotationPreset,
} from "./rotationPresets";

const HALF_PI = Math.PI / 2;

/** Where each face plane sits, in the order Front, Right, Back, Left, Top, Bottom. */
const FACE_PLACEMENT: { position: [number, number, number]; rotation: [number, number, number] }[] = [
  { position: [0, 0, 1], rotation: [0, 0, 0] },
  { position: [1, 0, 0], rotation: [0, HALF_PI, 0] },
  { position: [0, 0, -1], rotation: [0, Math.PI, 0] },
  { position: [-1, 0, 0], rotation: [0, -HALF_PI, 0] },
  { position: [0, 1, 0], rotation: [-HALF_PI, 0, 0] },
  { position: [0, -1, 0], rotation: [HALF_PI, 0, 0] },
];

type Props = {
  faces: CardFace[];
  activeFace: number;
  isTransitioning: boolean;
  revealText: boolean;
  /** Closing screen: the cube fades back so the drawn message can be read. */
  dimmed: boolean;
  reducedMotion: boolean;
  onTransitionEnd: () => void;
};

export function MessageCube({
  faces,
  activeFace,
  isTransitioning,
  revealText,
  dimmed,
  reducedMotion,
  onTransitionEnd,
}: Props) {
  const cube = useRef<THREE.Group>(null);
  const idle = useRef<THREE.Group>(null);

  const from = useRef(new THREE.Quaternion().copy(FACE_ORIENTATIONS[0]));
  const to = useRef(new THREE.Quaternion().copy(FACE_ORIENTATIONS[0]));
  const scratch = useRef(new THREE.Quaternion());
  const preset = useRef<RotationPreset | null>(null);
  const lastPreset = useRef<string | undefined>(undefined);
  const startedAt = useRef(0);

  // Base opacities are captured once, so dimming can scale them without
  // needing every material threaded through props.
  const dim = useRef(0);
  const baseOpacity = useRef(new WeakMap<THREE.Material, number>());

  // A change of active face starts a transition from wherever the cube is now.
  useEffect(() => {
    if (!cube.current) return;
    from.current.copy(cube.current.quaternion);
    to.current.copy(FACE_ORIENTATIONS[activeFace]);
    const next = reducedMotion ? REDUCED_MOTION_PRESET : pickPreset(lastPreset.current);
    preset.current = next;
    lastPreset.current = next.name;
    startedAt.current = performance.now();
  }, [activeFace, reducedMotion]);

  useFrame((frameState, delta) => {
    const group = cube.current;
    if (!group) return;

    // Damping approaches zero asymptotically, so snap the tail and run one
    // last pass at full opacity — otherwise materials settle just below it.
    const wasDimmed = dim.current > 0;
    dim.current = THREE.MathUtils.damp(dim.current, dimmed ? 1 : 0, 3.2, delta);
    if (!dimmed && dim.current < 0.002) dim.current = 0;

    if (dim.current > 0 || wasDimmed) {
      const fade = 1 - dim.current * 0.88;
      group.traverse((node) => {
        const material = (node as THREE.Mesh).material as THREE.Material | undefined;
        if (!material || Array.isArray(material) || !("opacity" in material)) return;
        const opaque = material as THREE.Material & { opacity: number };
        let base = baseOpacity.current.get(opaque);
        if (base === undefined) {
          base = opaque.opacity;
          baseOpacity.current.set(opaque, base);
        }
        opaque.opacity = base * fade;
      });
    }

    if (preset.current) {
      const elapsed = performance.now() - startedAt.current;
      const t = Math.min(elapsed / preset.current.duration, 1);
      orientationAt(from.current, to.current, preset.current, t, scratch.current);
      group.quaternion.copy(scratch.current);

      if (t >= 1) {
        // Snap exactly onto the canonical orientation, then hand control back.
        group.quaternion.copy(to.current);
        preset.current = null;
        onTransitionEnd();
      }
    }

    // Reading state keeps an extremely subtle drift on an outer group, so the
    // face orientation itself stays exact.
    if (idle.current) {
      const amount = reducedMotion || isTransitioning ? 0 : 1;
      const time = frameState.clock.elapsedTime;
      idle.current.rotation.y = THREE.MathUtils.lerp(
        idle.current.rotation.y,
        Math.sin(time * 0.35) * 0.018 * amount,
        0.05,
      );
      idle.current.rotation.x = THREE.MathUtils.lerp(
        idle.current.rotation.x,
        Math.sin(time * 0.27) * 0.014 * amount,
        0.05,
      );
      idle.current.position.y = THREE.MathUtils.lerp(
        idle.current.position.y,
        Math.sin(time * 0.5) * 0.03 * amount,
        0.05,
      );
    }
  });

  return (
    <group ref={idle}>
      <group ref={cube}>
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshPhysicalMaterial
            color="#26304a"
            metalness={0.6}
            roughness={0.2}
            transparent
            opacity={0.46}
            clearcoat={1}
            clearcoatRoughness={0.1}
            envMapIntensity={1.2}
          />
          <Edges scale={1.001} threshold={15} color="#9fb4c9" transparent />
        </mesh>

        {faces.map((face, index) => {
          const placement = FACE_PLACEMENT[index];
          return face.type === "text" ? (
            <TextFace
              key={index}
              index={index}
              face={face}
              position={placement.position}
              rotation={placement.rotation}
              visible={revealText && index === activeFace}
            />
          ) : (
            <ImageFace
              key={index}
              face={face}
              position={placement.position}
              rotation={placement.rotation}
            />
          );
        })}
      </group>
    </group>
  );
}
