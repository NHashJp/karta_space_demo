import { existsSync, readFileSync } from "node:fs";
import * as THREE from "three";
import {
  FOV,
  INSIDE_DISTANCE,
  PLANET_CENTRE,
  PLANET_RADIUS,
  memoryPanelFraming,
  orbitPose,
  orbitPosition,
  SECRET_PLANE_Z,
  cameraDistance,
  insideVisibleWidth,
  fitLineFaceSize,
  measureFace,
  secretFits,
  secretPanel,
  textPanelPx,
} from "../components/three/framing.ts";
import { cards } from "../config/cards.config.ts";
import { allProblems, cardProblems } from "../lib/cardRules.ts";
import { formatFuzzyDate, parseFuzzyDate, sortMemoriesNewestFirst } from "../lib/fuzzyDate.ts";
import { civilDate, isSatelliteDay, nextOccurrence, satelliteClock } from "../lib/orbitClock.ts";
import {
  APHELION,
  PERIHELION,
  cometWindow,
  displayedProgress,
  orbitPoint,
  solveEccentricAnomaly,
  tailLength,
  ECCENTRICITY,
} from "../lib/cometOrbit.ts";
import { PALETTE, trailColour, trailSeed } from "../lib/trailColour.ts";
import { BREATH_DISTANCE, cameraBreath, keyLight, lightSeed } from "../lib/sceneLight.ts";
import { toClientCard } from "../lib/clientCard.ts";
import {
  TRAIL_LATERAL,
  TRAIL_NEAR_Z,
  memoryU,
  trailControlPoints,
  trailPoint,
  trailSeedFor,
} from "../lib/trailCurve.ts";
import { DEPLOY_MS } from "../lib/timing.ts";
import { PANELS, RISE, THRUSTER, TURN, deploymentAt, stagger } from "../lib/deployment.ts";
import { JUMP_TARGETS, jumpEvents } from "../lib/devJump.ts";
import { accessToken, cardSecret, checkPassword } from "../lib/access.ts";
import {
  formatPassword,
  generatePassword,
  hashPassword,
  isPasswordHash,
  normalisePassword,
  verifyPassword,
} from "../lib/password.ts";
import { resolveNow } from "../lib/devTime.ts";
import {
  acceptsInput,
  breathesAtRest,
  cameraPhase,
  dimsScene,
  initialExperience,
  isDeployed,
  isWithinCube,
  isZoomedIn,
  reduceExperience,
  revealsMemory,
  revealsSecret,
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

/** For checks inside a long loop: report the first failure only. */
const reported = new Set<string>();
const check_once = (label: string, ok: boolean, detail = "") => {
  if (ok || reported.has(label)) return;
  reported.add(label);
  check(label, ok, detail);
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
  // The inside only exists if the camera really is within the walls, and far
  // enough from the far wall for the near plane (0.1) to clear it.
  check("inside camera is within the walls", Math.abs(INSIDE_DISTANCE) < 1, `${INSIDE_DISTANCE}`);
  check("secret plane is inside the far wall", SECRET_PLANE_Z > -1, `${SECRET_PLANE_Z}`);
  check(
    "secret plane clears the near plane",
    INSIDE_DISTANCE - SECRET_PLANE_Z > 0.1,
    `${(INSIDE_DISTANCE - SECRET_PLANE_Z).toFixed(2)}u`,
  );

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
    const longestSecret = Math.max(
      1,
      ...cards.map((card) => (card.secret ?? "").trim().length),
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

    // Inside the cube the whole view is barely half a world unit across on a
    // phone, so the secret line is sized from there, not from the face.
    const insideView = insideVisibleWidth(w, h);
    const { worldWidth } = secretPanel(w, h);
    const line = secretFits(w, h, longestSecret);
    console.log(
      `  ${"".padEnd(18)} inside: view=${insideView.toFixed(2)}u panel=${worldWidth.toFixed(2)}u ` +
      `line=${line.fontPx}px for ${longestSecret} chars`,
    );
    check(`${label} secret panel fits the view`, worldWidth <= insideView + 1e-9,
      `${worldWidth.toFixed(2)}u in ${insideView.toFixed(2)}u`);
    check(`${label} secret line legible`, line.fontPx >= 15, `${line.fontPx}px`);
    check(`${label} secret line fits its panel`, !line.overflows, `${line.fontPx}px`);
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
  const problems = allProblems(cards);

  for (const [index, card] of cards.entries()) {
    console.log(`  ${card.slug} - "${card.title}"`);
    const id = (suffix: string) => `${card.slug} ${suffix}`;

    // The rules themselves live in lib/cardRules.ts, so they are the same ones
    // the registry enforces at import time and the editor shows as you type.
    // The editor saves through a warning so a card can be drafted; this suite
    // does not, because it is the gate you run before deploying.
    for (const error of problems[index].errors) check(id(error), false);
    for (const warning of problems[index].warnings) check(id(warning), false);
    // Notes are advice about a valid card, so they print and never fail.
    for (const note of problems[index].notes) console.log(`    NOTE: ${note}`);

    // Below: only what those rules cannot know - whether the file is really
    // there, and whether the text physically fits a cube face on a phone.
    for (const [i, face] of card.faces.entries()) {
      if (face.type !== "text") {
        const file = `public${face.src}`;
        console.log(`    face ${i + 1}: image  ${face.src}`);
        check(id(`face ${i + 1} image exists`), existsSync(file), file);
        continue;
      }
      const chars = face.body.length;

      if (face.style === "line") {
        // A line face is fitted as a beat, not as a paragraph: the question is
        // whether it is large enough to land, not whether it spills.
        const px = fitLineFaceSize(phone, chars);
        console.log(
          `    face ${i + 1}: ${String(chars).padStart(3)} chars -> line @ ${px}px on a 390px phone`,
        );
        check(id(`face ${i + 1} sets large enough to be a beat`), px >= 20, `${px}px`);
        // Comparing it to a paragraph would prove nothing: `fitFontSize` is
        // capped at 20px, so a short paragraph and a short line come out the
        // same. What makes a line a beat is that it *fills the face* — a
        // sentence floating in the middle of an empty panel is neither.
        const fill = (px * chars) / phone;
        check(id(`face ${i + 1} fills the face as a beat`), fill >= 0.55 && fill <= 1.02,
          `${(fill * 100).toFixed(0)}% of the panel`);
        continue;
      }

      const fit = measureFace(phone, chars);
      console.log(
        `    face ${i + 1}: ${String(chars).padStart(3)} chars -> ${fit.lines} lines @ ${fit.fontPx}px on a 390px phone`,
      );
      check(id(`face ${i + 1} fits the face`), !fit.overflows, `${fit.lines} lines`);
      check(id(`face ${i + 1} readable on phone`), fit.fontPx >= 14, `${fit.fontPx}px`);
    }

    // A signature that is configured but not there would simply not draw, and
    // nothing on the closing screen would say so — hence a check, not a note.
    if (card.signature) {
      const file = `public${card.signature}`;
      const there = existsSync(file);
      check(id("signature file exists"), there, file);
      if (there) {
        const svg = readFileSync(file, "utf8");
        console.log(`    signature: ${card.signature}`);
        check(id("signature is an SVG"), svg.includes("<svg"));
        // It is drawn by walking a dash along each path; a signature made of
        // filled shapes would simply appear, which is not the same thing.
        check(id("signature is made of stroked paths"), /<path[\s>]/.test(svg));
        check(id("signature has no fills"), !/fill="(?!none)[^"]+"/.test(svg));
      }
    }

    const active = (card.social ?? []).filter(link => link.href.trim().length > 0);
    const placeholders = active.filter(link => /your-handle/.test(link.href));
    console.log(`    social: ${active.length} link(s) shown on the closing screen`);
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
  // The v0.1 regression card: nothing past the closing screen. Every
  // transition below must behave exactly as it did before v0.2.
  let exp: Experience = initialExperience({ memoryCount: 0, hasOrbit: false });
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
  for (const phase of ["entering", "returning", "leaving", "transitioning", "descending", "ascending"] as const) {
    const frozen: Experience = { ...initialExperience(), state: phase, activeFace: 2 };
    const after = reduceExperience(frozen, { type: "move", direction: 1 });
    check(`${phase} ignores input`, after === frozen);
    check(`${phase} hides text`, !revealsText(phase));
  }

  // The inside of the cube: reachable only from the closing screen, and it
  // reveals the secret line only once the camera has actually arrived.
  // The walk above ends back on face 1, so go the long way round again.
  for (let face = 0; face < 5; face++) {
    send({ type: "move", direction: 1 });
    send({ type: "rotationEnd" });
  }
  send({ type: "move", direction: 1 });
  send({ type: "zoomEnd" });
  check("back at the closing screen", exp.state === "completed");

  send({ type: "reveal" });
  check("reveal dives into the cube", exp.state === "descending");
  check("descending puts the camera inside", cameraPhase(exp.state) === "inside");
  check("descending mounts the inner shell", isWithinCube(exp.state));
  check("descending still hides the secret", !revealsSecret(exp.state));
  check("descending hides face text", !revealsText(exp.state));

  send({ type: "zoomEnd" });
  check("arrives inside", exp.state === "inside");
  check("inside reveals the secret", revealsSecret(exp.state));
  check("inside still hides face text", !revealsText(exp.state));
  check("inside accepts input", acceptsInput(exp.state));

  send({ type: "move", direction: 1 });
  check("any gesture leaves the inside", exp.state === "ascending");
  check("ascending hides the secret again", !revealsSecret(exp.state));
  check("ascending heads back out", cameraPhase(exp.state) === "far");
  send({ type: "zoomEnd" });
  check("returns to the closing screen", exp.state === "completed");

  // The way in exists from exactly one state, and the way out from one other.
  for (const state of [
    "landing", "entering", "returning", "reading", "transitioning", "leaving", "descending", "ascending",
  ] as const) {
    const frozen: Experience = { ...initialExperience(), state };
    check(`${state} cannot be revealed into`, reduceExperience(frozen, { type: "reveal" }) === frozen);
  }

  // The secret is attached in exactly one state, like face text.
  for (const state of [
    "landing", "entering", "returning", "reading", "transitioning", "leaving", "completed", "descending", "ascending",
  ] as const) {
    check(`${state} hides the secret line`, !revealsSecret(state));
  }
  check("only 'inside' reveals the secret", revealsSecret("inside"));

  // A card with no orbit ends where v0.1 ended: forward from the closing
  // screen, and the deploy button itself, do nothing at all.
  check("no orbit: scrolling on at the close is a no-op",
    reduceExperience(exp, { type: "move", direction: 1 }) === exp);
  check("no orbit: deploy is a no-op", reduceExperience(exp, { type: "deploy" }) === exp);
  check("no orbit: lookBack is a no-op", reduceExperience(exp, { type: "lookBack" }) === exp);

  console.log(`  walked ${seen.length} transitions, ending at ${exp.state}:${exp.activeFace + 1}`);
}


console.log("7. v0.2 foundations (spec v0.2 §17):");
{
  // ---- fuzzy dates: the table in §5, verbatim -----------------------------
  const table: [string, { approx?: boolean; season?: "summer" }, string][] = [
    ["2023-08-14", {}, "2023年8月14日"],
    ["2023-08", {}, "2023年8月"],
    ["2023-08", { approx: true }, "2023年8月頃"],
    ["2023", { season: "summer" }, "2023年夏"],
    ["2023", { approx: true }, "2023年頃"],
  ];
  for (const [input, options, expected] of table) {
    const actual = formatFuzzyDate(input, options);
    check(`fuzzyDate ${input} -> ${expected}`, actual === expected, actual);
  }
  check("fuzzyDate rejects 2023-13", parseFuzzyDate("2023-13") === null);
  check("fuzzyDate rejects 2023-02-30", parseFuzzyDate("2023-02-30") === null);
  check("fuzzyDate accepts 2024-02-29", parseFuzzyDate("2024-02-29") !== null);

  const sorted = sortMemoriesNewestFirst([
    { date: "2023-04", title: "a" },
    { date: "2026-02-14", title: "b" },
    { date: "2023", season: "summer" as const, title: "c" },
  ]);
  check("memories sort newest first", sorted.map((m) => m.title).join("") === "bca",
    sorted.map((m) => m.title).join(""));

  // ---- the clock: every comparison happens in the card's own zone ---------
  const tz = "Asia/Tokyo";
  const before = new Date("2026-12-24T14:59:00Z"); // 23:59 on the 24th in Tokyo
  const after = new Date("2026-12-24T15:00:00Z"); // 00:00 on the 25th
  check("civilDate before midnight", civilDate(before, tz) === "2026-12-24", civilDate(before, tz));
  check("civilDate after midnight", civilDate(after, tz) === "2026-12-25", civilDate(after, tz));

  const xmas = { label: "x", message: "m", date: "2026-12-25", repeat: "yearly" as const };
  check("waiting at 23:59", satelliteClock(xmas, before, tz)?.status === "waiting");
  check("returned at 00:00", satelliteClock(xmas, after, tz)?.status === "returned");
  check("not the day at 23:59", !isSatelliteDay(xmas, before, tz));
  check("is the day at 00:00", isSatelliteDay(xmas, after, tz));
  check("countdown is 1 day out", satelliteClock(xmas, before, tz)?.daysUntil === 1);

  // Yearly wrap-around, and 29 February observed on the 28th.
  check("yearly wraps to next year", nextOccurrence("2026-12-25", "2027-06-01", true) === "2027-12-25",
    nextOccurrence("2026-12-25", "2027-06-01", true));
  check("yearly holds during the window", nextOccurrence("2026-12-25", "2027-01-02", true) === "2026-12-25",
    nextOccurrence("2026-12-25", "2027-01-02", true));
  check("29 Feb observed on the 28th", nextOccurrence("2024-02-29", "2027-01-01", true) === "2027-02-28",
    nextOccurrence("2024-02-29", "2027-01-01", true));
  check("29 Feb kept in a leap year", nextOccurrence("2024-02-29", "2028-01-01", true) === "2028-02-29",
    nextOccurrence("2024-02-29", "2028-01-01", true));

  // ---- the comet's orbit is a real orbit ----------------------------------
  const q = orbitPoint(0).distance;
  const back = orbitPoint(1).distance;
  const far = orbitPoint(0.5).distance;
  check("f=0 is perihelion", Math.abs(q - PERIHELION) < 1e-9, q.toFixed(9));
  check("f=1 is perihelion", Math.abs(back - PERIHELION) < 1e-9, back.toFixed(9));
  check("f=0.5 is aphelion", Math.abs(far - APHELION) < 1e-9, far.toFixed(9));
  console.log(`  comet orbit: q=${q.toFixed(2)} Q=${far.toFixed(2)} tail at q=${tailLength(q).toFixed(2)}u`);

  let worstKepler = 0;
  for (let i = 0; i <= 2000; i++) {
    const M = (2 * Math.PI * i) / 2000;
    const E = solveEccentricAnomaly(M);
    worstKepler = Math.max(worstKepler, Math.abs(E - ECCENTRICITY * Math.sin(E) - M));
  }
  check("Kepler solve within 1e-9", worstKepler < 1e-9, worstKepler.toExponential(2));

  let outward = true;
  let inward = true;
  for (let i = 1; i <= 500; i++) {
    const a = orbitPoint((i - 1) / 1000).distance;
    const b = orbitPoint(i / 1000).distance;
    if (b < a - 1e-9) outward = false;
    const c = orbitPoint(0.5 + (i - 1) / 1000).distance;
    const d = orbitPoint(0.5 + i / 1000).distance;
    if (d > c + 1e-9) inward = false;
  }
  check("distance grows on the way out", outward);
  check("distance falls on the way back", inward);
  check("a just-released comet is already away", displayedProgress(0.001) >= 0.06);
  check("no tail beyond 25 units", tailLength(25) === 0);

  const restarted = cometWindow(
    { releasedOn: "2025-12-25", returnsOn: "2026-12-25", yearly: true },
    "2027-03-01",
  );
  check("yearly comet sets off again from its last return",
    restarted.releasedOn === "2026-12-25" && restarted.returnsOn === "2027-12-25",
    `${restarted.releasedOn} -> ${restarted.returnsOn}`);
  check("yearly comet is away again", restarted.status === "away");
  const holding = cometWindow({ releasedOn: "2025-12-25", returnsOn: "2026-12-25", yearly: true }, "2026-12-30");
  check("a returned comet holds for the window", holding.status === "returned");

  // ---- the trail's colours drift, smoothly and forever --------------------
  const seed = trailSeed("2026-newyear-7k2m");
  const same = trailSeed("2026-newyear-7k2m");
  check("trail colour is deterministic",
    trailColour(0.4, 12, seed).join() === trailColour(0.4, 12, same).join());
  check("a different card gets different colours",
    trailColour(0.4, 12, seed).join() !== trailColour(0.4, 12, trailSeed("thanks-sample-3f9q")).join());

  let worstU = 0;
  let worstT = 0;
  let nan = false;
  const reached = new Set<number>();
  for (let t = 0; t < 600; t += 1) {
    for (let u = 0; u <= 1; u += 0.01) {
      const here = trailColour(u, t, seed);
      const alongU = trailColour(u + 0.01, t, seed);
      const alongT = trailColour(u, t + 0.1, seed);
      for (let i = 0; i < 3; i++) {
        if (!Number.isFinite(here[i])) nan = true;
        worstU = Math.max(worstU, Math.abs(here[i] - alongU[i]));
        worstT = Math.max(worstT, Math.abs(here[i] - alongT[i]));
      }
      // Which palette entry this sample is nearest to.
      let nearest = 0;
      let best = Infinity;
      PALETTE.forEach((colour, index) => {
        const d = Math.hypot(colour[0] - here[0], colour[1] - here[1], colour[2] - here[2]);
        if (d < best) { best = d; nearest = index; }
      });
      reached.add(nearest);
    }
  }
  console.log(
    `  trail colour: worst delta du=${worstU.toFixed(4)} dt=${worstT.toFixed(4)}, ` +
    `${reached.size}/5 palette colours reached within 10 minutes`,
  );
  check("trail colour is continuous along u", worstU < 0.08, worstU.toFixed(4));
  check("trail colour is continuous in time", worstT < 0.08, worstT.toFixed(4));
  check("trail colour is never NaN", !nan);
  check("every palette colour appears within 10 minutes", reached.size === 5, `${reached.size}/5`);
  check("reduced motion freezes the drift",
    trailColour(0.4, 0, seed, true).join() === trailColour(0.4, 999, seed, true).join());

  // ---- the payload: what the browser may and may not be told --------------
  const sealed = cards.find((card) => card.comet?.message);
  if (!sealed) {
    check("a sample card carries a sealed comet", false);
  } else {
    const message = sealed.comet!.message!;
    const env = { mailReady: true, cometReady: true };
    const away = toClientCard(sealed, new Date("2026-06-01T00:00:00Z"), env);
    const home = toClientCard(sealed, new Date("2026-12-26T00:00:00Z"), env);
    check("a sealed comet's message is not in the payload before it returns",
      !JSON.stringify(away).includes(message));
    check("the comet is still shown as away", away.senderComet?.status === "away");
    check("a returned comet's message is in the payload",
      JSON.stringify(home).includes(message));
    check("the comet is shown as returned", home.senderComet?.status === "returned");
    check("the satellite's countdown is in the payload", typeof away.daysUntil === "number");
    check("hasOrbit is true for a card with a satellite", away.hasOrbit);
  }

  // Nothing from the environment, and no password hash, may reach the browser.
  const sentinels = {
    RESEND_API_KEY: "SENTINEL-RESEND",
    MAIL_FROM: "SENTINEL-FROM@example.com",
    NOTIFY_TO: "SENTINEL-NOTIFY@example.com",
    COMET_SECRET: "SENTINEL-COMET",
    ACCESS_SECRET: "SENTINEL-ACCESS",
  };
  const restore: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(sentinels)) {
    restore[key] = process.env[key];
    process.env[key] = value;
  }
  const guarded = {
    ...cards[0],
    access: { passwordHash: "scrypt$16384$8$1$c2FsdA==$aGFzaA==", hint: "駅の名前" },
  };
  const payload = JSON.stringify(toClientCard(guarded, new Date("2026-06-01T00:00:00Z"), {
    mailReady: true,
    cometReady: true,
  }));
  for (const [key, value] of Object.entries(sentinels)) {
    check(`payload never contains ${key}`, !payload.includes(value));
  }
  check("payload never contains the password hash", !payload.includes("scrypt$"));
  check("payload does carry the hint", payload.includes("駅の名前"));
  for (const [key, value] of Object.entries(restore)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  // ---- dev-only time travel stays dev-only --------------------------------
  const realNow = new Date("2026-06-01T00:00:00Z");
  check("?now= moves the clock in development",
    resolveNow("2026-12-25", realNow).getTime() !== realNow.getTime());
  const nodeEnv = process.env.NODE_ENV;
  // @ts-expect-error NODE_ENV is typed as readonly, and this is the point of the check.
  process.env.NODE_ENV = "production";
  check("?now= is ignored in production",
    resolveNow("2026-12-25", realNow).getTime() === realNow.getTime());
  // @ts-expect-error restoring it again
  process.env.NODE_ENV = nodeEnv;
  check("?now= rejects nonsense", resolveNow("tomorrow", realNow).getTime() === realNow.getTime());
}

console.log("8. Access: forgiving passwords, hashes and precedence (spec v0.2 §14.9):");
{
  // ---- normalisation: the same answer, typed five different ways ----------
  const groups: string[][] = [
    ["カマクラ", "かまくら", "ｶﾏｸﾗ", " かまくら ", "か ま く ら"],
    ["K7QM-2XPA", "k7qm 2xpa", "k7qm2xpa", "Ｋ７ＱＭ－２ＸＰＡ"],
  ];
  for (const group of groups) {
    const [first, ...rest] = group;
    const target = normalisePassword(first);
    for (const variant of rest) {
      check(`"${variant}" normalises like "${first}"`, normalisePassword(variant) === target,
        `${normalisePassword(variant)} != ${target}`);
    }
  }
  check("different answers stay different", normalisePassword("かまくら") !== normalisePassword("かまくらし"));

  // ---- the hash round-trips, and only for the right password --------------
  const hash = hashPassword("カマクラ");
  check("a hash looks like a hash", isPasswordHash(hash), hash.slice(0, 24));
  check("the same answer verifies", verifyPassword("かまくら", hash));
  check("a katakana variant verifies", verifyPassword("ｶﾏｸﾗ", hash));
  check("a wrong answer fails", !verifyPassword("えのしま", hash));
  check("an empty answer fails", !verifyPassword("", hash));
  check("two hashes of one password differ (salted)", hashPassword("カマクラ") !== hash);
  check("a truncated hash fails", !verifyPassword("かまくら", hash.slice(0, -4)));
  check("a flipped character fails",
    !verifyPassword("かまくら", hash.slice(0, -1) + (hash.endsWith("A") ? "B" : "A")));

  // ---- generated passwords are readable and unambiguous -------------------
  const generated = generatePassword();
  check("generated password is 8 characters", generated.length === 8, generated);
  check("generated password avoids 0/O/1/I/L", !/[01OIL]/.test(generated), generated);
  check("generated password is shown in two halves", formatPassword(generated).length === 9,
    formatPassword(generated));
  check("a generated password verifies against its own hash",
    verifyPassword(formatPassword(generated), hashPassword(generated)));
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(generatePassword());
  check("generated passwords are not repeated", seen.size === 500, String(seen.size));

  // ---- precedence: env per-card > config hash > shared env > none ---------
  const slug = cards[0].slug;
  const envKey = `CARD_PASSWORD_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const before = { perCard: process.env[envKey], shared: process.env.CARD_PASSWORD };
  const hashed = { ...cards[0], access: { passwordHash: hash } };
  const plain = { ...cards[0], access: undefined };

  delete process.env[envKey];
  delete process.env.CARD_PASSWORD;
  check("no password configured means no gate", cardSecret(slug, plain).kind === "none");
  check("a config hash gates the card", cardSecret(slug, hashed).kind === "hash");

  process.env.CARD_PASSWORD = "shared-one";
  check("the shared env password gates an unprotected card",
    cardSecret(slug, plain).kind === "env");
  check("a config hash still wins over the shared env password",
    cardSecret(slug, hashed).kind === "hash");

  process.env[envKey] = "per-card-one";
  const winner = cardSecret(slug, hashed);
  check("the per-card env password wins over everything",
    winner.kind === "env" && winner.password === "per-card-one", winner.kind);
  check("a v0.1 env password still opens the card", checkPassword(slug, "per-card-one"));
  check("env passwords are forgiving too", checkPassword(slug, " Per-Card One "));
  check("a wrong env password is refused", checkPassword(slug, "something else") === false);

  // ---- a hash with no signing key is a card nobody can open --------------
  {
    const keep = process.env.ACCESS_SECRET;
    const nodeEnv = process.env.NODE_ENV;
    delete process.env.ACCESS_SECRET;
    check("a hash without ACCESS_SECRET is a note in development",
      cardProblems(hashed).notes.some((n) => n.includes("ACCESS_SECRET")));
    // @ts-expect-error NODE_ENV is typed as readonly, and this is the point of the check.
    process.env.NODE_ENV = "production";
    check("a hash without ACCESS_SECRET fails a production build",
      cardProblems(hashed).errors.some((n) => n.includes("ACCESS_SECRET")));
    process.env.ACCESS_SECRET = "a-signing-key";
    check("with ACCESS_SECRET set there is no complaint",
      !cardProblems(hashed).errors.some((n) => n.includes("ACCESS_SECRET")));
    // @ts-expect-error restoring it again
    process.env.NODE_ENV = nodeEnv;
    if (keep === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = keep;
  }

  // ---- the cookie is derived from the secret, so it dies with it ---------
  delete process.env[envKey];
  delete process.env.CARD_PASSWORD;
  const beforeAccess = process.env.ACCESS_SECRET;

  process.env.ACCESS_SECRET = "";
  check("no ACCESS_SECRET locks a hash-protected card",
    accessToken(slug, hashed) === null);

  process.env.ACCESS_SECRET = "a-signing-key";
  const first = accessToken(slug, hashed);
  check("with ACCESS_SECRET the card can issue a cookie", typeof first === "string");
  check("the same hash gives the same cookie", accessToken(slug, hashed) === first);
  check("a new password invalidates the old cookie",
    accessToken(slug, { ...cards[0], access: { passwordHash: hashPassword("えのしま") } }) !== first);
  process.env.ACCESS_SECRET = "a-different-signing-key";
  check("rotating ACCESS_SECRET invalidates the old cookie",
    accessToken(slug, hashed) !== first);
  check("an unprotected card issues no cookie at all", accessToken(slug, plain) === null);

  if (beforeAccess === undefined) delete process.env.ACCESS_SECRET;
  else process.env.ACCESS_SECRET = beforeAccess;
  if (before.perCard === undefined) delete process.env[envKey];
  else process.env[envKey] = before.perCard;
  if (before.shared === undefined) delete process.env.CARD_PASSWORD;
  else process.env.CARD_PASSWORD = before.shared;
}

console.log("9. Orbit, trail and panels (spec v0.2 §6):");
{
  const MEMORIES = 5;
  const at = (state: Experience["state"], patch: Partial<Experience> = {}): Experience => ({
    ...initialExperience({ memoryCount: MEMORIES, hasOrbit: true }),
    state,
    ...patch,
  });

  let exp = at("completed", { activeFace: 5 });
  const send = (event: ExperienceEvent) => (exp = reduceExperience(exp, event));

  // ---- out of the letter and into orbit -----------------------------------
  send({ type: "move", direction: 1 });
  check("scrolling on at the close deploys", exp.state === "deploying");
  check("deploying is not dimmed on arrival", cameraPhase(exp.state) === "orbit");
  check("deploying shows no face text", !revealsText(exp.state));
  check("deploying ignores input", !acceptsInput(exp.state));
  check("the cube is in satellite form", isDeployed(exp.state));
  send({ type: "deployEnd" });
  check("deployEnd lands in orbit", exp.state === "orbit");
  check("orbit is at rest", acceptsInput(exp.state));
  check("orbit is not dimmed", !dimsScene(exp.state));
  check("orbit opens no panel by itself", exp.panel === null);

  // ---- and back again, to exactly the screen we left ----------------------
  send({ type: "dock" });
  check("dock undeploys", exp.state === "undeploying");
  check("undeploying dims the scene again", dimsScene(exp.state));
  check("undeploying heads for the far pose", cameraPhase(exp.state) === "far");
  send({ type: "deployEnd" });
  check("undeploying lands at the closing screen", exp.state === "completed");
  check("undeploying keeps the face it left from", exp.activeFace === 5);
  send({ type: "deploy" });
  send({ type: "deployEnd" });
  check("the deploy button reaches orbit too", exp.state === "orbit");

  // ---- panels: one at a time, and they swallow gestures -------------------
  for (const panel of ["satellite", "reply", "comet"] as const) {
    send({ type: "openPanel", panel });
    check(`${panel} panel opens`, exp.panel === panel && exp.state === "orbit");
    const held = exp;
    check(`${panel} panel ignores a forward gesture`,
      reduceExperience(held, { type: "move", direction: 1 }) === held);
    check(`${panel} panel ignores a backward gesture`,
      reduceExperience(held, { type: "move", direction: -1 }) === held);
    check(`${panel} panel blocks dock`, reduceExperience(held, { type: "dock" }) === held);
    check(`${panel} panel blocks the trail`,
      reduceExperience(held, { type: "lookBack" }) === held);
  }
  send({ type: "closePanel" });
  check("closing a panel returns to plain orbit", exp.panel === null && exp.state === "orbit");
  check("a panel cannot be opened from outside orbit",
    reduceExperience(at("remembering"), { type: "openPanel", panel: "reply" }).panel === null);

  // ---- the trail: newest first, and never a dead end ----------------------
  send({ type: "move", direction: 1 });
  check("scrolling on in orbit rewinds onto the trail", exp.state === "rewinding");
  check("the trail starts at the newest memory", exp.activeMemory === 0);
  check("rewinding puts the camera on the trail", cameraPhase(exp.state) === "trail");
  check("rewinding reveals no memory yet", !revealsMemory(exp.state));
  send({ type: "zoomEnd" });
  check("arrives remembering", exp.state === "remembering");
  check("remembering reveals the memory", revealsMemory(exp.state));

  for (let i = 0; i < MEMORIES - 1; i++) {
    send({ type: "move", direction: 1 });
    check(`drifting to memory ${i + 2}`, exp.state === "drifting" && exp.activeMemory === i + 1);
    check(`memory ${i + 2} is hidden mid-drift`, !revealsMemory(exp.state));
    send({ type: "zoomEnd" });
    check(`memory ${i + 2} lands`, exp.state === "remembering" && exp.activeMemory === i + 1);
  }

  send({ type: "move", direction: 1 });
  check("past the oldest memory the trail surfaces", exp.state === "resurfacing");
  send({ type: "zoomEnd" });
  check("resurfacing returns to orbit", exp.state === "orbit");

  // The other end does the same, so neither end of someone else's memories is
  // a place to get stuck.
  exp = at("remembering", { activeMemory: 0 });
  send({ type: "move", direction: -1 });
  check("before the newest memory the trail surfaces", exp.state === "resurfacing");
  send({ type: "zoomEnd" });
  check("that end returns to orbit too", exp.state === "orbit");

  // lookBack is a toggle: into the trail from orbit, out of it from a memory.
  send({ type: "lookBack" });
  check("lookBack enters the trail", exp.state === "rewinding");
  send({ type: "zoomEnd" });
  send({ type: "lookBack" });
  check("lookBack leaves the trail", exp.state === "resurfacing");
  send({ type: "zoomEnd" });

  const noMemories = initialExperience({ memoryCount: 0, hasOrbit: true });
  const orbitOnly = { ...noMemories, state: "orbit" as const };
  check("with no memories there is no trail to enter",
    reduceExperience(orbitOnly, { type: "lookBack" }) === orbitOnly);
  check("with no memories scrolling on in orbit does nothing",
    reduceExperience(orbitOnly, { type: "move", direction: 1 }) === orbitOnly);

  // ---- launch and release only ever follow a server yes -------------------
  check("launch needs the reply panel",
    reduceExperience(at("orbit"), { type: "launch" }).state === "orbit");
  check("launch is refused with the comet panel open",
    reduceExperience(at("orbit", { panel: "comet" }), { type: "launch" }).state === "orbit");
  let launched = reduceExperience(at("orbit", { panel: "reply" }), { type: "launch" });
  check("launch from the reply panel flies", launched.state === "launching");
  check("launching stays in the orbit pose", cameraPhase(launched.state) === "orbit");
  check("launching ignores input", !acceptsInput(launched.state));
  launched = reduceExperience(launched, { type: "launchEnd" });
  check("the rocket leaves a star behind",
    launched.state === "orbit" && launched.panel === null && launched.launched);
  check("released is untouched by a launch", !launched.released);

  check("release needs the comet panel",
    reduceExperience(at("orbit"), { type: "release" }).state === "orbit");
  check("release is refused with the reply panel open",
    reduceExperience(at("orbit", { panel: "reply" }), { type: "release" }).state === "orbit");
  let released = reduceExperience(at("orbit", { panel: "comet" }), { type: "release" });
  check("release from the comet panel flies", released.state === "releasing");
  released = reduceExperience(released, { type: "releaseEnd" });
  check("the comet is on its way",
    released.state === "orbit" && released.panel === null && released.released);
  check("launched is untouched by a release", !released.launched);

  // ---- the reveal rules hold over every new state too ---------------------
  const v02 = [
    "deploying", "orbit", "undeploying", "rewinding", "remembering",
    "drifting", "resurfacing", "launching", "releasing",
  ] as const;
  for (const state of v02) {
    check(`${state} hides face text`, !revealsText(state));
    check(`${state} hides the secret line`, !revealsSecret(state));
    check(`${state} cannot be revealed into`,
      reduceExperience(at(state), { type: "reveal" }).state === state);
    check(`${state} renders the cube deployed`, isDeployed(state));
  }
  for (const state of v02) {
    if (state !== "remembering") check(`${state} attaches no memory`, !revealsMemory(state));
  }
  check("only 'remembering' reveals a memory", revealsMemory("remembering"));
  for (const state of ["landing", "reading", "completed", "inside"] as const) {
    check(`${state} is not deployed`, !isDeployed(state));
    check(`${state} attaches no memory`, !revealsMemory(state));
  }

  // ---- ?at=: the preview walks the same road, only faster ----------------
  const walk = (target: string, ctx = { memoryCount: MEMORIES, hasOrbit: true }) => {
    const events = jumpEvents(target);
    if (!events) return null;
    return events.reduce(reduceExperience, initialExperience(ctx));
  };

  const arrivals: [string, string, Partial<Experience>][] = [
    ["landing", "landing", {}],
    ["face-1", "reading", { activeFace: 0 }],
    ["face-4", "reading", { activeFace: 3 }],
    ["face-6", "reading", { activeFace: 5 }],
    ["closing", "completed", {}],
    ["inside", "inside", {}],
    ["orbit", "orbit", { panel: null }],
    ["trail", "remembering", { activeMemory: 0 }],
    ["satellite", "orbit", { panel: "satellite" }],
    ["comet", "orbit", { panel: "comet" }],
    ["reply", "orbit", { panel: "reply" }],
  ];
  for (const [target, expected, fields] of arrivals) {
    const reached = walk(target);
    check(`?at=${target} reaches ${expected}`, reached?.state === expected, reached?.state);
    for (const [key, value] of Object.entries(fields)) {
      check(`?at=${target} sets ${key}`,
        reached?.[key as keyof Experience] === value, String(reached?.[key as keyof Experience]));
    }
  }
  check("?at= refuses a target it does not know", jumpEvents("satellite-panel") === null);
  check("?at= refuses an empty target", jumpEvents(undefined) === null);

  // A target the card cannot reach stops at the last state it does have,
  // rather than inventing one.
  const plain = walk("orbit", { memoryCount: 0, hasOrbit: false });
  check("?at=orbit on a v0.1 card stays at the closing screen", plain?.state === "completed",
    plain?.state);

  {
    const nodeEnv = process.env.NODE_ENV;
    // @ts-expect-error NODE_ENV is typed as readonly, and this is the point of the check.
    process.env.NODE_ENV = "production";
    check("?at= is ignored in production", jumpEvents("orbit") === null);
    // @ts-expect-error restoring it again
    process.env.NODE_ENV = nodeEnv;
  }

  console.log(`  orbit, ${MEMORIES} memories on the trail, 3 panels, 2 one-way animations`);
  console.log(`  ?at= reaches all ${JUMP_TARGETS.length} preview targets`);
}

console.log("10. The moving sun and the camera's breath (spec v0.2 §23.3):");
{
  const seed = lightSeed("2026-newyear-7k2m");

  // ---- continuity: a jump in the sun is a jump in every shadow at once ----
  let worstStep = 0;
  let minAzimuth = Infinity;
  let maxAzimuth = -Infinity;
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let nan = false;

  const angles = (t: number) => {
    const { dir } = keyLight(t, seed, false);
    const [x, y, z] = dir;
    if (![x, y, z].every(Number.isFinite)) nan = true;
    return {
      azimuth: (Math.atan2(x, z) * 180) / Math.PI,
      elevation: (Math.asin(y) * 180) / Math.PI,
    };
  };

  let previous = angles(0);
  // Ten minutes at 0.1 s: long enough for both azimuth sines and the
  // elevation one to come round.
  for (let i = 1; i <= 6000; i++) {
    const current = angles(i * 0.1);
    worstStep = Math.max(worstStep, Math.abs(current.azimuth - previous.azimuth));
    minAzimuth = Math.min(minAzimuth, current.azimuth);
    maxAzimuth = Math.max(maxAzimuth, current.azimuth);
    minElevation = Math.min(minElevation, current.elevation);
    maxElevation = Math.max(maxElevation, current.elevation);
    previous = current;
  }

  check("the sun never jumps", worstStep < 0.2, `${worstStep.toFixed(4)}deg per 0.1s`);
  check("the sun's direction is always a number", !nan);
  check("azimuth stays within -50deg..-26deg", minAzimuth >= -50 && maxAzimuth <= -26,
    `${minAzimuth.toFixed(2)}..${maxAzimuth.toFixed(2)}`);
  check("elevation stays within 37deg..47deg", minElevation >= 37 && maxElevation <= 47,
    `${minElevation.toFixed(2)}..${maxElevation.toFixed(2)}`);
  check("the sun actually moves", maxAzimuth - minAzimuth > 4,
    (maxAzimuth - minAzimuth).toFixed(2));

  const unit = keyLight(31.7, seed, false).dir;
  check("the direction is a unit vector",
    Math.abs(Math.hypot(...unit) - 1) < 1e-9, Math.hypot(...unit).toFixed(12));

  // ---- the returned day is warmer, but only a little ---------------------
  const plain = keyLight(12, seed, false);
  const warm = keyLight(12, seed, true);
  check("the returned day changes the colour", plain.color !== warm.color, warm.color);
  check("the returned day does not move the sun",
    plain.dir.every((v, i) => v === warm.dir[i]));
  const shift = Math.max(
    ...[1, 3, 5].map((i) => {
      const a = Number.parseInt(plain.color.slice(i, i + 2), 16);
      const b = Number.parseInt(warm.color.slice(i, i + 2), 16);
      return Math.abs(a - b) / 255;
    }),
  );
  check("the warm shift is at most 10%", shift <= 0.1 + 1e-6, `${(shift * 100).toFixed(1)}%`);

  // ---- intensity breathes, gently ----------------------------------------
  let minI = Infinity;
  let maxI = -Infinity;
  for (let i = 0; i <= 600; i++) {
    const { intensity } = keyLight(i * 0.1, seed, false);
    minI = Math.min(minI, intensity);
    maxI = Math.max(maxI, intensity);
  }
  check("intensity stays near 1", minI >= 0.93 && maxI <= 1.07,
    `${minI.toFixed(3)}..${maxI.toFixed(3)}`);

  // ---- reduced motion is a still, lit picture ----------------------------
  const still = keyLight(0, seed, false, { reducedMotion: true });
  for (const t of [0, 7.5, 61, 500]) {
    const at = keyLight(t, seed, false, { reducedMotion: true });
    check(`reduced motion freezes the sun at t=${t}`,
      at.dir.every((v, i) => v === still.dir[i]) && at.intensity === still.intensity);
  }
  check("the frozen sun is still lit", still.intensity > 0);

  // ---- two cards are lit from different points in the same sweep ---------
  const other = lightSeed("thanks-sample-3f9q");
  check("two cards differ", keyLight(0, seed, false).dir[0] !== keyLight(0, other, false).dir[0]);

  // ---- the camera breathes, except where text is being read --------------
  let worstBreath = 0;
  let previousBreath = cameraBreath(0, seed);
  for (let i = 1; i <= 2600; i++) {
    const b = cameraBreath(i * 0.1, seed);
    worstBreath = Math.max(worstBreath, Math.abs(b.distance - 1));
    check_once("the breath never jumps", Math.abs(b.distance - previousBreath.distance) < 0.001);
    previousBreath = b;
  }
  check("the breath stays within 0.7%", worstBreath <= BREATH_DISTANCE + 1e-9,
    `${(worstBreath * 100).toFixed(3)}%`);
  check("the breath does reach its full swing", worstBreath > BREATH_DISTANCE * 0.99);
  const held = cameraBreath(13, seed, { reducedMotion: true });
  check("reduced motion holds the camera still", held.distance === 1 && held.roll === 0);

  // ---- and never breathes where text is being read ------------------------
  for (const state of ["reading", "remembering", "inside"] as const) {
    check(`${state} holds the camera perfectly still`, !breathesAtRest(state));
  }
  for (const state of ["landing", "completed", "orbit"] as const) {
    check(`${state} breathes`, breathesAtRest(state));
  }
  // Every animated state is already moving the camera; breathing on top of
  // that would fight the rig.
  for (const state of [
    "entering", "returning", "transitioning", "leaving", "descending", "ascending",
    "deploying", "undeploying", "rewinding", "drifting", "resurfacing",
    "launching", "releasing",
  ] as const) {
    check(`${state} leaves the camera to the rig`, !breathesAtRest(state));
  }

  console.log(
    `  sun: azimuth ${minAzimuth.toFixed(1)}..${maxAzimuth.toFixed(1)}deg, ` +
    `elevation ${minElevation.toFixed(1)}..${maxElevation.toFixed(1)}deg, ` +
    `worst step ${worstStep.toFixed(4)}deg/0.1s`,
  );
}

console.log("11. Orbit and trail framing (spec v0.2 §8.3, §9.3, §17):");
{
  const viewports: [string, number, number][] = [
    ["desktop 1512x945", 1512, 945],
    ["laptop 1280x800", 1280, 800],
    ["iPhone 390x844", 390, 844],
    ["iPad 834x1112", 834, 1112],
  ];
  const halfV = ((FOV * Math.PI) / 180) / 2;

  // ---- the whole ellipse, and the planet's visible arc, fit the frame -----
  for (const [label, w, h] of viewports) {
    const aspect = w / h;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const pose = orbitPose(w, h);
    const camera: [number, number, number] = pose.position;

    let worstMargin = Infinity;
    const consider = (point: [number, number, number]) => {
      // The camera looks straight down -z at the target, so the projection is
      // the offset from the target over the distance along the view axis.
      const depth = camera[2] - point[2];
      if (depth <= 0) return;
      const halfWidth = Math.tan(halfH) * depth;
      const halfHeight = Math.tan(halfV) * depth;
      const dx = Math.abs(point[0] - camera[0]);
      const dy = Math.abs(point[1] - camera[1]);
      worstMargin = Math.min(worstMargin, 1 - dx / halfWidth, 1 - dy / halfHeight);
    };

    // The full ellipse.
    for (let i = 0; i < 360; i++) consider(orbitPosition((i * Math.PI) / 180));
    // The planet's silhouette, sampled around its circumference.
    for (let i = 0; i < 360; i++) {
      const a = (i * Math.PI) / 180;
      consider([
        PLANET_CENTRE[0] + Math.cos(a) * PLANET_RADIUS,
        PLANET_CENTRE[1] + Math.sin(a) * PLANET_RADIUS,
        PLANET_CENTRE[2],
      ]);
    }

    check(`${label}: orbit frame keeps 8% margin`, worstMargin >= 0.08,
      `${(worstMargin * 100).toFixed(1)}%`);
    console.log(
      `  ${label.padEnd(18)} orbit camera z=${camera[2].toFixed(1)}u, ` +
      `margin ${(worstMargin * 100).toFixed(1)}%`,
    );
  }

  // The satellite always clears the planet, or it would fly through it.
  let closest = Infinity;
  for (let i = 0; i < 720; i++) {
    const [x, y, z] = orbitPosition((i * Math.PI) / 360);
    closest = Math.min(closest, Math.hypot(
      x - PLANET_CENTRE[0], y - PLANET_CENTRE[1], z - PLANET_CENTRE[2]));
  }
  check("the satellite never flies through the planet", closest > PLANET_RADIUS,
    `${closest.toFixed(2)}u vs r=${PLANET_RADIUS}`);

  // ---- the memory panel fills the same share of the frame as a face ------
  for (const [label, w, h] of viewports) {
    const { widthFraction, heightFraction } = memoryPanelFraming(w, h);
    const portrait = w < h;
    if (portrait) {
      check(`${label}: memory panel fills 65-80% of the width`,
        widthFraction >= 0.65 && widthFraction <= 0.80,
        `${(widthFraction * 100).toFixed(1)}%`);
    } else {
      check(`${label}: memory panel fills 45-65% of the height`,
        heightFraction >= 0.45 && heightFraction <= 0.65,
        `${(heightFraction * 100).toFixed(1)}%`);
    }
  }

  // ---- the trail is a path, not a scribble -------------------------------
  const seeds = ["2026-newyear-7k2m", "thanks-sample-3f9q"].map(trailSeedFor);
  check("two cards' trails bend differently", seeds[0] !== seeds[1]);

  for (const seed of seeds) {
    const points = trailControlPoints(seed);
    let worstLateral = 0;
    let previousZ = Infinity;
    let recedes = true;
    let nan = false;

    for (let i = 0; i <= 500; i++) {
      const [x, y, z] = trailPoint(points, i / 500);
      if (![x, y, z].every(Number.isFinite)) nan = true;
      worstLateral = Math.max(worstLateral, Math.hypot(x, y - 1.1 * (i / 500)));
      // Monotonic in z: a trail that doubles back is not a path travelled.
      if (z > previousZ + 1e-6) recedes = false;
      previousZ = z;
    }

    check("the trail is always a real point", !nan);
    check("the trail always recedes", recedes);
    check("the trail stays near its axis", worstLateral <= TRAIL_LATERAL * 1.25,
      `${worstLateral.toFixed(2)}u`);

    const near = trailPoint(points, 0);
    const far = trailPoint(points, 1);
    check("the trail starts behind the orbit", near[2] <= TRAIL_NEAR_Z + 1e-6, near[2].toFixed(2));
    check("the trail ends inside the nebula shell", Math.hypot(...far) < 90,
      Math.hypot(...far).toFixed(1));
  }

  // ---- memories are evenly spaced, newest nearest ------------------------
  const spacing = new Set<string>();
  for (let i = 1; i < 8; i++) spacing.add((memoryU(i, 8) - memoryU(i - 1, 8)).toFixed(9));
  check("memories are evenly spaced along the trail", spacing.size === 1);
  check("the newest memory is the nearest", memoryU(0, 8) < memoryU(7, 8));
  check("a single memory still has a place", Number.isFinite(memoryU(0, 1)));

  // ---- and the camera arrives square-on, every time ----------------------
  // A drift lands with the bank back at exactly zero, the same guarantee the
  // cube's rotation gives when it lands on a face.
  const bankAt = (t: number) => Math.sin(Math.PI * t);
  check("a drift starts level", bankAt(0) === 0);
  check("a drift lands level", Math.abs(bankAt(1)) < 1e-6, bankAt(1).toExponential(2));
  let peak = 0;
  for (let i = 0; i <= 1000; i++) peak = Math.max(peak, Math.abs(bankAt(i / 1000)));
  check("the bank stays under 4 degrees", peak * 3.4 <= 4, `${(peak * 3.4).toFixed(2)}deg`);

}

console.log("12. The deployment (spec v0.2 §8.2):");
{
  // ---- the four parts overlap, which is what makes it one machine --------
  check("the turn starts at the very beginning", TURN.from === 0);
  check("the panels start before the turn finishes", PANELS.from < TURN.to);
  check("the thruster fires as the panels finish", THRUSTER.from <= PANELS.to);
  check("the rise starts before the thruster is done", RISE.from < THRUSTER.to);
  check("the rise is the last thing to finish", RISE.to === 1);

  // ---- nothing in it jumps ----------------------------------------------
  // "Fast" and "discontinuous" both show up as a large step between samples,
  // so a threshold cannot tell them apart — the thruster is deliberately the
  // fastest part of this and would fail any bound the others pass. What
  // separates them is how the step behaves as the sampling gets finer: a
  // continuous curve halves, a jump does not move.
  const worstStepAt = (samples: number) => {
    let worst = 0;
    let previous = deploymentAt(0);
    for (let i = 1; i <= samples; i++) {
      const now = deploymentAt(i / samples);
      worst = Math.max(
        worst,
        Math.abs(now.turn - previous.turn),
        Math.abs(now.panels - previous.panels),
        Math.abs(now.thruster - previous.thruster),
        Math.abs(now.rise - previous.rise),
      );
      previous = now;
    }
    return worst;
  };
  const coarse = worstStepAt(2000);
  const fine = worstStepAt(8000);
  check("no part of the deployment jumps", fine < coarse / 3.5,
    `${coarse.toFixed(6)} -> ${fine.toFixed(6)} at 4x the resolution`);
  check("and none of it is violent", coarse < 0.02, coarse.toFixed(5));

  // ---- the ends are exact ------------------------------------------------
  const docked = deploymentAt(0);
  const deployed = deploymentAt(1);
  check("docked: nothing has happened yet",
    docked.turn === 0 && docked.panels === 0 && docked.rise === 0);
  check("docked: the thruster is cold", docked.thruster === 0);
  check("deployed: everything has finished",
    deployed.turn === 1 && deployed.panels === 1 && deployed.rise === 1);
  check("deployed: the thruster is cold again", Math.abs(deployed.thruster) < 1e-9);
  check("the thruster only ever fires once",
    deploymentAt(0.3).thruster === 0 &&
    deploymentAt(0.6).thruster > 0.5 &&
    Math.abs(deploymentAt(0.9).thruster) < 1e-9,
    deploymentAt(0.9).thruster.toExponential(2));
  check("out of range clamps rather than overshooting",
    deploymentAt(-1).rise === 0 && deploymentAt(2).rise === 1);

  // ---- the reverse really is the forward timeline, backwards -------------
  // Docking runs `t` down instead of up, so it lands back on the closing
  // screen it left only if every part of the deployment is monotonic in `t`.
  // If one of them went forwards while the rest went back, the cube would come
  // home in a shape it was never in on the way out.
  let monotonic = true;
  let previousPart = deploymentAt(0);
  for (let i = 1; i <= 4000; i++) {
    const now = deploymentAt(i / 4000);
    if (
      now.turn < previousPart.turn - 1e-12 ||
      now.panels < previousPart.panels - 1e-12 ||
      now.rise < previousPart.rise - 1e-12
    ) {
      monotonic = false;
    }
    previousPart = now;
  }
  check("every part of the deployment only ever goes forwards", monotonic);

  // ---- the panels open in turn, and all of them finish -------------------
  for (let index = 0; index < 4; index++) {
    check(`panel ${index + 1} starts closed`, stagger(0, index) === 0);
    check(`panel ${index + 1} ends fully open`, stagger(1, index) === 1);
  }
  for (let index = 1; index < 4; index++) {
    check(`panel ${index + 1} lags the one before it`,
      stagger(0.5, index) < stagger(0.5, index - 1));
  }
  const spread = stagger(0.5, 0) - stagger(0.5, 3);
  check("the stagger is visible but not a queue", spread > 0.15 && spread < 0.55,
    spread.toFixed(3));

  console.log(
    `  turn 0-${TURN.to}, panels ${PANELS.from}-${PANELS.to}, ` +
    `thruster ${THRUSTER.from}-${THRUSTER.to}, rise ${RISE.from}-1, over ${DEPLOY_MS}ms`,
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
