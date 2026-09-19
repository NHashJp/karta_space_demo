import * as THREE from "three";
import {
  FACE_ORIENTATIONS,
  ROTATION_PRESETS,
  REDUCED_MOTION_PRESET,
  orientationAt,
} from "../components/three/rotationPresets.ts";

const HALF_PI = Math.PI / 2;
const PLACEMENT: [number, number, number][] = [
  [0, 0, 0], [0, HALF_PI, 0], [0, Math.PI, 0], [0, -HALF_PI, 0],
  [-HALF_PI, 0, 0], [HALF_PI, 0, 0],
];

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) { failures++; console.log(`  FAIL ${label} ${detail}`); }
};

console.log("1. Each face lands square-on to the camera, text upright:");
for (let i = 0; i < 6; i++) {
  const cube = FACE_ORIENTATIONS[i];
  const faceLocal = new THREE.Quaternion().setFromEuler(new THREE.Euler(...PLACEMENT[i]));
  const world = cube.clone().multiply(faceLocal);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(world);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(world);
  const facing = normal.dot(new THREE.Vector3(0, 0, 1));
  const upright = up.dot(new THREE.Vector3(0, 1, 0));
  console.log(`  face ${i + 1}: normal·camera=${facing.toFixed(6)} up·worldUp=${upright.toFixed(6)}`);
  check(`face ${i + 1} faces camera`, Math.abs(facing - 1) < 1e-9);
  check(`face ${i + 1} upright`, Math.abs(upright - 1) < 1e-9);
}

console.log("2. Every preset lands exactly on the target orientation:");
const out = new THREE.Quaternion();
let worstLanding = 0, worstStart = 0;
for (const preset of [...ROTATION_PRESETS, REDUCED_MOTION_PRESET]) {
  for (let from = 0; from < 6; from++) {
    for (let to = 0; to < 6; to++) {
      if (from === to) continue;
      const a = FACE_ORIENTATIONS[from], b = FACE_ORIENTATIONS[to];
      orientationAt(a, b, preset, 1, out);
      worstLanding = Math.max(worstLanding, out.angleTo(b));
      orientationAt(a, b, preset, 0, out);
      worstStart = Math.max(worstStart, out.angleTo(a));
    }
  }
}
console.log(`  worst landing error: ${(worstLanding * 180 / Math.PI).toExponential(2)}°`);
console.log(`  worst start error:   ${(worstStart * 180 / Math.PI).toExponential(2)}°`);
check("landing exact", worstLanding < 1e-6);
check("start exact", worstStart < 1e-6);

console.log("3. Decorative rotation stays within the spec's 360-540 budget:");
for (const preset of ROTATION_PRESETS) {
  let worst = 0;
  let worstPair = "";
  for (let from = 0; from < 6; from++) {
    for (let to = 0; to < 6; to++) {
      if (from === to) continue;
      const a = FACE_ORIENTATIONS[from];
      const b = FACE_ORIENTATIONS[to];
      // Path actually travelled, minus the rotation the face change itself needs.
      let travelled = 0;
      const prev = new THREE.Quaternion();
      orientationAt(a, b, preset, 0, prev);
      for (let s = 1; s <= 600; s++) {
        orientationAt(a, b, preset, s / 600, out);
        travelled += prev.angleTo(out);
        prev.copy(out);
      }
      const decorative = (travelled - a.angleTo(b)) * 180 / Math.PI;
      if (decorative > worst) { worst = decorative; worstPair = `${from + 1}->${to + 1}`; }
    }
  }
  console.log(`  ${preset.name.padEnd(18)} ${worst.toFixed(0)}\u00b0 decorative (worst: ${worstPair}), ${preset.duration}ms`);
  check(`${preset.name} within budget`, worst <= 540, `${worst.toFixed(0)}\u00b0`);
  check(`${preset.name} duration 700-1200ms`, preset.duration >= 700 && preset.duration <= 1200);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
