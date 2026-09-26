"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RAMP_SIZE, ribbonFragmentShader, ribbonVertexShader } from "./shaders/ribbon";
import { trailColour, trailSeed, type TrailSeed } from "@/lib/trailColour";
import { memoryU, trailPoint, trailTangent, type Point3 } from "@/lib/trailCurve";
import { useStagedTrail } from "./useStagedTrail";

/**
 * 航跡 — the trail of memories behind the satellite (spec v0.2 §9.1).
 *
 * A camera-facing ribbon along the card's curve, tapering from 0.10 units wide
 * at the near end to 0.02 at the far one, with a glint where each memory sits.
 * Its colours drift: at any moment two to four of the palette blend along its
 * length, and any one point takes 20–40 seconds to become a different colour.
 * It should never be *caught* changing.
 *
 * The ribbon is built once and never rebuilt — only the colour ramp changes
 * per frame, and that is 32 vectors.
 */

const SEGMENTS = 220;
/*
 * Wider than it was. In the orbit view the trail comes in at the top-left as
 * one of the four things the composition is made of (rev 6 §3.1), and at 0.1
 * near-width it arrived as a thread — the colours §9.1 goes to such trouble
 * to drift were there, but too few pixels wide for anyone to see them drift.
 */
const WIDTH_NEAR = 0.16;
const WIDTH_FAR = 0.03;

/**
 * How close the ribbon may come to the lens before it fades out entirely.
 *
 * Comfortably more than the camera's own offset from the curve, so the stretch
 * of trail the reader is flying beside dims rather than flares.
 */
const NEAR_FADE = 2.6;

type Props = {
  /** The card's curve seed. The ribbon stages the curve itself (§4.5). */
  curveSeed: number;
  seed: TrailSeed;
  memoryCount: number;
  reducedMotion: boolean;
  /** The landing screen shows the same trail at a quarter strength (§7). */
  intensity?: number;
};

export function Trail({ curveSeed, seed, memoryCount, reducedMotion, intensity = 1 }: Props) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const glints = useRef<THREE.Points>(null);
  const points = useStagedTrail(curveSeed);

  const geometry = useMemo(() => buildRibbon(points), [points]);

  const glintGeometry = useMemo(() => {
    const positions = new Float32Array(memoryCount * 3);
    const us = new Float32Array(memoryCount);
    for (let i = 0; i < memoryCount; i++) {
      const u = memoryU(points, i, memoryCount);
      const [x, y, z] = trailPoint(points, u);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      us[i] = u;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(memoryCount * 3), 3));
    geo.userData.us = us;
    return geo;
  }, [points, memoryCount]);

  const uniforms = useMemo(
    () => ({
      uRamp: { value: Array.from({ length: RAMP_SIZE }, () => new THREE.Color()) },
      uIntensity: { value: intensity },
      uNearFade: { value: NEAR_FADE },
    }),
    [intensity],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (material.current) {
      const ramp = material.current.uniforms.uRamp.value as THREE.Color[];
      for (let i = 0; i < RAMP_SIZE; i++) {
        const [r, g, b] = trailColour(i / (RAMP_SIZE - 1), t, seed, reducedMotion);
        ramp[i].setRGB(r, g, b);
      }
      material.current.uniforms.uIntensity.value = intensity;
    }

    // Each memory's glint takes the trail's colour where it hangs, from the
    // same function — so a glint is never a colour the ribbon under it is not.
    const mesh = glints.current;
    if (mesh) {
      const attribute = mesh.geometry.getAttribute("aColor") as THREE.BufferAttribute;
      const array = attribute.array as Float32Array;
      const us = mesh.geometry.userData.us as Float32Array;
      for (let i = 0; i < us.length; i++) {
        const [r, g, b] = trailColour(us[i], t, seed, reducedMotion);
        array[i * 3] = r;
        array[i * 3 + 1] = g;
        array[i * 3 + 2] = b;
      }
      attribute.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh geometry={geometry} frustumCulled={false} renderOrder={-2}>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={ribbonVertexShader}
          fragmentShader={ribbonFragmentShader}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {memoryCount > 0 ? (
        <points ref={glints} geometry={glintGeometry} frustumCulled={false}>
          <shaderMaterial
            uniforms={{ uIntensity: { value: intensity } }}
            vertexShader={glintVertexShader}
            fragmentShader={glintFragmentShader}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </points>
      ) : null}
    </group>
  );
}

/**
 * A flat ribbon along the curve.
 *
 * Built once, in world space, rather than rebuilt to face the camera each
 * frame. The trail recedes almost straight away from the viewer, so a strip
 * offset along the curve's own binormal already reads face-on from anywhere
 * the camera ever goes — and rebuilding 220 segments a frame to gain nothing
 * would be the expensive way to have the same picture.
 */
function buildRibbon(points: Point3[]): THREE.BufferGeometry {
  const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const us = new Float32Array((SEGMENTS + 1) * 2);
  const sides = new Float32Array((SEGMENTS + 1) * 2);
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const across = new THREE.Vector3();

  for (let i = 0; i <= SEGMENTS; i++) {
    const u = i / SEGMENTS;
    const [x, y, z] = trailPoint(points, u);
    tangent.set(...trailTangent(points, u));
    across.crossVectors(tangent, up).normalize();
    // A tangent parallel to `up` would give a zero cross product; the curve
    // recedes in z so this cannot happen, but a degenerate ribbon is invisible
    // rather than obviously wrong, so it is worth not relying on that.
    if (across.lengthSq() < 1e-8) across.set(1, 0, 0);

    const width = WIDTH_NEAR + (WIDTH_FAR - WIDTH_NEAR) * u;
    for (const side of [-1, 1]) {
      const index = (i * 2 + (side === -1 ? 0 : 1)) * 3;
      positions[index] = x + across.x * width * side;
      positions[index + 1] = y + across.y * width * side;
      positions[index + 2] = z + across.z * width * side;
      us[i * 2 + (side === -1 ? 0 : 1)] = u;
      sides[i * 2 + (side === -1 ? 0 : 1)] = side;
    }

    if (i < SEGMENTS) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aU", new THREE.BufferAttribute(us, 1));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
  geometry.setIndex(indices);
  return geometry;
}

const glintVertexShader = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    // Larger when near, so a distant memory is a speck and the one in front of
    // you is a light.
    gl_PointSize = clamp(220.0 / -viewPosition.z, 3.0, 26.0);
  }
`;

const glintFragmentShader = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vColor;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float radius = length(offset);
    float core = 1.0 - smoothstep(0.0, 0.12, radius);
    float halo = pow(1.0 - smoothstep(0.0, 0.5, radius), 2.4) * 0.55;
    float alpha = (core + halo) * uIntensity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;
