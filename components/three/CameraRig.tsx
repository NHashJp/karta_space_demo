"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  INSIDE_DISTANCE,
  memoryViewDistance,
  ZOOM_DISTANCE,
  ZOOM_IN_MS,
  ZOOM_INSIDE_MS,
  ZOOM_OUT_MS,
  ZOOM_REDUCED_MS,
  cameraDistance,
  orbitPose,
  type Pose,
} from "./framing";
import { easeInOutQuint } from "./rotationPresets";
import { DRIFT_MS, REWIND_MS, RESURFACE_MS } from "@/lib/timing";
import { cameraBreath } from "@/lib/sceneLight";
import { memoryU, trailPoint, trailTangent, type Point3 } from "@/lib/trailCurve";
import { useStagedTrail } from "./useStagedTrail";
import type { CameraPhase } from "@/lib/experienceState";

type Props = {
  /** far on the landing and closing screens, near while reading, inside the cube. */
  phase: CameraPhase;
  /**
   * Which stop along the trail the camera is heading for. The phase alone is
   * not enough there: moving from one memory to the next never leaves "trail",
   * so without this the rig would think it had already arrived and the second
   * memory would never announce itself.
   */
  leg?: number;
  memoryCount?: number;
  /** This card's seed: its trail bends its own way, and it breathes its own way. */
  seed?: number;
  /**
   * Breathe while at rest. Never true where text is being read: a paragraph
   * that drifts under your eyes is worse than a still scene (§23.2).
   */
  breathing?: boolean;
  reducedMotion: boolean;
  onArrive: () => void;
};

/**
 * Sole owner of where the camera is.
 *
 * In v0.1 that was one number — a distance along +z — because everything the
 * camera ever looked at was the cube at the origin. v0.2 has an orbit to frame
 * and a trail to travel down, so the rig now moves between **poses**: a
 * position and a point to look at. The old phases are simply poses on the z
 * axis looking at the origin, and behave exactly as they did.
 *
 * Every phase still ends by announcing its arrival rather than on a timer, so
 * the state and the camera cannot drift apart at any frame rate.
 */
export function CameraRig({
  phase,
  leg = 0,
  memoryCount = 0,
  seed = 0,
  breathing = false,
  reducedMotion,
  onArrive,
}: Props) {
  const { camera, size } = useThree();

  // The same staged curve the ribbon draws — asked for rather than passed in,
  // so the road the camera drives and the road it can see are one road.
  const trail = useStagedTrail(seed);

  const reading = cameraDistance(size.width, size.height);
  const waiting = reading + ZOOM_DISTANCE;

  const target = useMemo<Pose>(() => {
    switch (phase) {
      case "inside":
        return { position: [0, 0, INSIDE_DISTANCE], lookAt: [0, 0, 0] };
      case "near":
        return { position: [0, 0, reading], lookAt: [0, 0, 0] };
      case "orbit":
        return orbitPose(size.width, size.height);
      case "trail":
        return memoryPose(trail, leg, memoryCount, memoryViewDistance(size.width, size.height));
      default:
        return { position: [0, 0, waiting], lookAt: [0, 0, 0] };
    }
  }, [phase, reading, waiting, size.width, size.height, trail, leg, memoryCount]);

  // One identity for "where the camera should be", so a move along the trail
  // counts as a move even though the phase has not changed.
  const pose = `${phase}:${phase === "trail" ? leg : 0}`;

  const from = useRef<Pose>(target);
  const to = useRef<Pose>(target);
  /**
   * How this move is travelled.
   *
   * `pose` is a straight interpolation between two poses — right for a dolly,
   * where there is no path to follow. The other two follow the **curve**: the
   * trail is a road, and moving along it in a straight line through space
   * would cut the corners the reader just watched the camera take.
   */
  const mode = useRef<"pose" | "along" | "retrace">("pose");
  const fromU = useRef(0);
  const toU = useRef(0);
  const startedAt = useRef(0);
  const duration = useRef(0);
  const running = useRef(false);
  const mounted = useRef(false);
  const banking = useRef(false);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  const previousPose = useRef(pose);

  useEffect(() => {
    // First paint: sit at the target rather than drifting toward it.
    if (!mounted.current) {
      mounted.current = true;
      previousPose.current = pose;
      to.current = target;
      apply(camera, target, 0);
      return;
    }

    // A resize only re-frames — retarget without animating.
    if (previousPose.current === pose) {
      to.current = target;
      if (!running.current) apply(camera, target, 0);
      return;
    }

    const leavingTrail = previousPose.current.startsWith("trail:");
    const enteringTrail = phase === "trail";
    const previousLeg = Number(previousPose.current.split(":")[1] ?? 0);
    previousPose.current = pose;

    from.current = currentPose(camera);
    to.current = target;
    startedAt.current = performance.now();

    // Where along the curve this move starts and ends, when it follows one.
    fromU.current = memoryU(previousLeg, Math.max(memoryCount, 1));
    toU.current = memoryU(leg, Math.max(memoryCount, 1));
    mode.current =
      enteringTrail && leavingTrail
        ? "along"
        : leavingTrail && phase === "orbit"
          ? "retrace"
          : "pose";
    // A bank only on the leg between two memories: it is the one move that
    // travels *along* something, and banking into a dolly reads as a stumble.
    banking.current = enteringTrail && leavingTrail;
    duration.current = reducedMotion
      ? ZOOM_REDUCED_MS
      : phase === "inside"
        ? ZOOM_INSIDE_MS
        : phase === "near"
          ? ZOOM_IN_MS
          : enteringTrail
            ? leavingTrail
              ? DRIFT_MS
              : REWIND_MS
            : mode.current === "retrace"
              ? // Coming back is the same road, rewound: it costs time per
                // memory travelled, but each one passes far faster than it did
                // on the way out. Five memories back takes about as long as
                // one and a half drifts forward.
                RESURFACE_MS + previousLeg * RETRACE_PER_MEMORY_MS
              : leavingTrail
                ? RESURFACE_MS
                : ZOOM_OUT_MS;
    running.current = true;
  }, [camera, phase, pose, target, reducedMotion]);

  useFrame(({ clock }) => {
    if (running.current) {
      const raw = Math.min((performance.now() - startedAt.current) / duration.current, 1);
      const t = easeInOutQuint(raw);
      apply(camera, poseAt(raw, t), bank(banking.current, raw));

      if (raw >= 1) {
        // Land exactly on the pose, square-on, with the bank returned to zero:
        // the same guarantee the cube's rotation gives when it lands on a face.
        apply(camera, to.current, 0);
        running.current = false;
        banking.current = false;
        arrive.current();
      }
      return;
    }

    // At rest, the scene breathes. Under a percent of the distance over 26
    // seconds: never noticed on its own, and the difference between a place
    // and a photograph of one.
    if (!breathing) return;
    const breath = cameraBreath(clock.elapsedTime, seed, { reducedMotion });
    apply(camera, scalePose(to.current, breath.distance), breath.roll);
  });

  return null;

  /** Where the camera is at `raw` (un-eased) / `t` (eased) through this move. */
  function poseAt(raw: number, t: number): Pose {
    const distance = memoryViewDistance(size.width, size.height);

    // Along the trail: interpolate the curve parameter, not the two endpoints.
    if (mode.current === "along") {
      return poseOnTrail(trail, fromU.current + (toU.current - fromU.current) * t, distance);
    }

    /*
     * Leaving it: retrace the way back. The camera walks the curve down to its
     * near end — the same road, in reverse — and only then pulls out to the
     * orbit pose. Cutting straight across would throw away the one thing the
     * reader has just learned about the shape of this card's trail.
     */
    if (mode.current === "retrace") {
      if (raw < RETRACE_SHARE) {
        const local = easeInOutQuint(raw / RETRACE_SHARE);
        return poseOnTrail(trail, fromU.current * (1 - local), distance);
      }
      const local = easeInOutQuint((raw - RETRACE_SHARE) / (1 - RETRACE_SHARE));
      return lerpPose(poseOnTrail(trail, 0, distance), to.current, local);
    }

    return lerpPose(from.current, to.current, t);
  }
}

