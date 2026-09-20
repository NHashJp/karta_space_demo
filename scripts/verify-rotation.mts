import { existsSync } from "node:fs";
import * as THREE from "three";
import { FOV, cameraDistance, measureFace, textPanelPx } from "../components/three/framing.ts";
import { cards } from "../config/cards.config.ts";
import {
  acceptsInput,
  initialExperience,
  isZoomedIn,
  reduceExperience,
  revealsText,
  type Experience,
  type ExperienceEvent,
} from "../lib/experienceState.ts";
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

console.log("4. Camera framing and on-screen text size:");
{
  const viewports: [string, number, number][] = [
    ["desktop 1512x945", 1512, 945],
    ["desktop 1500x1400", 1500, 1400],
    ["laptop 1280x800", 1280, 800],
    ["iPhone 390x844", 390, 844],
    ["iPad 834x1112", 834, 1112],
  ];
  const halfV = ((FOV * Math.PI) / 180) / 2;

  for (const [label, w, h] of viewports) {
    const aspect = w / h;
    const z = cameraDistance(w, h);
    const halfH = Math.atan(Math.tan(halfV) * aspect);

    // Visible extent at the front face plane (z = +1).
    const toFace = z - 1;
    const visibleH = 2 * Math.tan(halfV) * toFace;
    const visibleW = 2 * Math.tan(halfH) * toFace;
    const fillH = 2 / visibleH;
    const fillW = 2 / visibleW;

    // Panel authored at textPanelPx, rendered at its on-screen width.
    const renderedPx = (1.84 / visibleH) * h;
    const panelPx = textPanelPx(w, h);
    const cssToScreen = renderedPx / panelPx;
    const longest = Math.max(
      ...cards.flatMap((card) =>
        card.faces.filter((f) => f.type === "text").map((f) => f.body.length),
      ),
    );
    const worst = measureFace(panelPx, longest);
    const fontPx = worst.fontPx * cssToScreen;

    // The cube must not clip while it spins (swept half-extent 1.5).
    const clearH = Math.sin(halfV) * z;
    const clearW = Math.sin(halfH) * z;

    console.log(
      `  ${label.padEnd(18)} z=${z.toFixed(2)} face=${(fillH * 100).toFixed(0)}%H/${(fillW * 100).toFixed(0)}%W ` +
      `text=${fontPx.toFixed(1)}px ${worst.charsPerLine}ch x ${worst.lines}L clearance=${Math.min(clearH, clearW).toFixed(2)}`,
    );

    check(`${label} text legible`, fontPx >= 14, `${fontPx.toFixed(1)}px`);
    check(`${label} lines not cramped`, worst.charsPerLine >= 12, `${worst.charsPerLine} chars`);
    check(`${label} longest message fits the face`, !worst.overflows, `${worst.lines} lines`);
    check(`${label} cube not clipped`, Math.min(clearH, clearW) >= 1.5 - 1e-6);
    if (aspect >= 1) {
      check(`${label} face fills 45-65% height`, fillH >= 0.45 && fillH <= 0.65, `${(fillH * 100).toFixed(0)}%`);
    } else {
      check(`${label} face fills 65-80% width`, fillW >= 0.65 && fillW <= 0.8, `${(fillW * 100).toFixed(0)}%`);
    }
  }
}

