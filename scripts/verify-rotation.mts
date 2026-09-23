import { existsSync } from "node:fs";
import * as THREE from "three";
import {
  FOV,
  INSIDE_DISTANCE,
  SECRET_PLANE_Z,
  cameraDistance,
  insideVisibleWidth,
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
import { toClientCard } from "../lib/clientCard.ts";
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
  cameraPhase,
  initialExperience,
  isWithinCube,
  isZoomedIn,
  reduceExperience,
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
      const fit = measureFace(phone, chars);
      console.log(
        `    face ${i + 1}: ${String(chars).padStart(3)} chars -> ${fit.lines} lines @ ${fit.fontPx}px on a 390px phone`,
      );
      check(id(`face ${i + 1} fits the face`), !fit.overflows, `${fit.lines} lines`);
      check(id(`face ${i + 1} readable on phone`), fit.fontPx >= 14, `${fit.fontPx}px`);
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
  for (const phase of ["entering", "returning", "leaving", "transitioning", "descending", "ascending"] as const) {
    const frozen: Experience = { state: phase, activeFace: 2 };
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
    const frozen: Experience = { state, activeFace: 0 };
    check(`${state} cannot be revealed into`, reduceExperience(frozen, { type: "reveal" }) === frozen);
  }

  // The secret is attached in exactly one state, like face text.
  for (const state of [
    "landing", "entering", "returning", "reading", "transitioning", "leaving", "completed", "descending", "ascending",
  ] as const) {
    check(`${state} hides the secret line`, !revealsSecret(state));
  }
  check("only 'inside' reveals the secret", revealsSecret("inside"));

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

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
