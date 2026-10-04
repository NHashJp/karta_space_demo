"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  HUB_SATELLITE,
  cometAt,
  hubPlanetScreen,
  hubPose,
  hubProject,
  hubSunAngle,
  hubUnproject,
  satelliteHull,
} from "./framing";
import { MAST_AT, MAST_HEIGHT } from "@/lib/satelliteGeometry";
import { SAT_SCALE, displayDirection } from "@/lib/deployment";

/**
 * Still connected (rev 7.1 §9).
 *
 * Faint arcs leaving the satellite's mast, alternating between the lights on
 * あなたの星 and the comet. They carry no information and nothing depends on
 * them; what they do is answer the question the orbit view silently raises.
 * A letter that has become a satellite, parked in the dark above a planet it
 * left, reads as cut off. Two pulses a cycle say it is not: the line home is
 * open, and so is the line to the thing that is coming back.
 *
 * They are **arcs of a circle centred on the mast**, swelling outward — the
 * shape a radio wave is always drawn with, and the only shape that reads as
 * *emitting* rather than as *connecting*. An earlier version drew a bowed
 * line from the mast to the target instead: a line between two things says
 * they are tied together, which is a diagram, and it never read as a signal
 * leaving. Each arc spans ±0.22 rad about the bearing to its target, so the
 * wave is aimed without a line ever being drawn.
 *
 * Once a reply is sent, or the receiver's words are aboard, every other pulse
 * towards the comet turns warm — a warm *mark*, in the sense principle 11
 * still means: that one belongs to the receiver.
 */

export const PULSE_PERIOD_S = 4.8;

/** How many segments each arc is drawn with. */
const SEGMENTS = 26;
/** Half the angular width of an arc, in radians (§9). */
const SPREAD = 0.22;
/** The second arc of a pulse trails the first by this much of the cycle. */
const LAG = 0.06;
/** It reaches 90% of the way over the first 75% of its half-period (§9). */
const REACH = 0.9;
const TRAVEL = 0.75;
/** Two arcs, each a line strip of SEGMENTS segments. */
const VERTS = 2 * SEGMENTS * 2;

const COOL = "#bdf0ff";
const WARM = "#f3d7a4";

type Props = {
  /** Where the comet is today, if this card has one. */
  cometProgress?: number;
  /** A reply is up, or words are aboard: every other comet pulse is warm. */
  warm: boolean;
  reducedMotion: boolean;
};

