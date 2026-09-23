"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Four to eight named-looking stars (spec v0.2 §23.2, L3).
 *
 * `Starfield` draws 1500 round dots, which averages out into a texture rather
 * than a sky. A real sky has a handful of stars you could point at, and the
 * thing that makes them read as bright is not size but the **diffraction
 * spikes** a bright point makes in an eye or a lens. Eight of those, pulsing
 * on periods between 5 and 9 seconds, give the eye somewhere to land.
 *
 * Drawn as a shader on the same spherical shell as the starfield, so they sit
 * among the other stars rather than in front of them.
 */

const COUNT = 8;
const RADIUS = 46;
const SPIKE_LENGTH = 0.44;

export function BrightStars({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const dpr = useThree((state) => state.viewport.dpr);

  const geometry = useMemo(() => {
    let state = 31337 >>> 0;
    const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000;

    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const phases = new Float32Array(COUNT);
    const periods = new Float32Array(COUNT);

    // Blue-white through to warm: the tints a real bright star comes in.
    const tints = ["#dce9ff", "#ffffff", "#fff1dc", "#cfe0ff", "#ffe6c4"];

    for (let i = 0; i < COUNT; i++) {
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      positions[i * 3] = RADIUS * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = RADIUS * sinPhi * Math.sin(theta);
      positions[i * 3 + 2] = RADIUS * cosPhi;

      const tint = new THREE.Color(tints[Math.floor(random() * tints.length)]);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;

      sizes[i] = 26 + random() * 16;
      phases[i] = random() * Math.PI * 2;
      periods[i] = 5 + random() * 4;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aPeriod", new THREE.BufferAttribute(periods, 1));
    return geo;
  }, []);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }), []);

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms.uPixelRatio.value = dpr;
    if (!reducedMotion) material.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={-4}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={brightVertexShader}
        fragmentShader={brightFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

const brightVertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  attribute float aPeriod;

  uniform float uTime;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vPulse;

  void main() {
    vColor = aColor;
    // Never below 65% of full brightness: the motion budget's twinkle ceiling
    // (§23.5). A star that nearly goes out is a flicker, not a pulse.
    vPulse = 0.82 + 0.18 * sin(uTime * 6.28318 / aPeriod + aPhase);

    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const brightFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vPulse;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float radius = length(offset);

    // The core, and the soft halo a bright point bleeds into.
    float core = 1.0 - smoothstep(0.0, 0.045, radius);
    float halo = pow(1.0 - smoothstep(0.0, 0.5, radius), 3.0) * 0.5;

    // Four spikes: a thin cross, tapering out to nothing. This is the part the
    // eye reads as "bright", far more than size.
    float horizontal = (1.0 - smoothstep(0.0, 0.012, abs(offset.y)))
      * (1.0 - smoothstep(0.0, ${SPIKE_LENGTH.toFixed(2)}, abs(offset.x)));
    float vertical = (1.0 - smoothstep(0.0, 0.012, abs(offset.x)))
      * (1.0 - smoothstep(0.0, ${SPIKE_LENGTH.toFixed(2)}, abs(offset.y)));
    float spikes = (horizontal + vertical) * 0.42;

    float alpha = (core + halo + spikes) * vPulse;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;
