"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { starsFragmentShader, starsVertexShader } from "./shaders/stars";
import { skyTurn } from "@/lib/sceneLight";

const COUNT = 1500;
const INNER_RADIUS = 28;
const OUTER_RADIUS = 86;

/** Star tints: mostly white, some blue-hot, a few warm. */
const TINTS = ["#ffffff", "#e8e9eb", "#cfe4ff", "#a9ccff", "#ffe9c9", "#ffd8b0"];
const TINT_WEIGHTS = [0.42, 0.2, 0.16, 0.1, 0.08, 0.04];

function pickTint(random: () => number): THREE.Color {
  let roll = random();
  for (let i = 0; i < TINTS.length; i++) {
    roll -= TINT_WEIGHTS[i];
    if (roll <= 0) return new THREE.Color(TINTS[i]);
  }
  return new THREE.Color(TINTS[0]);
}

/** Deterministic, so the sky is the same on every load. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function Starfield({
  reducedMotion,
  turning = false,
}: {
  reducedMotion: boolean;
  /** The hub's slow turn about the planet's axis (rev 6 §3.2). */
  turning?: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const field = useRef<THREE.Points>(null);
  const dpr = useThree((state) => state.viewport.dpr);

  const geometry = useMemo(() => {
    const random = makeRandom(9271);
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const speeds = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // Even distribution over a spherical shell.
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const radius = INNER_RADIUS + Math.cbrt(random()) * (OUTER_RADIUS - INNER_RADIUS);

      positions[i * 3] = radius * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = radius * sinPhi * Math.sin(theta);
      positions[i * 3 + 2] = radius * cosPhi;

      const tint = pickTint(random);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;

      // A few bright ones, many faint — roughly how a real sky reads.
      const brightness = Math.pow(random(), 2.6);
      sizes[i] = 0.5 + brightness * 3.4;
      phases[i] = random() * Math.PI * 2;
      speeds[i] = 0.25 + random() * 1.1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    return geo;
  }, []);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }),
    [],
  );

  useFrame(({ clock, camera }) => {
    if (material.current) {
      material.current.uniforms.uPixelRatio.value = dpr;
      if (!reducedMotion) material.current.uniforms.uTime.value = clock.elapsedTime;
    }
    // The sky is the far distance, and travels with the camera for the same
    // reason the nebula does.
    field.current?.position.copy(camera.position);

    // The sky turns, but not on one axis at one rate: three slow sines with
    // unrelated periods make the drift wander instead of scroll.
    if (field.current && !reducedMotion) {
      const t = clock.elapsedTime;
      // The hub adds a steady turn on top of the wander: 0.6 degrees per ten
      // seconds, which is the orbit made visible without drawing it.
      field.current.rotation.y =
        t * 0.0035 + Math.sin(t * 0.0131) * 0.26 + (turning ? skyTurn(t) : 0);
      field.current.rotation.x = Math.sin(t * 0.0093 + 1.12) * 0.13;
      field.current.rotation.z = Math.sin(t * 0.0071 + 2.34) * 0.09;
    }
  });

  return (
    <points ref={field} geometry={geometry} frustumCulled={false} renderOrder={-5}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={starsVertexShader}
        fragmentShader={starsFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