export function SignalPulses({ cometProgress, warm, reducedMotion }: Props) {
  const size = useThree((state) => state.size);

  const line = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array(VERTS * 3), 3);
    position.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", position);
    // Per vertex, because the two arcs of one pulse are at different points
    // in their own swell and a single material opacity cannot say that.
    const alpha = new THREE.BufferAttribute(new Float32Array(VERTS), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("alpha", alpha);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(COOL) } },
        vertexShader: /* glsl */ `
          attribute float alpha;
          varying float vAlpha;
          void main() {
            vAlpha = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            if (vAlpha < 0.004) discard;
            gl_FragColor = vec4(uColor, vAlpha);
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  /**
   * Where a pulse starts, and the two places it is aimed at.
   *
   * The mast is on the satellite's body, so its world position is the body's
   * own display rotation applied to `MAST_AT` — the same transform the cube
   * uses, rather than a second guess at where the mast ended up.
   */
  const places = useMemo(() => {
    const top: [number, number, number] = [MAST_AT[0], MAST_AT[1] + MAST_HEIGHT, MAST_AT[2]];
    const [mx, my, mz] = displayDirection(top);
    const mast = hubProject(
      [
        HUB_SATELLITE[0] + mx * SAT_SCALE,
        HUB_SATELLITE[1] + my * SAT_SCALE,
        HUB_SATELLITE[2] + mz * SAT_SCALE,
      ],
      size.width,
      size.height,
    );

    /*
     * Home is the city lights near the sunrise, not the planet's centre —
     * the centre is off screen and far behind, and a wave aimed at it would
     * be aimed off the bottom of the frame rather than at anything a reader
     * can see.
     */
    const disc = hubPlanetScreen(size.width, size.height);
    const angle = hubSunAngle(size.width, size.height) - 0.25;
    const home: [number, number] = [
      disc.cx + Math.cos(angle) * disc.r * 0.9,
      disc.cy + Math.sin(angle) * disc.r * 0.9,
    ];

    const comet =
      cometProgress === undefined
        ? null
        : (() => {
            const at = cometAt(cometProgress, size.width, size.height);
            const p = hubProject(at, size.width, size.height);
            return [p.x, p.y] as [number, number];
          })();

    return { mast: [mast.x, mast.y] as [number, number], home, comet };
  }, [size.width, size.height, cometProgress]);

  /**
   * The depth the arcs are drawn at: just in front of the satellite, so they
   * read as leaving it rather than as being behind it, and still inside the
   * scene rather than painted over the top of it.
   */
  const depth = useMemo(() => {
    const camera = hubPose(size.width, size.height).position;
    const reach = Math.max(...satelliteHull().map(([, , z]) => z));
    return Math.max(1.2, camera[2] - reach - 0.4);
  }, [size.width, size.height]);

  useFrame(({ clock }) => {
    const mesh = line.current;
    if (!mesh) return;

    // Off entirely with reduced motion (§9): a pulse *is* the motion.
    if (reducedMotion) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    const t = clock.elapsedTime;
    // Two targets, half a period apart, so one is always on its way.
    const half = Math.floor((t / PULSE_PERIOD_S) * 2);
    const toComet = half % 2 === 1;
    const target = toComet ? places.comet : places.home;
    if (!target) {
      mesh.visible = false;
      return;
    }

    const u = ((t / PULSE_PERIOD_S) * 2) % 1;
    if (u > TRAVEL) {
      mesh.visible = false;
      return;
    }

    // Every other comet pulse carries the receiver's words (§9, principle 11).
    material.uniforms.uColor.value.set(toComet && warm && half % 4 === 1 ? WARM : COOL);

    writeArcs(geometry, places.mast, target, u, depth, size.width, size.height);
  });

  return (
    <lineSegments
      ref={line}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={8}
      raycast={() => null}
    />
  );
}

/**
 * Two expanding arcs centred on `mast`, aimed at `target`, at phase `u`.
 *
 * Everything is worked out in screen pixels and then unprojected onto the
 * camera's rays at one depth — the same way the rest of revision 7.1 is
 * composed. A circle in the world would be an ellipse on screen and would
 * stop reading as a wavefront the moment the camera was anywhere but
 * face-on to it.
 */
function writeArcs(
  geometry: THREE.BufferGeometry,
  mast: [number, number],
  target: [number, number],
  u: number,
  depth: number,
  width: number,
  height: number,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const alpha = geometry.getAttribute("alpha") as THREE.BufferAttribute;

  const bearing = Math.atan2(target[1] - mast[1], target[0] - mast[0]);
  const distance = Math.hypot(target[0] - mast[0], target[1] - mast[1]);

  let i = 0;
  for (const lag of [0, LAG]) {
    const local = Math.max(0, (u - lag) / TRAVEL);
    const radius = Math.max(1, local * distance * REACH);
    // Swells and fades over its own travel, so a wavefront arrives rather
    // than stopping: §9's 0.32 · sin(πp).
    const a = local <= 0 ? 0 : 0.32 * Math.sin(Math.PI * local);

    for (let s = 0; s < SEGMENTS; s++) {
      for (const end of [s, s + 1]) {
        const angle = bearing - SPREAD + (2 * SPREAD * end) / SEGMENTS;
        const [x, y, z] = hubUnproject(
          mast[0] + Math.cos(angle) * radius,
          mast[1] + Math.sin(angle) * radius,
          depth,
          width,
          height,
        );
        alpha.setX(i, a);
        position.setXYZ(i++, x, y, z);
      }
    }
  }

  position.needsUpdate = true;
  alpha.needsUpdate = true;
}
