"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { panelCellsFragmentShader, panelCellsVertexShader } from "./shaders/panelCells";
import { keyLight } from "@/lib/sceneLight";
import { useDawn } from "./DawnProvider";
import { DEPLOY_MS } from "@/lib/timing";
import {
  BOOM_L,
  BOOM_RADIUS,
  MAST_AT,
  MAST_HEIGHT,
  N_PANELS,
  PANEL_H,
  PANEL_THICKNESS,
  PANEL_W,
  boomAt,
  unfoldAt,
  wingChain,
  type WingIndex,
} from "@/lib/satelliteGeometry";

/**
 * The solar arrays (spec v0.2 rev 6, §2).
 *
 * Two wings on booms, three panels each, unfolding like an accordion — the way
 * a real spacecraft opens. The shape itself lives in `lib/satelliteGeometry.ts`
 * so that the framing checks and verify can measure the same thing this draws;
 * this file is only the drawing and the timing.
 *
 * **Nothing covers a face while the letter is being read.** The wings do not
 * exist before deploy t = 0.15: they emerge from the face centres, growing as
 * the booms carry them out, so they never pass through the body.
 */

/** Panel k's hinge is the k-th point of the chain. */
const PANEL_INDICES = Array.from({ length: N_PANELS }, (_, k) => k);

type Props = {
  /**
   * How far the deployment has got, written every frame by `MessageCube`.
   *
   * A ref, not a number: these angles change 60 times a second, and an earlier
   * version routed them through React state, which only updated on a threshold
   * crossing — so the wings latched a third of a degree open and never moved.
   */
  progress: React.RefObject<number>;
  /**
   * What to multiply the panels' opacity by, written by `MessageCube`.
   *
   * The wings are shader materials, so the traversal that fades the rest of
   * the satellite does not reach them — it writes `material.opacity`, which
   * `panelCells` ignores in favour of its own uniform. Without this the body
   * would fade out on the way to the trail and leave two arrays hanging in
   * the dark.
   */
  fade: React.RefObject<number>;
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
};

type WingRefs = {
  boom: THREE.Mesh | null;
  panels: (THREE.Group | null)[];
};