console.log(`5. Configured content fits the spec's limits (${cards.length} card(s)):`);
{
  const phone = textPanelPx(390, 844);
  const slugs = new Set<string>();

  for (const card of cards) {
    console.log(`  ${card.slug} - "${card.title}"`);
    const id = (suffix: string) => `${card.slug} ${suffix}`;

    check(id("slug is url-safe"), /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/.test(card.slug), card.slug);
    check(id("slug is unique"), !slugs.has(card.slug), card.slug);
    slugs.add(card.slug);
    check(id("has exactly six faces"), card.faces.length === 6, `${card.faces.length}`);
    check(id("has a closing message"), card.closing.trim().length > 0);

    for (const [i, face] of card.faces.entries()) {
      if (face.type !== "text") {
        const file = `public${face.src}`;
        console.log(`    face ${i + 1}: image  ${face.src}`);
        check(id(`face ${i + 1} has alt text`), face.alt.trim().length > 0);
        check(id(`face ${i + 1} image exists`), existsSync(file), file);
        check(
          id(`face ${i + 1} image lives under this card`),
          face.src.startsWith(`/cards/${card.slug}/`),
          face.src,
        );
        continue;
      }
      const chars = face.body.length;
      const fit = measureFace(phone, chars);
      console.log(
        `    face ${i + 1}: ${String(chars).padStart(3)} chars -> ${fit.lines} lines @ ${fit.fontPx}px on a 390px phone`,
      );
      check(id(`face ${i + 1} within 80-250 chars`), chars >= 80 && chars <= 250, `${chars}`);
      check(id(`face ${i + 1} fits the face`), !fit.overflows, `${fit.lines} lines`);
      check(id(`face ${i + 1} readable on phone`), fit.fontPx >= 14, `${fit.fontPx}px`);
    }

    const active = (card.social ?? []).filter(link => link.href.trim().length > 0);
    const placeholders = active.filter(link => /your-handle/.test(link.href));
    console.log(`    social: ${active.length} link(s) shown on the closing screen`);
    for (const link of active) {
      check(id(`${link.platform} href is absolute`), /^https?:\/\//.test(link.href), link.href);
      check(id(`${link.platform} has a label`), link.label.trim().length > 0);
    }
    if (placeholders.length > 0) {
      console.log(
        `    NOTE: ${placeholders.length} social link(s) still point at "your-handle" ` +
        "- edit config/cards.config.ts",
      );
    }
  }
}

console.log("6. Experience flow (card content never shows on the end screens):");
{
  let exp: Experience = initialExperience;
  const seen: string[] = [];
  const send = (event: ExperienceEvent) => {
    exp = reduceExperience(exp, event);
    seen.push(`${exp.state}:${exp.activeFace + 1}`);
    return exp;
  };

  check("landing hides face text", !revealsText(exp.state));
  check("landing keeps camera back", !isZoomedIn(exp.state));
  check("landing ignores scroll", !acceptsInput(exp.state));

  send({ type: "open" });
  check("opening dollies in", exp.state === "entering" && isZoomedIn(exp.state));
  check("entering still hides text", !revealsText(exp.state));
  check("entering ignores scroll", !acceptsInput(exp.state));

  send({ type: "zoomEnd" });
  check("arrives reading face 1", exp.state === "reading" && exp.activeFace === 0);
  check("reading reveals text", revealsText(exp.state));

  // Forward through all six faces.
  for (let face = 0; face < 5; face++) {
    send({ type: "move", direction: 1 });
    check(`face ${face + 2} rotates`, exp.state === "transitioning" && exp.activeFace === face + 1);
    check(`face ${face + 2} hides text mid-rotation`, !revealsText(exp.state));
    check(`face ${face + 2} locks input`, !acceptsInput(exp.state));
    send({ type: "rotationEnd" });
    check(`face ${face + 2} lands reading`, exp.state === "reading" && exp.activeFace === face + 1);
  }

  // One more forward from the last face closes the card.
  send({ type: "move", direction: 1 });
  check("last face dollies out", exp.state === "leaving" && !isZoomedIn(exp.state));
  check("leaving hides text", !revealsText(exp.state));
  send({ type: "zoomEnd" });
  check("closing screen reached", exp.state === "completed");
  check("closing screen hides text", !revealsText(exp.state));
  check("closing screen keeps camera back", !isZoomedIn(exp.state));

  // Scrolling back up returns to the final face.
  send({ type: "move", direction: -1 });
  check("back up dives in again", exp.state === "returning" && exp.activeFace === 5);
  send({ type: "zoomEnd" });
  check("returns to face 6", exp.state === "reading" && exp.activeFace === 5);

  // Backward navigation all the way to the first face, then past it.
  for (let face = 5; face > 0; face--) {
    send({ type: "move", direction: -1 });
    send({ type: "rotationEnd" });
  }
  check("walks back to face 1", exp.state === "reading" && exp.activeFace === 0);
  send({ type: "move", direction: -1 });
  check("cannot go before face 1", exp.state === "reading" && exp.activeFace === 0);

  // Replay from the closing screen.
  for (let face = 0; face < 5; face++) {
    send({ type: "move", direction: 1 });
    send({ type: "rotationEnd" });
  }
  send({ type: "move", direction: 1 });
  send({ type: "zoomEnd" });
  check("reaches the closing screen again", exp.state === "completed");
  send({ type: "replay" });
  check("replay rewinds to face 1", exp.state === "returning" && exp.activeFace === 0);
  send({ type: "zoomEnd" });
  check("replay lands reading face 1", exp.state === "reading" && exp.activeFace === 0);

  // Input during any animated phase must be ignored.
  for (const phase of ["entering", "returning", "leaving", "transitioning"] as const) {
    const frozen: Experience = { state: phase, activeFace: 2 };
    const after = reduceExperience(frozen, { type: "move", direction: 1 });
    check(`${phase} ignores input`, after === frozen);
    check(`${phase} hides text`, !revealsText(phase));
  }

  console.log(`  walked ${seen.length} transitions, ending at ${exp.state}:${exp.activeFace + 1}`);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
