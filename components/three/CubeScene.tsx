"use client";

import { Suspense, useLayoutEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { CardFace } from "@/types/card";
import { MessageCube } from "./MessageCube";
import { SpaceEnvironment } from "./SpaceEnvironment";

const FOV = 45;
/** World units the cube is allowed to occupy across the viewport's short side. */
const FRAME = 3.15;

/** Keeps the cube comfortably framed from narrow phones to wide desktops. */
function ResponsiveCamera() {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    const halfFov = (FOV * Math.PI) / 180 / 2;
    const vertical = FRAME / 2 / Math.tan(halfFov);
    const horizontal = vertical / Math.min(aspect, 1);
    camera.position.set(0, 0, Math.max(vertical, horizontal));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}

type Props = {
  faces: CardFace[];
  activeFace: number;
  isTransitioning: boolean;
  reducedMotion: boolean;
  onTransitionEnd: () => void;
};

export function CubeScene(props: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: FOV, position: [0, 0, 6], near: 0.1, far: 60 }}
    >
      <ResponsiveCamera />
      <SpaceEnvironment reducedMotion={props.reducedMotion} />
      <Suspense fallback={null}>
        <MessageCube {...props} />
      </Suspense>
    </Canvas>
  );
}
