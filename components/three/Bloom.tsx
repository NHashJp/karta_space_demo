"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { hubPose, worldPerPixel } from "./framing";

/**
 * A small firework (rev 7.1 §11).
 *
 * Revision 5's principle 6 was "loud is wrong — no explosions, confetti or
 * blast off", and r7 amends it to "joyful, not loud": still no shaking and no
 * confetti, but small elegant moments of joy are welcome. This is the
 * moment. Forty-four sparks, ninety pixels across, gone in a second and a
 * third — the size of a sparkler rather than of a firework, which is the
 * difference between a card that is pleased for you and one that is shouting.
 *
 * It opens where the reply overtakes the comet, which is the one instant in
 * the whole card where the receiver's answer is visibly *ahead* of the thing
 * it was racing. If any beat in this project has earned a flash, it is that
 * one.
 *
 * Drawn as `THREE.Points`: forty-four round sprites with their own colours
 * and sizes is exactly what a point cloud is for, and it is one draw call.
 */

const SPARKS = 44;
export const BLOOM_MS = 1300;

/** Gold, white, amber and ion blue — the card's whole palette, at once. */
const COLOURS = ["#ffe2aa", "#dff5ff", "#f3c98b", "#7fd4f5"];

const vertexShader = /* glsl */ `
  attribute vec3 tint;
  attribute float seed;
  attribute float speed;
  attribute float angle;
  uniform float uT;        // 0..1 through the bloom
  uniform float uReach;    // world units the fastest spark travels
  uniform float uDrift;    // world units it falls over the same time
  uniform float uScale;    // device pixels per CSS pixel
  varying vec3 vTint;
  varying float vFade;

  void main() {
    // Ease-out: a spark leaves fast and coasts, it does not travel evenly.
    float out_ = 1.0 - pow(1.0 - uT, 2.4);
    vec3 offset = vec3(
      cos(angle) * speed * uReach * out_,
      sin(angle) * speed * uReach * out_ - uDrift * uT * uT,
      0.0
    );
    vec4 view = modelViewMatrix * vec4(position + offset, 1.0);
    gl_Position = projectionMatrix * view;

    // Each spark on its own curve, so they do not all go out together.
    vFade = (1.0 - uT) * (1.0 - uT) * (0.55 + 0.45 * seed);
    vTint = tint;
    // 5 to 11 CSS pixels, shrinking a little as they go out. A spark is a
    // point of light; anything bigger starts to read as confetti, which
    // principle 6 still forbids.
    gl_PointSize = max(1.0, (5.0 + 6.0 * seed) * uScale * (1.0 - 0.35 * uT));
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vTint;
  varying float vFade;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = pow(1.0 - r, 1.6) * vFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vTint * a, a);
    #include <colorspace_fragment>
  }
`;

/** Everything the scene needs to open one. */
export type BloomRequest = {
  /** Where it opens, in world space. */
  at: [number, number, number];
  /** How wide the sparks reach, in CSS pixels. 90 desktop, 60 portrait (§11). */
  reachPx?: number;
  /** A warm flash with no sparks: the boarding's quieter version (§11). */
  sparks?: boolean;
  /** The flash's colour. Warm for boarding, near-white for the launch. */
  color?: string;
};

type Props = BloomRequest & {
  reducedMotion: boolean;
  onDone?: () => void;
};

export function Bloom({
  at,
  reachPx,
  sparks = true,
  color = "#ffffff",
  reducedMotion,
  onDone,
}: Props) {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const points = useRef<THREE.Points>(null);
  const flash = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);

  const portrait = size.width < size.height;
  const reach = reachPx ?? (portrait ? 60 : 90);

  const geometry = useMemo(() => {
    let state = 0x9e3779b9 >>> 0;
    const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000;

    const position = new Float32Array(SPARKS * 3);
    const tint = new Float32Array(SPARKS * 3);
    const seed = new Float32Array(SPARKS);
    const speed = new Float32Array(SPARKS);
    const angle = new Float32Array(SPARKS);

    for (let i = 0; i < SPARKS; i++) {
      const colour = new THREE.Color(COLOURS[i % COLOURS.length]);
      tint[i * 3] = colour.r;
      tint[i * 3 + 1] = colour.g;
      tint[i * 3 + 2] = colour.b;
      seed[i] = random();
      // Not uniform: a shell of evenly spaced sparks reads as a diagram.
      speed[i] = 0.35 + 0.65 * Math.sqrt(random());
      angle[i] = random() * Math.PI * 2;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("tint", new THREE.BufferAttribute(tint, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("speed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("angle", new THREE.BufferAttribute(angle, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uT: { value: 0 },
      uReach: { value: 1 },
      uDrift: { value: 0 },
      uScale: { value: 10 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (done.current) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;

    /*
     * Reduced motion gets the end state and nothing else (§11): a 300 ms
     * crossfade, which for a bloom means it simply never opens.
     */
    const duration = (reducedMotion ? 300 : BLOOM_MS) / 1000;
    const t = Math.min((clock.elapsedTime - startedAt.current) / duration, 1);

    // Pixels into world units, at this bloom's own depth.
    const camera = hubPose(size.width, size.height).position;
    const depth = Math.max(0.1, camera[2] - at[2]);
    const perPixel = worldPerPixel(depth, size.height);

    uniforms.uT.value = t;
    uniforms.uReach.value = reducedMotion ? 0 : reach * perPixel;
    uniforms.uDrift.value = reducedMotion ? 0 : 14 * perPixel;
    // gl_PointSize is in device pixels, so this is the inverse conversion.
    uniforms.uScale.value = dpr;

    if (points.current) points.current.visible = sparks && !reducedMotion;

    /*
     * The flash. It is the first thing and the shortest: a soft white
     * opening that is gone in the first fifth, under the sparks rather than
     * behind them.
     */
    if (flash.current) {
      const material = flash.current.material as THREE.Material & { opacity: number };
      material.opacity = Math.max(0, 1 - t / 0.22) * 0.9;
      const grow = 1 + t * 1.6;
      flash.current.scale.setScalar(reach * perPixel * 0.5 * grow);
    }

    if (t >= 1) {
      done.current = true;
      onDone?.();
    }
  });

  return (
    <group position={at}>
      <mesh ref={flash} renderOrder={30}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={31}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
