"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";

type Props = {
  /** Width of the panel in the group's own units; the DOM is scaled to cover it. */
  worldWidth: number;
  /** CSS width the content is authored at. */
  panelPx: number;
  position?: [number, number, number];
  children: ReactNode;
};

const left = new THREE.Vector3();
const right = new THREE.Vector3();

/**
 * DOM laid flat on the screen over a panel that faces the camera, scaled each
 * frame to the panel's projected width.
 *
 * Not drei's `<Html transform>`: that treats one world unit as one CSS pixel,
 * so WebKit's snapping of 3D layers to the pixel grid is magnified by the
 * perspective — tens of pixels on a face, hundreds inside the cube — and on an
 * iPhone the text lands off the panel. Text is only shown on a face that is
 * square-on (and on the far wall, which always is), so a flat overlay is exact.
 */
export function FlatHtml({ worldWidth, panelPx, position = [0, 0, 0], children }: Props) {
  const anchor = useRef<THREE.Group>(null);
  const box = useRef<HTMLDivElement>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const scale = useRef(0);

  useFrame(() => {
    const group = anchor.current;
    const el = box.current;
    if (!group || !el) return;
    left.set(-worldWidth / 2, 0, 0).applyMatrix4(group.matrixWorld).project(camera);
    right.set(worldWidth / 2, 0, 0).applyMatrix4(group.matrixWorld).project(camera);
    const px = Math.hypot(
      ((right.x - left.x) * size.width) / 2,
      ((right.y - left.y) * size.height) / 2,
    );
    const next = px / panelPx;
    if (Math.abs(next - scale.current) < 1e-4) return;
    scale.current = next;
    el.style.transform = `scale(${next})`;
  });

  return (
    <group ref={anchor} position={position}>
      <Html center zIndexRange={[20, 10]} wrapperClass="flat-html" style={{ pointerEvents: "none" }}>
        <div ref={box} className="flat-html__box">
          {children}
        </div>
      </Html>
    </group>
  );
}
