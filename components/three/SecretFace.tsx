"use client";

import { scriptLang, visualLength } from "@/lib/i18n";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FlatHtml } from "./FlatHtml";
import { SECRET_PLANE_Z, fitLinePx, secretPanel } from "./framing";

type Props = {
  text: string;
  visible: boolean;
};

/**
 * The line written on the inside of the far wall.
 *
 * It deliberately sits *outside* the rotating cube group: the camera only ever
 * enters along +z, so the line faces the way the camera came in, whichever face
 * the cube happened to stop on.
 */
export function SecretFace({ text, visible }: Props) {
  const size = useThree((state) => state.size);
  const { panelPx, worldWidth } = secretPanel(size.width, size.height);
  const fontPx = fitLinePx(panelPx, visualLength(text));

  return (
    <group position={[0, 0, SECRET_PLANE_Z]}>
      {/* The wall behind the line, lit from within rather than by the scene. */}
      <mesh>
        <planeGeometry args={[worldWidth * 1.35, worldWidth * 0.62]} />
        <meshBasicMaterial color="#070c16" transparent opacity={0.82} side={THREE.DoubleSide} />
      </mesh>
      <FlatHtml worldWidth={worldWidth} panelPx={panelPx} position={[0, 0, 0.012]}>
        <p
          className="secret-line"
          style={{ width: panelPx, fontSize: `${fontPx}px` }}
          data-visible={visible}
          aria-hidden={!visible}
          lang={scriptLang(text)}
        >
          {text}
        </p>
      </FlatHtml>
    </group>
  );
}
