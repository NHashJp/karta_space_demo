"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { replyStarAt } from "./framing";

/**
 * Where a launched reply settled (spec v0.2 §10.3, §10.4).
 *
 * A slightly brighter star with a faint cross-flare, in the sky above the
 * planet. It is the only thing in the whole product that records that the
 * receiver did something — and it records it **in their own browser**, in
 * `localStorage`, not on a server (§10.4).
 *
 * That is the honest shape of it. The reply itself went to one inbox and is
 * not here; what is here is a small private mark, for them, saying *I wrote
 * back*. Opening the card on another device shows a sky without it, and that
 * is correct rather than a bug: the mark belongs to the moment, not to an
 * account they never made.
 */
export function ReplyStar({
  cometProgress,
  reducedMotion,
}: {
  /** The same number the rocket was aimed with. */
  cometProgress: number;
  reducedMotion: boolean;
}) {
  const size = useThree((state) => state.size);
  const star = useRef<THREE.Mesh>(null);
  const flare = useRef<THREE.Mesh>(null);

  // The same place the rocket's arc ends, from the same function, so a
  // returning visitor finds the star exactly where they watched it settle.
  const position = useMemo(
    () => new THREE.Vector3(...replyStarAt(cometProgress, size.width, size.height)),
    [cometProgress, size.width, size.height],
  );

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    // A slower, gentler twinkle than the background stars: it should be
    // findable without ever asking to be looked at.
    const pulse = 0.78 + 0.22 * Math.sin(clock.elapsedTime * 0.62);
    if (star.current) {
      (star.current.material as THREE.Material & { opacity: number }).opacity = pulse;
    }
    if (flare.current) {
      (flare.current.material as THREE.Material & { opacity: number }).opacity = pulse * 0.4;
      flare.current.rotation.z = clock.elapsedTime * 0.04;
    }
  });

  return (
    <group position={position}>
      <mesh ref={star}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial
          color="#e8f6ff"
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* The cross-flare, which is what makes a small point read as bright. */}
      <mesh ref={flare}>
        <planeGeometry args={[0.9, 0.9]} />
        <shaderMaterial
          uniforms={{ uColor: { value: new THREE.Color("#7fd4f5") } }}
          vertexShader={flareVertexShader}
          fragmentShader={flareFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

const flareVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Billboarded: a flare is a property of looking at something, not of the
    // thing itself, so it always faces the camera.
    vec4 view = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    view.xy += (uv - 0.5) * 0.9;
    gl_Position = projectionMatrix * view;
  }
`;

const flareFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec2 offset = vUv - 0.5;
    float horizontal = (1.0 - smoothstep(0.0, 0.012, abs(offset.y)))
      * (1.0 - smoothstep(0.0, 0.5, abs(offset.x)));
    float vertical = (1.0 - smoothstep(0.0, 0.012, abs(offset.x)))
      * (1.0 - smoothstep(0.0, 0.5, abs(offset.y)));
    float alpha = (horizontal + vertical) * 0.6;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;
