"use client";

import { Html } from "@react-three/drei";
import type { TextFace as TextFaceData } from "@/types/card";

type Props = {
  face: TextFaceData;
  /** Face-local transform placing this plane on one side of the cube. */
  position: [number, number, number];
  rotation: [number, number, number];
  visible: boolean;
  index: number;
};

/**
 * Japanese paragraph text is real DOM attached to the cube face (spec §12) —
 * sharper type, proper line breaking, and readable by assistive tech.
 */
export function TextFace({ face, position, rotation, visible, index }: Props) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[1.94, 1.94]} />
        <meshBasicMaterial color="#070910" transparent opacity={0.62} />
      </mesh>
      <Html
        transform
        scale={0.0046}
        position={[0, 0, 0.01]}
        zIndexRange={[20, 10]}
        pointerEvents="none"
      >
        <div
          className="face-text"
          data-visible={visible}
          aria-hidden={!visible}
          lang="ja"
        >
          <p>{face.body}</p>
          <span className="face-text__index">{String(index + 1).padStart(2, "0")}</span>
        </div>
      </Html>
    </group>
  );
}