/** How much of a retrace is spent on the trail before pulling out. */
const RETRACE_SHARE = 0.72;
/** Each memory rewound costs this much — far less than the drift out did. */
const RETRACE_PER_MEMORY_MS = 320;

/** Peak bank angle along a drift, in radians. Under the 4° the spec allows. */
const BANK = (3.4 * Math.PI) / 180;

/** Rises and falls over the leg, and is exactly zero at both ends. */
function bank(banking: boolean, t: number): number {
  return banking ? BANK * Math.sin(Math.PI * t) : 0;
}

function apply(camera: THREE.Camera, pose: Pose, roll: number) {
  camera.position.set(...pose.position);
  camera.lookAt(...pose.lookAt);
  if (roll !== 0) camera.rotateZ(roll);
}

function currentPose(camera: THREE.Camera): Pose {
  // Where the camera is, and a point one unit along its own line of sight —
  // so an interrupted move continues from exactly where it had got to rather
  // than snapping back to the pose it was heading for.
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const look = camera.position.clone().add(forward);
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    lookAt: [look.x, look.y, look.z],
  };
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    position: mix(a.position, b.position, t),
    lookAt: mix(a.lookAt, b.lookAt, t),
  };
}

function mix(a: Point3, b: Point3, t: number): Point3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Pushes a pose towards or away from what it is looking at. */
function scalePose(pose: Pose, factor: number): Pose {
  const [x, y, z] = pose.position;
  const [lx, ly, lz] = pose.lookAt;
  return {
    position: [lx + (x - lx) * factor, ly + (y - ly) * factor, lz + (z - lz) * factor],
    lookAt: pose.lookAt,
  };
}

/**
 * Where the camera stands to read memory `index`: back along the curve's own
 * direction by `MEMORY_VIEW_DISTANCE`, looking straight at it. Backing off
 * along the tangent rather than along +z is what makes the trail feel like a
 * path being travelled instead of a line being looked at from outside.
 */
function memoryPose(points: Point3[], index: number, count: number, distance: number): Pose {
  return poseOnTrail(points, memoryU(index, Math.max(count, 1)), distance);
}

/**
 * The camera's pose at any point `u` along the curve — backed off along the
 * curve's own tangent, looking at it. Every trail move is a walk through this
 * function, which is why the path it takes is always the trail's own shape.
 */
function poseOnTrail(points: Point3[], u: number, distance: number): Pose {
  const at = trailPoint(points, u);
  const tangent = trailTangent(points, u);
  return {
    position: [
      at[0] - tangent[0] * distance,
      at[1] - tangent[1] * distance,
      at[2] - tangent[2] * distance,
    ],
    lookAt: at,
  };
}
