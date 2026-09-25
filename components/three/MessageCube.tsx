"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { CardFace } from "@/types/card";
import { SolarWings } from "./SolarWings";
import { TextFace } from "./TextFace";
import { ImageFace } from "./ImageFace";
import { SecretFace } from "./SecretFace";
import {
  FACE_ORIENTATIONS,
  REDUCED_MOTION_PRESET,
  orientationAt,
  pickPreset,
  type RotationPreset,
} from "./rotationPresets";
import {
  DISPLAY_EULER_ORDER,
  DISPLAY_PITCH,
  DISPLAY_ROLL,
  DISPLAY_YAW,
  deploymentAt,
} from "@/lib/deployment";
import { DEPLOY_MS, REDUCED_MS } from "@/lib/timing";

const HALF_PI = Math.PI / 2;

/**
 * How much larger the idle drift is once the cube is a satellite.
 *
 * 0.018 rad is about a degree, which is right for something being read and far
 * too still for something in orbit. Six times that reaches the ±6° tumble
 * revision 6 §3.2 asks for.
 */
const TUMBLE_IN_ORBIT = 6;

/** Scratch, so the deployment allocates nothing per frame. */
const DISPLAY = new THREE.Quaternion();
const EULER = new THREE.Euler();

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
  /** Fade out entirely: the trail is no place for the thing you left (§9.3). */
  stowed?: boolean;
  /** One short line on the inside of the far wall, if this card has one. */
  secret?: string;
  /** The camera is on its way into the cube, in it, or on its way out. */
  within: boolean;
  /** The line itself is only attached once the camera has arrived. */
  revealSecret: boolean;
  reducedMotion: boolean;
  onTransitionEnd: () => void;
  /**
   * Which way the deployment is running, if it is (spec v0.2 §8.2). The cube
   * owns this animation, so it also owns saying when it is finished — the
   * camera follows the same constant but never decides the phase.
   */
  deploying?: "out" | "in" | null;
  /**
   * Whether the cube *should* be a satellite right now, regardless of whether
   * the animation ever played. The two can disagree — see the reconcile in
   * `useFrame` — and when they do, this is the truth.
   */
  deployed?: boolean;
  /**
   * Written every frame, read by whatever else needs to know how far along the
   * deployment is — the carrier that flies the cube to its orbit, and the ring
   * that fades in under it. A ref rather than state, because this changes 60
   * times a second and none of those are React renders.
   */
  progress?: React.RefObject<number>;
  onDeployEnd?: () => void;
  seed?: number;
  returned?: boolean;
};

