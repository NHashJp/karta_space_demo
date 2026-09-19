"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { ImageFace as ImageFaceData } from "@/types/card";

type Props = {
  face: ImageFaceData;
  position: [number, number, number];
  rotation: [number, number, number];
};

const FACE_SIZE = 1.94;

/** Images are plain Three.js textures on the face (spec §12). */
export function ImageFace({ face, position, rotation }: Props) {
  const texture = useTexture(face.src);

  const { repeat, offset } = useMemo(() => {
    const image = texture.image as { width: number; height: number } | undefined;
    const aspect = image && image.height ? image.width / image.height : 1;
    const fit = face.fit ?? "cover";
    // The face is square, so fitting reduces to the image's own aspect ratio.
    const wide = aspect > 1;
    const scale = wide ? 1 / aspect : aspect;
    const r = fit === "cover"
      ? new THREE.Vector2(wide ? scale : 1, wide ? 1 : scale)
      : new THREE.Vector2(1, 1);
    return { repeat: r, offset: new THREE.Vector2((1 - r.x) / 2, (1 - r.y) / 2) };
  }, [texture, face.fit]);

  const size = (face.fit ?? "cover") === "contain" ? FACE_SIZE * 0.86 : FACE_SIZE;

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[FACE_SIZE, FACE_SIZE]} />
        <meshBasicMaterial color="#05070c" />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={texture}
          map-repeat={repeat}
          map-offset={offset}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
