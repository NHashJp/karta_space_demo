"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { panelCellsFragmentShader, panelCellsVertexShader } from "./shaders/panelCells";
import { keyLight } from "@/lib/sceneLight";
import { deploymentAt, wingAt } from "@/lib/deployment";
// The span these add up to is declared in lib/deployment.ts, where the orbit
// clearance check can reach it.

/**
 * The solar arrays (spec v0.2 §8.2, re-drawn).
 *
 * The spec's mechanism was four plates hinged flat against the cube's side
 * faces, swinging up into a cross. It is a tidy idea and it does not read as a
 * satellite: the plates are the same size as the body and never leave it, so
 * the result looks like a box that opened rather than a spacecraft that
 * deployed.
 *
 * Real arrays are **carried away from the bus on a boom** and are much larger
 * than it, and that proportion is most of what makes the silhouette
 * recognisable at all:
 *
 *     ┌───┐
 *     │bus│──┬──[ segment 1 ][ segment 2 ]
 *     └───┘  └── the boom, and the joint the array pivots on
 *
 * Two wings rather than four, because port-and-starboard is the shape everyone
 * already knows, and because two large arrays read better at 30 px on a phone
 * than four small ones.
 *
 * It deploys in the order the real ones do: the boom telescopes out of the
 * bus, the folded array swings off the joint, and then its outer segment
 * unfolds from the inner. Each starts before the last has finished, so it
 * reads as one mechanism rather than three.
 */

/** The bus is 2 units across, so its side face is at x = 1. */
const BUS_HALF = 1;

const BOOM_LENGTH = 0.4;
const BOOM_RADIUS = 0.035;

const SEGMENT_LENGTH = 1;
const SEGMENT_WIDTH = 1.9;
const SEGMENT_THICKNESS = 0.03;

/** Stowed, the array folds back along the bus and doubles over on itself. */
const INNER_STOWED = (-166 * Math.PI) / 180;
const OUTER_STOWED = (172 * Math.PI) / 180;

/** Port and starboard. */
const WINGS = [0, Math.PI];

type Props = {
  /**
   * How far the deployment has got, written every frame by `MessageCube`.
   *
   * A ref rather than a number, and that is the whole point: the angles change
   * 60 times a second, and routing them through React state meant they only
   * updated when they crossed a threshold — so the arrays latched a third of a
   * degree open and stayed there.
   */
  progress: React.RefObject<number>;
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
};

type Wing = {
  boom: THREE.Mesh | null;
  arm: THREE.Group | null;
  inner: THREE.Group | null;
  outer: THREE.Group | null;
};

export function CubeSatPanels({ progress, seed, returned, reducedMotion }: Props) {
  const wings = useRef<Wing[]>([
    { boom: null, arm: null, inner: null, outer: null },
    { boom: null, arm: null, inner: null, outer: null },
  ]);
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
    const open = deploymentAt(progress.current).panels;
    const sun = keyLight(clock.elapsedTime, seed, returned, { reducedMotion });

    if (material.current) {
      material.current.uniforms.uSun.value.set(...sun.dir);
      material.current.uniforms.uSunColor.value.set(sun.color);
      material.current.uniforms.uOpacity.value = Math.min(open * 8, 1);
    }

    /*
     * Once open, the arrays turn a few degrees to face the sun — and because
     * the sun moves, they keep adjusting. An array that ignores where the
     * light comes from is a decoration; one that follows it is a machine doing
     * its job, and that reading is most of what sells the silhouette.
     */
    const tracking = reducedMotion ? 0 : Math.asin(clamp(sun.dir[1], -1, 1)) * 0.2;

    wings.current.forEach((wing, index) => {
      const { boom, inner, outer } = wingAt(open, index);

      if (wing.boom) {
        // Telescopes: it is inside the bus until it is not.
        wing.boom.scale.x = Math.max(boom, 0.001);
        wing.boom.position.x = (BOOM_LENGTH * boom) / 2;
        wing.boom.visible = open > 0.001;
      }
      if (wing.arm) {
        wing.arm.position.x = BOOM_LENGTH * boom;
        wing.arm.visible = open > 0.001;
      }
      if (wing.inner) {
        wing.inner.rotation.z = INNER_STOWED * (1 - inner);
        wing.inner.rotation.x = tracking * inner;
      }
      if (wing.outer) wing.outer.rotation.z = OUTER_STOWED * (1 - outer);
    });
  });

  return (
    <group>
      {WINGS.map((yaw, index) => (
        <group key={index} rotation={[0, yaw, 0]}>
          <group position={[BUS_HALF, 0, 0]}>
            {/* The boom, and the joint the array pivots on. */}
            <mesh
              ref={(node) => {
                wings.current[index].boom = node;
              }}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[BOOM_RADIUS, BOOM_RADIUS, BOOM_LENGTH, 8]} />
              <meshStandardMaterial color="#9fb4c9" metalness={0.8} roughness={0.35} />
            </mesh>

            <group
              ref={(node) => {
                wings.current[index].arm = node;
              }}
            >
              <group
                ref={(node) => {
                  wings.current[index].inner = node;
                }}
              >
                <Segment material={index === 0 ? material : undefined} uniforms={uniforms} />

                {/* The outer segment, folded back on the inner when stowed. */}
                <group
                  position={[SEGMENT_LENGTH, 0, 0]}
                  ref={(node) => {
                    wings.current[index].outer = node;
                  }}
                >
                  <Segment uniforms={uniforms} />
                </group>
              </group>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

/** One array segment: a thin plate, hinged at its inner edge. */
function Segment({
  material,
  uniforms,
}: {
  material?: React.RefObject<THREE.ShaderMaterial | null>;
  uniforms: Record<string, { value: unknown }>;
}) {
  return (
    // Offset by half its length, so the group it sits in is the hinge.
    <mesh position={[SEGMENT_LENGTH / 2, 0, 0]}>
      <boxGeometry args={[SEGMENT_LENGTH, SEGMENT_THICKNESS, SEGMENT_WIDTH]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={panelCellsVertexShader}
        fragmentShader={panelCellsFragmentShader}
        transparent
        toneMapped={false}
      />
      <Edges color="#9fb4c9" threshold={15} />
    </mesh>
  );
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
