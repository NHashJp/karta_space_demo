"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { panelCellsFragmentShader, panelCellsVertexShader } from "./shaders/panelCells";
import { keyLight } from "@/lib/sceneLight";
import { stagger } from "@/lib/deployment";

/**
 * The four solar panels (spec v0.2 §8.2).
 *
 * Folded, each lies flat against one of the cube's side faces, hinged along
 * that face's **top** edge. Opening swings it up 90° until all four are level
 * with the top face — a cross, seen from above.
 *
 * Hinging at the top rather than the bottom is the detail that makes it read
 * as hardware. A bottom hinge would have the panels swinging *down* past the
 * cube's lower edge while folded, so a docked cube would have four plates
 * dangling under it. Hinged at the top, a folded panel reaches exactly to the
 * cube's bottom edge (1.9 of the 2 units) and the closed cube is still a cube.
 */

/** Panel size: as wide as the cube's edge, just short of its height. */
const PANEL_WIDTH = 2;
const PANEL_LENGTH = 1.9;
const PANEL_THICKNESS = 0.02;

/** Which way each hinge faces: front, right, back, left. */
const FACES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

type Props = {
  /** 0 folded flat against the cube, 1 fully open. */
  open: number;
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

export function CubeSatPanels({ open, seed, returned, reducedMotion }: Props) {
  const hinges = useRef<(THREE.Group | null)[]>([]);
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color("#1c2333") },
      uCell: { value: new THREE.Color("#00aeef") },
      uSun: { value: new THREE.Vector3(0, 0, 1) },
      uSunColor: { value: new THREE.Color("#fff4e6") },
      uOpacity: { value: 1 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const sun = keyLight(clock.elapsedTime, seed, returned, { reducedMotion });
    if (material.current) {
      material.current.uniforms.uSun.value.set(...sun.dir);
      material.current.uniforms.uSunColor.value.set(sun.color);
      // Below a hair of open, the panels are inside the cube's own silhouette
      // and only cost fill; fade them out rather than z-fighting the faces.
      material.current.uniforms.uOpacity.value = Math.min(open * 6, 1);
    }

    /*
     * Once open, the panels turn a few degrees to face the sun — and because
     * the sun moves (§23.3), they keep adjusting. A solar panel that ignores
     * where the light is coming from is a decoration; one that tracks it is a
     * machine doing its job, and that reading is most of what makes the
     * deployed cube feel like hardware rather than a cube with wings.
     */
    const tracking = reducedMotion ? 0 : Math.asin(clamp(sun.dir[1], -1, 1)) * 0.18;

    hinges.current.forEach((hinge, index) => {
      if (!hinge) return;
      const local = stagger(open, index);
      hinge.rotation.x = -local * (Math.PI / 2) + tracking * local;
      hinge.visible = open > 0.001;
    });
  });

  return (
    <group>
      {FACES.map((yaw, index) => (
        <group key={index} rotation={[0, yaw, 0]}>
          {/* The hinge sits on the top edge of this face. */}
          <group
            position={[0, 1, 1]}
            ref={(node) => {
              hinges.current[index] = node;
            }}
          >
            <mesh position={[0, -PANEL_LENGTH / 2, PANEL_THICKNESS]}>
              <boxGeometry args={[PANEL_WIDTH, PANEL_LENGTH, PANEL_THICKNESS]} />
              <shaderMaterial
                ref={index === 0 ? material : undefined}
                uniforms={index === 0 ? uniforms : { ...uniforms }}
                vertexShader={panelCellsVertexShader}
                fragmentShader={panelCellsFragmentShader}
                transparent
                toneMapped={false}
              />
              <Edges color="#9fb4c9" threshold={15} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