export function SolarWings({ progress, fade, seed, returned, reducedMotion }: Props) {
  const wings = useRef<WingRefs[]>([
    { boom: null, panels: [] },
    { boom: null, panels: [] },
  ]);
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color("#1c2333") },
      uCell: { value: new THREE.Color("#00aeef") },
      /* The ruled wire, the same steel the booms and the cube's edges are. */
      uLine: { value: new THREE.Color("#9fb4c9") },
      uSun: { value: new THREE.Vector3(0, 0, 1) },
      uSunColor: { value: new THREE.Color("#fff4e6") },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
      uDawn: { value: 0.2 },
    }),
    [],
  );

  /*
   * One uniform set per panel, so the sweep can arrive at each in turn (§5).
   *
   * The six share every holder in `uniforms` — the spread copies the
   * references, not the values — so the sun, the dawn, the clock and the fade
   * are still written once a frame in one place. Only `uIndex` differs.
   *
   * The index is the panel's position **across the satellite**, left to right,
   * rather than the order the wings happen to be built in: the flash should
   * run along the arrays the way light actually sweeps across a thing, and the
   * outer panel of the left wing is the leftmost of the six, not the third.
   */
  const panelUniforms = useMemo(
    () =>
      ([0, 1] as const).map((wing) =>
        PANEL_INDICES.map((k) => ({
          ...uniforms,
          uIndex: { value: wing === 0 ? 2 - k : 3 + k },
        })),
      ),
    [uniforms],
  );

  const { d, active, toSun } = useDawn();

  useFrame(({ clock }) => {
    // `progress` is the deploy t itself, 0 docked to 1 deployed.
    const t = progress.current;
    const boom = boomAt(t);
    const sun = keyLight(clock.elapsedTime, seed, active ? d : undefined, {
      reducedMotion,
      returned,
      toSun,
    });

    const shown = fade.current;
    if (group.current) group.current.visible = boom > 0.0001 && shown > 0.002;
    if (material.current) {
      const u = material.current.uniforms;
      u.uSun.value.set(...sun.dir);
      u.uSunColor.value.set(sun.color);
      u.uOpacity.value = shown;
      // Every panel shares these holders, so writing them once is enough.
      // Reduced motion stills the sweep (§15) by freezing its clock.
      u.uTime.value = reducedMotion ? 0 : clock.elapsedTime;
      u.uDawn.value = active ? d.p : 0.2;
    }

    ([0, 1] as WingIndex[]).forEach((index) => {
      const wing = wings.current[index];
      const side = index === 0 ? -1 : 1;
      const unfold = unfoldAt(t, index, DEPLOY_MS);
      const chain = wingChain(side as 1 | -1, boom, unfold);

      if (wing.boom) {
        // Telescopes out of the face: inside the body until it is not.
        wing.boom.scale.y = Math.max(boom, 0.0001);
        wing.boom.position.x = side * (1 + (BOOM_L * boom) / 2);
      }

      /*
       * Each panel is placed from the chain rather than parented to the one
       * before it. Parenting would be fewer numbers, but the hinges are
       * staggered — panel 2 is still folded while panel 1 is opening — and a
       * chain of parents makes that read as the whole wing flexing instead of
       * one hinge at a time.
       */
      PANEL_INDICES.forEach((k) => {
        const panel = wing.panels[k];
        if (!panel) return;
        const from = chain[k];
        const to = chain[k + 1];

        panel.position.set((from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2);
        // The panel lies along its own segment; atan2 gives it that heading.
        panel.rotation.y = -Math.atan2(to[2] - from[2], to[0] - from[0]);

        const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
        panel.scale.x = Math.max(length / PANEL_W, 0.0001);
      });
    });
  });

  return (
    <group ref={group} visible={false}>
      {([0, 1] as WingIndex[]).map((index) => (
          <group key={index}>
            <mesh
              ref={(node) => {
                wings.current[index].boom = node;
              }}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[BOOM_RADIUS, BOOM_RADIUS, BOOM_L, 8]} />
              {/* `transparent`, so the stow fade in `MessageCube` can reach it. */}
              <meshStandardMaterial color="#9fb4c9" metalness={0.8} roughness={0.35} transparent />
            </mesh>

            {PANEL_INDICES.map((k) => (
              <group
                key={k}
                ref={(node) => {
                  wings.current[index].panels[k] = node;
                }}
              >
                <mesh>
                  <boxGeometry args={[PANEL_W, PANEL_H, PANEL_THICKNESS]} />
                  {/*
                    `transparent`, or the alpha the shader writes from
                    `uOpacity` is discarded and the arrays stay solid while
                    everything holding them up fades away. `depthWrite` stays
                    on: these are real panels that occlude what is behind them,
                    and they are only ever part-transparent on the way out.
                  */}
                  <shaderMaterial
                    ref={index === 1 && k === 0 ? material : undefined}
                    uniforms={panelUniforms[index][k]}
                    vertexShader={panelCellsVertexShader}
                    fragmentShader={panelCellsFragmentShader}
                    transparent
                    toneMapped={false}
                  />
                  <Edges color="#9fb4c9" threshold={15} transparent />
                </mesh>
              </group>
            ))}
          </group>
      ))}

      {/* The mast, off-centre on the top face, carrying the nav light. */}
      <mesh position={[MAST_AT[0], MAST_AT[1] + MAST_HEIGHT / 2, MAST_AT[2]]}>
        <cylinderGeometry args={[0.025, 0.025, MAST_HEIGHT, 6]} />
        <meshStandardMaterial color="#9fb4c9" metalness={0.8} roughness={0.35} transparent />
      </mesh>
      <NavLight fade={fade} reducedMotion={reducedMotion} />
    </group>
  );
}

/** A tiny ion-white blink at the mast's tip: 2.6 s, 10% duty (§23.3). */
function NavLight({
  fade,
  reducedMotion,
}: {
  /**
   * The beacon rewrites its own opacity every frame, so it is the one thing
   * here the stow fade cannot simply be applied to from outside — it has to be
   * a term in the blink itself, or the light goes on flashing over an empty
   * patch of sky after the satellite carrying it has gone.
   */
  fade: React.RefObject<number>;
  reducedMotion: boolean;
}) {
  const light = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!light.current) return;
    const material = light.current.material as THREE.Material & { opacity: number };
    // Ten per cent of the cycle, so it reads as a beacon rather than a pulse.
    const phase = (clock.elapsedTime % 2.6) / 2.6;
    const blink = reducedMotion ? 0.35 : phase < 0.1 ? 1 : 0.08;
    // The same ceiling the rest of the satellite is under, so the beacon
    // cannot still be flashing after everything around it has gone.
    material.opacity = Math.min(blink, fade.current);
  });

  return (
    <mesh ref={light} position={[MAST_AT[0], MAST_AT[1] + MAST_HEIGHT, MAST_AT[2]]}>
      <sphereGeometry args={[0.045, 8, 8]} />
      <meshBasicMaterial
        color="#dff4ff"
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
