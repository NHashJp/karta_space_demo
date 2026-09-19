"use client";

import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { TextFace as TextFaceData } from "@/types/card";
import { fitFontSize, textPanelPx, textPanelScale } from "./framing";

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
  const size = useThree((state) => state.size);
  const panelPx = textPanelPx(size.width, size.height);
  // Type is fitted to the face, so a longer message sets smaller rather than
  // spilling past the cube edge.
  const fontPx = fitFontSize(panelPx, face.body.length);

  return (
    <group position={position} rotation={rotation}>
      {/* Translucent panel behind the text, for contrast against the scene. */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[1.94, 1.94]} />
        <meshBasicMaterial color="#0b111c" transparent opacity={0.72} />
      </mesh>
      <Html
        transform
        scale={textPanelScale(panelPx)}
        position={[0, 0, 0.01]}
        zIndexRange={[20, 10]}
        pointerEvents="none"
      >
        <div
          className="face-text"
          style={{ width: panelPx, height: panelPx, fontSize: `${fontPx}px` }}
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
