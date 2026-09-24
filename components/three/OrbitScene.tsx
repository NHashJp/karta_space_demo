"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Planet } from "./Planet";
import { FOV, HUB_SATELLITE, hubPlanet, hubPose } from "./framing";
import { deploymentAt, SAT_SCALE } from "@/lib/deployment";
import { stationKeeping } from "@/lib/sceneLight";

export { SAT_SCALE } from "@/lib/deployment";

type Props = {
  seed: number;
  returned: boolean;
  reducedMotion: boolean;
  /**
   * 0 while docked, 1 once fully in orbit. A ref, written by `MessageCube`
   * every frame: it owns the deployment, and this is how the rest of the scene
   * follows along without a React render per frame.
   */
  presence: React.RefObject<number>;
};

/**
 * What exists in the orbit view but not before it: the planet the letter now
 * circles, and the line it circles on (spec v0.2 §8.3).
 *
 * Mounted only when the card is deployed, so a v0.1 card never pays for a
 * planet it does not have, and the shader compile happens on the way out of
 * the closing screen rather than on first load.
 */
export function OrbitScene({ seed, returned, reducedMotion, presence }: Props) {
  const planet = useRef<THREE.Group>(null);
  const size = useThree((state) => state.size);

  /*
   * The planet's hub placement (rev 6 §3.1). It is staged per aspect rather
   * than fixed in the world — see `hubPlanet` for why — so it moves when the
   * viewport changes, and is set here rather than baked into the mesh.
   */
  const at = useMemo(() => hubPlanet(size.width, size.height), [size.width, size.height]);

  useFrame(() => {
    planet.current?.position.set(...at);
  });

  return (
    <group>
      <group ref={planet}>
        <Planet seed={seed} returned={returned} reducedMotion={reducedMotion} />
      </group>
      {/* No orbit ring in the hub (R20): the orbit is felt, not drawn. */}
    </group>
  );
}

/**
 * Holds the satellite in its place in the hub (rev 6 §3.2).
 *
 * Revision 5 flew it round a visible ellipse once every 48 seconds. Revision 6
 * does not: the camera moves with it, so what is left on screen is the small
 * drift of a thing keeping station, while the sky turns behind it. A satellite
 * sliding across the frame reads as a diagram of an orbit; one holding still
 * while the stars move reads as the place you are.
 *
 * The orbit is still real, and the chart still draws it.
 */
export function SatelliteCarrier({
  presence,
  reducedMotion,
  returned = false,
  seed = 0,
  children,
}: {
  presence: React.RefObject<number>;
  reducedMotion: boolean;
  returned?: boolean;
  seed?: number;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.PointLight>(null);
  const size = useThree((state) => state.size);

  useFrame(({ clock }) => {
    const carrier = group.current;
    if (!carrier) return;

    if (halo.current) {
      // Steady, with a four-second breath under it. Not a blink: the satellite
      // is not signalling, it is simply warm today (§8.10).
      const pulse = reducedMotion
        ? 1
        : 0.82 + 0.18 * Math.sin((clock.elapsedTime / 4) * Math.PI * 2);
      halo.current.intensity = returned ? 2.6 * pulse * presence.current : 0;
    }

    // Only the last part of the deployment moves the cube — it turns and
    // unfolds where it is, then leaves (§8.2, the RISE window).
    const rise = deploymentAt(presence.current).rise;
    const station = stationKeeping(clock.elapsedTime, seed, { reducedMotion });

    // The drift is a fraction of the viewport, so it is converted through the
    // frame's own width at this distance rather than being a raw world offset.
    const pose = hubPose(size.width, size.height);
    const span = Math.abs(pose.position[2] - HUB_SATELLITE[2]);
    const scale = span * 2 * Math.tan((FOV * Math.PI) / 360);

    carrier.position.set(
      HUB_SATELLITE[0] * rise + station.offsetX * scale * rise,
      HUB_SATELLITE[1] * rise + station.offsetY * scale * rise,
      HUB_SATELLITE[2] * rise,
    );
    carrier.rotation.z = station.roll * rise;
    carrier.scale.setScalar(1 + (SAT_SCALE - 1) * rise);
  });

  return (
    <group ref={group}>
      <pointLight ref={halo} intensity={0} distance={7} color="#ffd8a0" />
      {children}
    </group>
  );
}
