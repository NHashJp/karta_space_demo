"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/** Near-black void, sparse stars, two slow-moving coloured lights (spec §14). */
export function SpaceEnvironment({ reducedMotion }: { reducedMotion: boolean }) {
  const ion = useRef<THREE.PointLight>(null);
  const nebula = useRef<THREE.PointLight>(null);
  const field = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    if (ion.current) {
      ion.current.position.set(Math.sin(t * 0.18) * 5, 2.5 + Math.sin(t * 0.23) * 1.2, 4);
    }
    if (nebula.current) {
      nebula.current.position.set(Math.cos(t * 0.15) * -5, -2 + Math.cos(t * 0.2) * 1.4, 2.5);
    }
    if (field.current) {
      field.current.rotation.y = t * 0.008;
    }
  });

  return (
    <>
      <color attach="background" args={["#05070c"]} />
      <fog attach="fog" args={["#05070c", 9, 26]} />

      <ambientLight intensity={0.55} color="#b0b4ba" />
      <directionalLight position={[3, 5, 6]} intensity={1.1} color="#e8e9eb" />
      <pointLight ref={ion} intensity={26} distance={22} color="#00aeef" />
      <pointLight ref={nebula} intensity={22} distance={22} color="#5d4b94" />

      <group ref={field}>
        <Stars radius={60} depth={38} count={1400} factor={3.2} saturation={0} fade speed={0.4} />
      </group>
    </>
  );
}
