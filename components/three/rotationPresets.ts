import * as THREE from "three";

const HALF_PI = Math.PI / 2;
const TAU = Math.PI * 2;

/**
 * Canonical orientation per face: the rotation that turns that face
 * square-on to the camera with its text upright.
 * 1 Front / 2 Right / 3 Back / 4 Left / 5 Top / 6 Bottom.
 */
export const FACE_ORIENTATIONS: THREE.Quaternion[] = [
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -HALF_PI),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), HALF_PI),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), HALF_PI),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -HALF_PI),
];

/**
 * A decorative offset layered on top of the shortest path between two faces.
 * `spin*` are whole turns (a multiple of 2π is the identity rotation, so the
 * cube still lands exactly on target). `tilt*` swell to their peak mid-flight
 * and return to zero, so they also vanish on landing.
 */
export type RotationPreset = {
  name: string;
  spinX: number;
  spinY: number;
  spinZ: number;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  duration: number;
};

export const ROTATION_PRESETS: RotationPreset[] = [
  { name: "clockwise-sweep",   spinX: 0,    spinY: TAU,  spinZ: 0, tiltX: 0.22, tiltY: 0,    tiltZ: 0,    duration: 1100 },
  { name: "counter-sweep",     spinX: 0,    spinY: -TAU, spinZ: 0, tiltX: -0.2, tiltY: 0,    tiltZ: 0,    duration: 1100 },
  { name: "vertical-roll",     spinX: TAU,  spinY: 0,    spinZ: 0, tiltX: 0,    tiltY: 0.26, tiltZ: 0,    duration: 1050 },
  { name: "diagonal-drift",    spinX: 0,    spinY: 0,    spinZ: 0, tiltX: 0.3,  tiltY: 0.3,  tiltZ: 0.12, duration: 820 },
  { name: "banked-turn",       spinX: 0,    spinY: TAU,  spinZ: 0, tiltX: 0.1,  tiltY: 0,    tiltZ: 0.28, duration: 1200 },
  { name: "short-arc",         spinX: 0,    spinY: 0,    spinZ: 0, tiltX: 0.16, tiltY: -0.2, tiltZ: 0,    duration: 700 },
];

/** Minimal, quick, no decorative spin — for prefers-reduced-motion. */
export const REDUCED_MOTION_PRESET: RotationPreset = {
  name: "reduced",
  spinX: 0, spinY: 0, spinZ: 0,
  tiltX: 0, tiltY: 0, tiltZ: 0,
  duration: 320,
};

export function pickPreset(previous?: string): RotationPreset {
  const pool = previous
    ? ROTATION_PRESETS.filter((preset) => preset.name !== previous)
    : ROTATION_PRESETS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Smooth in/out — quint out keeps the landing soft. */
export function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

/** 0 → 1 → 0, so decorative tilt is absent at both ends of the transition. */
function swell(t: number): number {
  return Math.sin(Math.PI * t);
}

const decorEuler = new THREE.Euler();
const decorQuat = new THREE.Quaternion();

/**
 * Orientation at progress `t` (0..1): the shortest rotation from `from` to
 * `to`, with the preset's decorative motion layered on. At t = 1 the
 * decoration is exactly the identity, so the cube snaps square-on.
 */
export function orientationAt(
  from: THREE.Quaternion,
  to: THREE.Quaternion,
  preset: RotationPreset,
  t: number,
  target: THREE.Quaternion,
): THREE.Quaternion {
  const eased = easeInOutQuint(t);
  target.copy(from).slerp(to, eased);

  const s = swell(t);
  decorEuler.set(
    preset.spinX * eased + preset.tiltX * s,
    preset.spinY * eased + preset.tiltY * s,
    preset.spinZ * eased + preset.tiltZ * s,
  );
  decorQuat.setFromEuler(decorEuler);
  return target.multiply(decorQuat);
}