export function MessageCube({
  faces,
  activeFace,
  isTransitioning,
  revealText,
  dimmed,
  stowed = false,
  secret,
  within,
  revealSecret,
  reducedMotion,
  onTransitionEnd,
  deploying = null,
  deployed = false,
  progress,
  onDeployEnd,
  seed = 0,
  returned = false,
}: Props) {
  const cube = useRef<THREE.Group>(null);
  const idle = useRef<THREE.Group>(null);
  const thruster = useRef<THREE.PointLight>(null);
  const shell = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);

  // 0 = the letter, 1 = a satellite in orbit. It lives here because the cube
  // is what is being deployed; everything else reads it.
  const local = useRef(progress?.current ?? 0);
  const deployStartedAt = useRef(0);
  const deployFrom = useRef(0);

  const from = useRef(new THREE.Quaternion().copy(FACE_ORIENTATIONS[0]));
  const to = useRef(new THREE.Quaternion().copy(FACE_ORIENTATIONS[0]));
  const scratch = useRef(new THREE.Quaternion());
  const preset = useRef<RotationPreset | null>(null);
  const lastPreset = useRef<string | undefined>(undefined);
  const startedAt = useRef(0);

  // Base opacities are captured once, so dimming can scale them without
  // needing every material threaded through props.
  const dim = useRef(0);
  const stow = useRef(0);
  /** What the wings should multiply their own opacity by. */
  const stowFade = useRef(1);
  const baseOpacity = useRef(new WeakMap<THREE.Material, number>());

  // A deployment starts from wherever the cube currently is, so an interrupted
  // one reverses out of its own position rather than snapping to an end.
  useEffect(() => {
    if (!deploying) return;
    deployFrom.current = local.current;
    deployStartedAt.current = performance.now();
  }, [deploying]);

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

    /*
     * ---- the deployment ---------------------------------------------------
     *
     * Reconcile first. `local` only moves while `deploying` is set, so any
     * route into orbit that skips the animation — the editor's `?at=` jump,
     * which replays deploy and deployEnd in one go, or a `deployEnd` that
     * lands in `departing` before a frame runs — used to leave the cube
     * sitting in orbit as an un-unfolded cube. It is rare, it looks broken,
     * and it is invisible in any test that does not render.
     */
    if (!deploying) {
      const target = deployed ? 1 : 0;
      if (local.current !== target) {
        // Caught up over ~200ms rather than snapped, so a genuine near-miss at
        // the end of an animation finishes smoothly instead of jumping.
        local.current = THREE.MathUtils.damp(local.current, target, 14, delta);
        if (Math.abs(local.current - target) < 0.002) local.current = target;
      }
    }

    if (deploying) {
      const target = deploying === "out" ? 1 : 0;
      const span = Math.abs(target - deployFrom.current) || 1;
      const total = (reducedMotion ? REDUCED_MS : DEPLOY_MS) * span;
      const t = Math.min((performance.now() - deployStartedAt.current) / total, 1);
      local.current = deployFrom.current + (target - deployFrom.current) * t;

      if (t >= 1) {
        local.current = target;
        // The cube says when it has arrived. Nothing else may decide this: the
        // camera runs the same constant, but if it announced the end the two
        // could disagree by a frame at a low frame rate and the panels would
        // still be moving when the orbit UI appeared.
        onDeployEnd?.();
      }
    }

    if (progress) progress.current = local.current;
    const now = deploymentAt(local.current);

    /*
     * The body stops being glass.
     *
     * While it is a letter the cube is translucent — you are meant to feel
     * that there is something inside it. A satellite is not translucent, and
     * without this the deployment was four panels appearing on an unchanged
     * object rather than the object itself becoming something else. Opacity
     * and roughness both climb with the deployment.
     */
    if (shell.current) {
      const material = shell.current.material as THREE.MeshPhysicalMaterial;
      material.opacity = 0.46 + 0.42 * now.turn;
      material.roughness = 0.2 + 0.18 * now.turn;
      material.metalness = 0.6 + 0.25 * now.turn;
    }

    if (thruster.current) thruster.current.intensity = now.thruster * 2;
    if (glow.current) {
      glow.current.visible = now.thruster > 0.01;
      const material = glow.current.material as THREE.Material & { opacity: number };
      material.opacity = now.thruster * 0.7;
      glow.current.scale.setScalar(0.6 + now.thruster * 0.9);
    }

    // Damping approaches zero asymptotically, so snap the tail and run one
    // last pass at full opacity — otherwise materials settle just below it.
    const wasDimmed = dim.current > 0;
    dim.current = THREE.MathUtils.damp(dim.current, dimmed ? 1 : 0, 3.2, delta);
    if (!dimmed && dim.current < 0.002) dim.current = 0;

    /*
     * Stowing is the same mechanism taken all the way to nothing, and it is
     * deliberately folded in here rather than given a fade of its own: two
     * passes writing `material.opacity` from their own cached base would each
     * cache the other's output, and the result is a satellite that settles at
     * whatever opacity the last frame happened to leave.
     */
    const wasStowed = stow.current > 0;
    stow.current = THREE.MathUtils.damp(stow.current, stowed ? 1 : 0, 3.6, delta);
    if (!stowed && stow.current < 0.002) stow.current = 0;
    if (stowed && stow.current > 0.998) stow.current = 1;

    // The wings are shader materials and carry their own opacity; the ref is
    // how `SolarWings` reads this same number rather than deriving its own.
    stowFade.current = 1 - stow.current;
    group.visible = stow.current < 0.999;

    if (dim.current > 0 || wasDimmed || stow.current > 0 || wasStowed) {
      const fade = (1 - dim.current * 0.88) * (1 - stow.current);
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

    if (local.current > 0) {
      // Deployed, the cube holds a 3/4 view rather than a face: it has stopped
      // being a page to read and become an object to look at. Blended from
      // whichever face was last read, so the turn is continuous.
      // Yaw, pitch, then roll: the roll is what puts the wing axis on the
      // composition's -50 degree diagonal (rev 6 §3.1).
      DISPLAY.setFromEuler(
        EULER.set(DISPLAY_PITCH, DISPLAY_YAW, DISPLAY_ROLL, DISPLAY_EULER_ORDER),
      );
      group.quaternion.slerp(DISPLAY, now.turn);
      // A slow tumble, so a satellite at rest is not a still image of one.
      if (!reducedMotion && local.current >= 1) {
        const wobble = Math.sin(frameState.clock.elapsedTime * 0.21) * 0.105;
        group.rotateY(wobble * delta);
      }
    } else if (preset.current) {
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
    // face orientation itself stays exact. Inside the cube the same drift is
    // what keeps the walls from reading as a flat backdrop.
    if (idle.current) {
      const amount = reducedMotion || isTransitioning ? 0 : 1;
      const time = frameState.clock.elapsedTime;

      /*
       * A letter drifts by a degree; a satellite tumbles by six (rev 6 §3.2).
       *
       * The same motion, scaled by how far the cube has become a spacecraft.
       * While it is a letter this has to be almost nothing — a paragraph that
       * moves while you read it is worse than a still one — but once it is in
       * orbit the opposite is true: barely moving is what made it look parked,
       * and §3.2's ±6° tumble was never actually reached. It was implemented
       * at the reading amplitude and left there.
       */
      const alive = 1 + local.current * (TUMBLE_IN_ORBIT - 1);

      idle.current.rotation.y = THREE.MathUtils.lerp(
        idle.current.rotation.y,
        Math.sin(time * 0.35) * 0.018 * alive * amount,
        0.05,
      );
      idle.current.rotation.x = THREE.MathUtils.lerp(
        idle.current.rotation.x,
        // A different multiple, so the two axes never come back into step and
        // the tumble does not settle into an obvious repeating figure.
        Math.sin(time * 0.27) * 0.014 * alive * amount,
        0.05,
      );
      idle.current.rotation.z = THREE.MathUtils.lerp(
        idle.current.rotation.z,
        // Roll only in orbit: a letter that rolls is a letter you cannot read.
        Math.sin(time * 0.19) * 0.02 * local.current * amount,
        0.05,
      );
      idle.current.position.y = THREE.MathUtils.lerp(
        idle.current.position.y,
        Math.sin(time * 0.5) * 0.03 * alive * amount,
        0.05,
      );
    }
  });

  return (
    <group ref={idle}>
      {/*
        The inside of the cube, mounted only while the camera is within it. The
        outer box is FrontSide, so without this shell the walls would vanish
        from in there and the scene would show straight through.
      */}
      {within && secret ? (
        <>
          <mesh>
            <boxGeometry args={[1.96, 1.96, 1.96]} />
            <meshStandardMaterial
              color="#121a2c"
              side={THREE.BackSide}
              roughness={0.85}
              metalness={0.1}
            />
          </mesh>
          {/* Every light in the scene is outside the cube; this one is not. */}
          <pointLight position={[0, 0, 0.35]} intensity={2.4} distance={4.5} color="#8fb6ff" />
          <SecretFace text={secret} visible={revealSecret} />
        </>
      ) : null}

      <group ref={cube}>
        <SolarWings
          progress={local}
          fade={stowFade}
          seed={seed}
          returned={returned}
          reducedMotion={reducedMotion}
        />

        {/*
          One soft pulse under the cube as it leaves. A thruster you can see
          the shape of would be a rocket; this is a nudge, which is what moves
          something that is already weightless.
        */}
        <pointLight ref={thruster} position={[0, -1.4, 0]} intensity={0} distance={6} color="#8fd9ff" />
        <mesh ref={glow} position={[0, -1.3, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <circleGeometry args={[1.1, 32]} />
          <meshBasicMaterial
            color="#8fd9ff"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        <mesh ref={shell}>
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
