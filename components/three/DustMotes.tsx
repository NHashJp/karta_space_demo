"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Dust in front of the camera (spec v0.2 §23.2, L5).
 *
 * This is the layer that does the most for the least. The stars are 30 units
 * away and the nebula is further still, so nothing in the scene has ever been
 * *near* — and without a near layer the camera's own movement reads as the
 * world turning rather than the camera moving. A dozen specks two units away
 * parallax hard against all that distance, and suddenly there is space between
 * the viewer and the sky.
 *
 * They drift up and to the left at about 0.05 units/s, which is under the 12
 * px/s ceiling the motion budget sets (§23.5), and wrap round when they leave
 * the box rather than respawning — a mote that pops out of existence is the
 * one thing here anybody would notice.
 */

const BOX = 6;
const DRIFT = new THREE.Vector3(-0.036, 0.034, 0);

/** Fewer on a phone, where the fill cost matters and the box is smaller. */
const COUNT_DESKTOP = 24;
const COUNT_PHONE = 12;
const LOW_DETAIL_WIDTH = 700;

export function DustMotes({ reducedMotion }: { reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null);
  const width = useThree((state) => state.size.width);
  const dpr = useThree((state) => state.viewport.dpr);
  const count = width < LOW_DETAIL_WIDTH ? COUNT_PHONE : COUNT_DESKTOP;

  const geometry = useMemo(() => {
    let state = 5381 >>> 0;
    const random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000;

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * BOX;
      positions[i * 3 + 1] = (random() - 0.5) * BOX;
      // Kept in front of the camera's near plane but well short of the cube.
      positions[i * 3 + 2] = (random() - 0.5) * BOX;
      sizes[i] = 1.5 + random() * 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [count]);

  const uniforms = useMemo(() => ({ uPixelRatio: { value: 1 } }), []);

  useFrame(({ camera }, delta) => {
    const mesh = points.current;
    if (!mesh) return;

    // The box travels with the camera, so the motes are always the near layer
    // wherever the camera has gone.
    mesh.position.copy(camera.position);
    mesh.quaternion.copy(camera.quaternion);
    (mesh.material as THREE.ShaderMaterial).uniforms.uPixelRatio.value = dpr;

    if (reducedMotion) return;

    const attribute = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    const half = BOX / 2;
    for (let i = 0; i < array.length; i += 3) {
      array[i] += DRIFT.x * delta;
      array[i + 1] += DRIFT.y * delta;
      // Wrapping rather than respawning: the mote that leaves on the left is
      // the one that arrives on the right, so nothing ever appears or vanishes.
      if (array[i] < -half) array[i] += BOX;
      if (array[i + 1] > half) array[i + 1] -= BOX;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={-1}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={dustVertexShader}
        fragmentShader={dustFragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

const dustVertexShader = /* glsl */ `
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vFade;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * uPixelRatio;

    // A mote right on the camera would be a smear across the frame, and one at
    // the far wall of the box is not "near" any more. Fade both ends out.
    float distance = -viewPosition.z;
    vFade = smoothstep(0.6, 1.4, distance) * (1.0 - smoothstep(3.2, 4.6, distance));
  }
`;

const dustFragmentShader = /* glsl */ `
  varying float vFade;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float falloff = 1.0 - smoothstep(0.0, 0.5, length(offset));
    float alpha = falloff * falloff * vFade * 0.34;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vec3(0.82, 0.86, 0.94), alpha);
  }
`;
