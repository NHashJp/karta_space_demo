"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Planet } from "./Planet";
import { FOV, HUB_SATELLITE, hubPlanet, hubPose } from "./framing";
import { PROPEL_FLARE, PROPEL_HEADING, PROPEL_NUDGE_PX } from "./CameraRig";
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

  /*
   * The planet is staged *between* the camera and the satellite — it is close
   * and large, which is how it fills the corner of the hub. In the hub the two
   * never overlap on screen, so that costs nothing. But while the cube unfolds
   * and rises (or folds and sinks back) it is still full size and the camera is
   * further out, and on a phone its wings sweep across the planet's disc and
   * would vanish behind it. For that stretch the planet stops writing depth
   * and draws first, so the satellite is always in front of it.
   */
  const behind = useRef<boolean | null>(null);

  useFrame(() => {
    const group = planet.current;
    if (!group) return;
    group.position.set(...at);

    const transit = presence.current < 1;
    if (behind.current === transit) return;
    behind.current = transit;
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.Material;
      object.userData.renderOrder ??= object.renderOrder;
      object.userData.depthWrite ??= material.depthWrite;
      object.renderOrder = transit ? -0.5 : object.userData.renderOrder;
      material.depthWrite = transit ? false : object.userData.depthWrite;
    });
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
  stowed = false,
  seed = 0,
  propel,
  children,
}: {
  presence: React.RefObject<number>;
  reducedMotion: boolean;
  returned?: boolean;
  /**
   * The Propel beat, 0 → 0.35 → 0, written by `CameraRig` (rev 7.1 §11).
   * Shared rather than recomputed so the camera's zoom, the sky's haze and
   * this nudge are one beat and cannot drift a frame apart.
   */
  propel?: React.RefObject<number>;
  /**
   * The satellite is not drawn on the trail (§9.3). The cube fades itself out,
   * but this light is the carrier's, not the cube's — and a point light two
   * units from the lens goes on lighting the first memory from behind long
   * after the thing casting it has gone.
   */
  stowed?: boolean;
  seed?: number;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.PointLight>(null);
  const thruster = useRef<THREE.PointLight>(null);
  const ion = useRef<THREE.PointLight>(null);
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
      halo.current.intensity = returned && !stowed ? 2.6 * pulse * presence.current : 0;
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

    /*
     * The arrival nudge (rev 7.1 §11). Six pixels on a desktop, four on a
     * phone, up and to the right, and back. Revision 7.0 asked for sixteen
     * and ten, and that read as the satellite being shoved; this is small
     * enough to feel like thrust and too small to look like a move.
     *
     * In pixels, so it converts through the frame's own width at this
     * distance the same way the station-keeping drift does.
     */
    const beat = propel ? propel.current / PROPEL_FLARE : 0;
    const nudgePx = size.width < size.height
      ? PROPEL_NUDGE_PX.portrait
      : PROPEL_NUDGE_PX.landscape;
    const heading = Math.hypot(PROPEL_HEADING[0], PROPEL_HEADING[1]);
    const nudge = (beat * nudgePx) / size.width;

    carrier.position.set(
      HUB_SATELLITE[0] * rise +
        (station.offsetX + (nudge * PROPEL_HEADING[0]) / heading) * scale * rise,
      HUB_SATELLITE[1] * rise +
        (station.offsetY - (nudge * PROPEL_HEADING[1]) / heading) * scale * rise,
      HUB_SATELLITE[2] * rise,
    );
    carrier.rotation.z = station.roll * rise;
    carrier.scale.setScalar(1 + (SAT_SCALE - 1) * rise);

    /*
     * The thruster: a warm core and an ion halo, a cube and a half behind
     * the body along the heading. Two lights rather than a sprite, so what
     * the reader sees is the satellite's own panels and edges catching it.
     */
    if (thruster.current && ion.current) {
      const back = 1.5 * SAT_SCALE;
      const bx = (-PROPEL_HEADING[0] / heading) * back;
      const by = (PROPEL_HEADING[1] / heading) * back;
      thruster.current.position.set(bx, by, 0);
      ion.current.position.set(bx, by, 0);
      thruster.current.intensity = beat * 3.4 * rise;
      ion.current.intensity = beat * 1.8 * rise;
    }
  });

  return (
    <group ref={group}>
      <pointLight ref={halo} intensity={0} distance={7} color="#ffd8a0" />
      <pointLight ref={thruster} intensity={0} distance={3.2} color="#ffd2a0" />
      <pointLight ref={ion} intensity={0} distance={4.6} color="#00aeef" />
      {children}
    </group>
  );
}
