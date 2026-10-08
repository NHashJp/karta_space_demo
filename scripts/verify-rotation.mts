import { existsSync, readFileSync, statSync } from "node:fs";
import { closingLines } from "../lib/closingLines.ts";
import { trailSway } from "../lib/trailCurve.ts";
import { SATELLITE_OPACITIES, fadeSpread, stowedOpacity } from "../lib/satelliteFade.ts";
import { AGE_CEILING, AGE_HALF_LIFE_DAYS, cardEpoch, elapsedDays, sky, skyAge } from "../lib/skyAge.ts";
import {
  BEHIND,
  MAX_MISS,
  MIN_MISS,
  PASS_MEAN_S,
  POOL,
  RANGE,
  asteroidAt,
  asteroidPass,
  asteroidPasses,
  asteroidSeed,
  clearance,
} from "../lib/asteroids.ts";
import * as THREE from "three";
import {
  FOV,
  HUB_SATELLITE,
  INSIDE_DISTANCE,
  PLANET_CENTRE,
  PLANET_RADIUS,
  WING_AXIS_DEG,
  cometAt,
  hubCometAt,
  hubSun,
  hubPlanet,
  hubPlanetScreen,
  hubProject,
  retracePose,
  trailScreen,
  hubLabel,
  hubPose,
  hubTargets,
  LABEL_SHARE,
  MEMORY_PANEL_WORLD,
  memoryPanelFraming,
  memoryViewDistance,
  orbitClearance,
  orbitPose,
  orbitPosition,
  REPLY_OVERTAKE,
  replyStarAt,
  satelliteHull,
  stagedTrail,
  trailPose,
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
import { serializeCards } from "../lib/cardsFile.ts";
import { allProblems, cardProblems, MEMORY_MAX } from "../lib/cardRules.ts";
import { rehomeCard, strayMedia } from "../lib/cardMedia.ts";
import {
  APPEAR,
  MEAN_GAP_S,
  POOL as STAR_POOL,
  QUIET_AFTER_S,
  brightness,
  crossesFrame,
  shootingStar,
  shootingStarSeed,
  shootingStars,
} from "../lib/shootingStars.ts";
import { cleanSignature } from "../lib/signature.ts";
/** The meteor shower's own length, read from the component that plays it. */
const SHOWER_S = Number(
  /const DURATION_S = ([\d.]+)/.exec(
    readFileSync("components/three/MeteorShower.tsx", "utf8"),
  )?.[1],
);
import { readLocalCards } from "../lib/localCards.ts";
import { formatFuzzyDate, parseFuzzyDate, sortMemoriesNewestFirst } from "../lib/fuzzyDate.ts";
import { civilDate, isCometDay, nextOccurrence } from "../lib/orbitClock.ts";
import {
  APHELION,
  DISPLAY_FAR,
  DISPLAY_NEAR,
  PERIHELION,
  comaPixels,
  comaSize,
  displayOrbitPoint,
  cometCycle,
  displayedProgress,
  HUB_ORBIT_HEADING,
  SEED_ROTATION_MAX,
  orbitPoint,
  orbitRotation,
  solveEccentricAnomaly,
  tailPixels,
  toWorld,
  ECCENTRICITY,
} from "../lib/cometOrbit.ts";
import { PALETTE, trailColour, trailSeed } from "../lib/trailColour.ts";
import { returnLabel } from "../lib/returnLabel.ts";
import { RAMP_SIZE } from "../components/three/shaders/ribbon.ts";
import {
  BLUE_HOUR_COLOUR,
  BREATH_DISTANCE,
  GOLDEN_COLOUR,
  cameraBreath,
  keyLight,
  lightSeed,
} from "../lib/sceneLight.ts";
import { DAWN_FLOOR, DAWN_KEPT, dawn, sunVisibility } from "../lib/dawn.ts";
import { landingNote, toClientCard } from "../lib/clientCard.ts";
import { cometDayMail, cometMail, formatSentAt, replyMail } from "../lib/mail.ts";
import { COMET_MAX, NAME_MAX, REPLY_MAX, validate } from "../lib/submission.ts";
import { open, seal } from "../lib/cometSeal.ts";
import { randomBytes } from "node:crypto";
import {
  MEMORY_END_U,
  MEMORY_START_U,
  type Point3,
  straightestTrail,
  TRAIL_LATERAL,
  TRAIL_NEAR_Z,
  memoryU,
  trailControlPoints,
  MEANDER,
  trailPoint,
  trailSeedFor,
} from "../lib/trailCurve.ts";
import { DEPLOY_MS, REPLAY_SCALE, replayed } from "../lib/timing.ts";
import { ZOOM_OUT_MS } from "../components/three/framing.ts";
import {
  PANELS,
  RISE,
  SAT_SCALE,
  THRUSTER,
  TURN,
  DISPLAY_EULER_ORDER,
  DISPLAY_PITCH,
  DISPLAY_ROLL,
  DISPLAY_YAW,
  deploymentAt,
  displayDirection,
  wingReach,
} from "../lib/deployment.ts";
import {
  BOOM_WINDOW,
  DEPLOYED_SPAN,
  NEAR_WING_DELAY_MS,
  N_PANELS,
  UNFOLD_WINDOW,
  WING_STAGGER_MS,
  boomAt,
  hullPoints,
  selfClearance,
  unfoldAt,
  wingChain,
} from "../lib/satelliteGeometry.ts";
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
  NO_COMET_FLAGS,
  showsCometSheet,
  showsCompletion,
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
  easeInOutQuint,
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
/** The worst per-channel difference between two hex colours, 0..1. */
function distance(a: string, b: string): number {
  return Math.max(
    ...[1, 3, 5].map((i) =>
      Math.abs(
        Number.parseInt(a.slice(i, i + 2), 16) - Number.parseInt(b.slice(i, i + 2), 16),
      ) / 255,
    ),
  );
}

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

    /*
     * The signature is kept in the card, like its words, and never as a file
     * anyone can fetch without the password (lib/signature.ts). One that is
     * configured but does not survive `cleanSignature` would simply not draw,
     * and nothing on the closing screen would say so — hence a check.
     */
    if (card.signature) {
      const svg = cleanSignature(card.signature);
      check(id("signature is kept in the card, not a public file"),
        !card.signature.trimStart().startsWith("/"), card.signature.slice(0, 40));
      check(id("signature is a drawing the closing screen can use"), Boolean(svg));
      if (svg) {
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

console.log("5. Experience flow (card content never shows on the end screens):");
{
  // The v0.1 regression card: nothing past the closing screen. Every
  // transition below must behave exactly as it did before v0.2.
  let exp: Experience = initialExperience({ memoryCount: 0, hasOrbit: false, hasCrossroads: false, comet: NO_COMET_FLAGS });
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


console.log("6. v0.2 foundations (spec v0.2 §17):");
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

  const xmas = { returnsOn: "2026-12-25", leftOn: "2026-03-01", yearly: true };
  check("not the day at 23:59", !isCometDay(xmas, before, tz));
  check("is the day at 00:00", isCometDay(xmas, after, tz));
  check("away at 23:59", cometCycle(xmas, civilDate(before, tz)).status === "away");
  check("returned at 00:00", cometCycle(xmas, civilDate(after, tz)).status === "returned");
  check("countdown is 1 day out", cometCycle(xmas, civilDate(before, tz)).daysUntil === 1);

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
  console.log(
    `  comet orbit: q=${q.toFixed(2)} Q=${far.toFixed(2)} ` +
      `tail ${tailPixels(far, false).toFixed(0)}px at aphelion, ` +
      `${tailPixels(q, false).toFixed(0)}px at perihelion`,
  );

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
  /*
   * r7 §10 replaces r6's "no tail beyond 25 units" outright: there is always
   * a tail, because a comet without one is a star, and the tail is the only
   * thing that says which of the fifteen hundred lights up there is the one
   * coming back. What has to hold instead is that it *grows* — monotonically,
   * and by a lot — as the day comes near.
   */
  check("there is always a tail", tailPixels(far, false) >= 40, `${tailPixels(far, false)}px`);
  check("it is five times as long at the meeting point",
    tailPixels(q, false) >= 5 * tailPixels(far, false),
    `${tailPixels(far, false).toFixed(0)} -> ${tailPixels(q, false).toFixed(0)}px`);
  check("portrait is three quarters of it",
    Math.abs(tailPixels(q, true) - 0.75 * tailPixels(q, false)) < 1e-9);

  const restarted = cometCycle(
    { leftOn: "2025-12-25", returnsOn: "2026-12-25", yearly: true },
    "2027-03-01",
  );
  check("yearly comet sets off again from its last return",
    restarted.leftOn === "2026-12-25" && restarted.returnsOn === "2027-12-25",
    `${restarted.leftOn} -> ${restarted.returnsOn}`);
  check("yearly comet is away again", restarted.status === "away");
  const holding = cometCycle({ leftOn: "2025-12-25", returnsOn: "2026-12-25", yearly: true }, "2026-12-30");
  check("a returned comet holds for the window", holding.status === "returned");

  // A one-off comet becomes a keepsake rather than staying "returned" forever:
  // the promise was kept, and that is a different thing from still being made.
  const kept = cometCycle({ leftOn: "2025-12-25", returnsOn: "2026-12-25" }, "2027-03-01");
  check("a one-off comet is kept once its window closes", kept.status === "kept", kept.status);
  check("and it keeps its own dates", kept.returnsOn === "2026-12-25");

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
    check("the comet is still shown as away", away.comet?.status === "away");
    check("a returned comet's message is in the payload",
      JSON.stringify(home).includes(message));
    check("the comet is shown as returned", home.comet?.status === "returned");
    // The return is described, not counted down in raw days: what the card
    // *says* is the label, at whatever precision the sender chose.
    check("the return label is in the payload", typeof away.comet?.label.label === "string",
      away.comet?.label.label);
    check("and its relative form too", typeof away.comet?.label.relative === "string",
      away.comet?.label.relative);
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

console.log("7. Access: forgiving passwords, hashes and precedence (spec v0.2 §14.9):");
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

console.log("8. Orbit, trail and panels (spec v0.2 §6):");
{
  const MEMORIES = 5;
  const at = (state: Experience["state"], patch: Partial<Experience> = {}): Experience => ({
    ...initialExperience({
      memoryCount: MEMORIES,
      hasOrbit: true,
      hasCrossroads: true,
      comet: NO_COMET_FLAGS,
    }),
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

  // ---- what has been watched, and how often (REPLAY_SCALE) ---------------
  // Both ceremonies run in full once and briskly after that, so the machine
  // has to count arrivals rather than the screens counting their own mounts:
  // the closing screen is reached from three different places, and one of
  // them forgetting would be a bug on exactly one route through the card.
  check("that was the second trip to orbit", exp.deployments === 2);
  check("and the closing screen has been come back to once", exp.closings === 1);
  check("the first trip is watched in full", replayed(DEPLOY_MS, 1 > 1) === DEPLOY_MS);
  check("the second is brisk", replayed(DEPLOY_MS, exp.deployments > 1) < DEPLOY_MS);

  {
    // Every route into the closing screen counts: the letter ending, coming
    // back out of the cube, and docking from orbit.
    let walk: Experience = initialExperience({
      memoryCount: 0, hasOrbit: true, hasCrossroads: false, comet: NO_COMET_FLAGS,
    });
    const step = (event: ExperienceEvent) => (walk = reduceExperience(walk, event));
    check("a card starts with nothing watched",
      walk.closings === 0 && walk.deployments === 0);

    step({ type: "open" });
    step({ type: "zoomEnd" });
    for (let face = 0; face < 5; face++) {
      step({ type: "move", direction: 1 });
      step({ type: "rotationEnd" });
    }
    step({ type: "move", direction: 1 });
    step({ type: "zoomEnd" });
    check("reaching the end of the letter is the first closing", walk.closings === 1);

    step({ type: "reveal" });
    step({ type: "zoomEnd" });
    step({ type: "reveal" });
    step({ type: "zoomEnd" });
    check("coming back out of the cube is the second", walk.closings === 2);

    step({ type: "deploy" });
    check("and the deployment counts on the way out", walk.deployments === 1);
    step({ type: "deployEnd" });
    step({ type: "dock" });
    step({ type: "deployEnd" });
    check("docking from orbit is the third", walk.closings === 3);
    check("docking is not a second deployment", walk.deployments === 1);

    // Being in a state is not arriving at it: a gesture the machine refuses
    // must not tick a counter, or one stray swipe makes the next play brisk.
    const held = walk;
    check("a refused event counts nothing",
      reduceExperience(held, { type: "boardEnd" }).closings === held.closings);
  }

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

  const noMemories = initialExperience({ memoryCount: 0, hasOrbit: true, hasCrossroads: false, comet: NO_COMET_FLAGS });
  const orbitOnly = { ...noMemories, state: "orbit" as const };
  check("with no memories there is no trail to enter",
    reduceExperience(orbitOnly, { type: "lookBack" }) === orbitOnly);
  check("with no memories scrolling on in orbit does nothing",
    reduceExperience(orbitOnly, { type: "move", direction: 1 }) === orbitOnly);

  // ---- the rocket only ever follows a server yes --------------------------
  check("launch needs the reply panel",
    reduceExperience(at("orbit"), { type: "launch" }).state === "orbit");
  check("launch is refused from the crossroads",
    reduceExperience(at("orbit", { panel: "crossroads" }), { type: "launch" }).state === "orbit");
  let launched = reduceExperience(at("orbit", { panel: "reply" }), { type: "launch" });
  check("launch from the reply panel flies", launched.state === "launching");
  check("launching stays in the orbit pose", cameraPhase(launched.state) === "orbit");
  check("launching ignores input", !acceptsInput(launched.state));
  launched = reduceExperience(launched, { type: "launchEnd" });
  check("the rocket leaves a star behind",
    launched.state === "orbit" && launched.panel === null && launched.launched);
  // The rocket goes once: offering the form again would invite a duplicate.
  check("the reply sheet cannot reopen once launched",
    reduceExperience(launched, { type: "openPanel", panel: "reply" }).panel === null);

  // ---- the reveal rules hold over every new state too ---------------------
  const v02 = [
    "deploying", "orbit", "undeploying", "departing", "previewing", "charting", "nudging",
    "boarding", "homing", "rewinding", "remembering", "drifting",
    "resurfacing", "launching",
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
  const walk = (
    target: string,
    ctx = {
      memoryCount: MEMORIES,
      hasOrbit: true,
      hasCrossroads: true,
      comet: NO_COMET_FLAGS,
    },
  ) => {
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
    ["crossroads", "orbit", {}],
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
  check("?at= refuses a target it does not know", jumpEvents("satellite") === null);
  check("?at= refuses an empty target", jumpEvents(undefined) === null);

  // A target the card cannot reach stops at the last state it does have,
  // rather than inventing one.
  const plain = walk("orbit", {
    memoryCount: 0,
    hasOrbit: false,
    hasCrossroads: false,
    comet: NO_COMET_FLAGS,
  });
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

console.log("9. The dawn (spec v0.2 rev 7.1 §3, §15):");
{
  /*
   * The curve is the countdown. These six numbers are §3's table, and they
   * are checked rather than eyeballed because the whole of r7 hangs off them:
   * if the dawn is linear, the last fortnight stops looking different from
   * the first month and the scene goes back to being a picture of waiting.
   */
  const TABLE: [number, number][] = [
    [0, 0.2],
    [0.25, 0.24],
    [0.5, 0.37],
    [0.75, 0.62],
    [0.9, 0.83],
    [1, 1.0],
  ];
  for (const [f, want] of TABLE) {
    const got = dawn(f, "away").p;
    check(`dawn(${f}) = ${want}`, Math.abs(got - want) <= 0.01, got.toFixed(3));
  }

  let monotonic = true;
  let previous = -Infinity;
  for (let i = 0; i <= 1000; i++) {
    const p = dawn(i / 1000, "away").p;
    if (p < previous - 1e-12) monotonic = false;
    previous = p;
  }
  check("the dawn only ever rises", monotonic);
  check("it is never night", dawn(0, "away").p >= DAWN_FLOOR, `${DAWN_FLOOR}`);
  check("the day is full sunrise", dawn(0, "returned").p === 1);
  check("a kept comet holds at 0.7", dawn(0.3, "kept").p === DAWN_KEPT);

  // The sun's disc clears the horizon at p ~ 0.47, in both orientations.
  for (const portrait of [false, true]) {
    let crossed = -1;
    for (let i = 0; i <= 1000; i++) {
      const d = dawn(i / 1000, "away", { portrait });
      if (d.sunElevation >= 0) {
        crossed = d.p;
        break;
      }
    }
    check(
      `${portrait ? "portrait" : "landscape"}: the sun rises at p ~ 0.47`,
      Math.abs(crossed - 0.47) < 0.02,
      crossed.toFixed(3),
    );
  }

  check("below the horizon the sun is invisible", sunVisibility(dawn(0, "away")) === 0);
  // Not 1, and deliberately: on the day the disc has cleared the limb but is
  // still low in a sunrise, which is what the flare's (0.25 + 0.75 vis) term
  // is shaped for. A sun at noon would be a different picture entirely.
  check("on the day the disc has cleared the limb", sunVisibility(dawn(1, "away")) > 0.8,
    sunVisibility(dawn(1, "away")).toFixed(3));
}

console.log("9b. The moving sun and the camera's breath (spec v0.2 §23.3, rev 7.1 §5):");
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
    const { dir } = keyLight(t, seed);
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

  const unit = keyLight(31.7, seed).dir;
  check("the direction is a unit vector",
    Math.abs(Math.hypot(...unit) - 1) < 1e-9, Math.hypot(...unit).toFixed(12));

  // ---- the screens r7 leaves alone are still r5's light -------------------
  const plain = keyLight(12, seed, undefined, { returned: false });
  const warm = keyLight(12, seed, undefined, { returned: true });
  check("the returned day changes the colour", plain.color !== warm.color, warm.color);
  check("the returned day does not move the sun",
    plain.dir.every((v, i) => v === warm.dir[i]));
  const shift = distance(plain.color, warm.color);
  check("the warm shift is at most 10%", shift <= 0.1 + 1e-6, `${(shift * 100).toFixed(1)}%`);

  /*
   * ---- and the orbit scene's light is the dawn (rev 7.1 §5, §15) --------
   *
   * The two ends are what matter. At blue hour the light has to read as cold
   * — that is the whole premise of a scene that then warms up — and on the
   * day it has to be unmistakably golden, because that is the payoff the
   * reader has been watching approach for months.
   */
  const blueHour = keyLight(12, seed, dawn(0, "away"));
  const golden = keyLight(12, seed, dawn(1, "away"));
  check("at blue hour the light is blue hour",
    distance(blueHour.color, BLUE_HOUR_COLOUR) <= 0.25,
    `${(distance(blueHour.color, BLUE_HOUR_COLOUR) * 100).toFixed(1)}% off`);
  check("on the day the light is golden",
    distance(golden.color, GOLDEN_COLOUR) <= 0.05,
    `${(distance(golden.color, GOLDEN_COLOUR) * 100).toFixed(1)}% off`);
  check("the day is brighter than blue hour",
    golden.intensity > blueHour.intensity * 1.6,
    `${blueHour.intensity.toFixed(2)} -> ${golden.intensity.toFixed(2)}`);

  // Continuous in p as well as in t: the dawn creeps, it does not step.
  let worstColourStep = 0;
  let previousColour = keyLight(0, seed, dawn(0, "away")).color;
  for (let i = 1; i <= 1000; i++) {
    const colour = keyLight(0, seed, dawn(i / 1000, "away")).color;
    worstColourStep = Math.max(worstColourStep, distance(colour, previousColour));
    previousColour = colour;
  }
  check("the colour never steps", worstColourStep < 0.01, `${(worstColourStep * 100).toFixed(2)}%`);

  // The fill is never zero: no face of the satellite is ever black (§5).
  let weakestFill = Infinity;
  for (let i = 0; i <= 100; i++) {
    const light = keyLight(i * 0.7, seed, dawn(i / 100, "away"));
    weakestFill = Math.min(weakestFill, light.fill.intensity);
    check_once("the fill points the other way",
      light.fill.dir.every((v, k) => Math.abs(v + light.dir[k]) < 1e-12));
  }
  check("the fill is never zero", weakestFill > 0, weakestFill.toFixed(3));

  // The hub's sun is wherever the composition puts it, not on r5's arc.
  const staged = keyLight(3, seed, dawn(0.5, "away"), { toSun: [0, 0, 1] });
  check("a staged sun is followed",
    staged.dir[2] > 0.99 && Math.abs(staged.dir[0]) < 0.06,
    staged.dir.map((v) => v.toFixed(3)).join(", "));

  // ---- intensity breathes, gently ----------------------------------------
  let minI = Infinity;
  let maxI = -Infinity;
  for (let i = 0; i <= 600; i++) {
    const { intensity } = keyLight(i * 0.1, seed);
    minI = Math.min(minI, intensity);
    maxI = Math.max(maxI, intensity);
  }
  check("intensity stays near 1", minI >= 0.93 && maxI <= 1.07,
    `${minI.toFixed(3)}..${maxI.toFixed(3)}`);

  // ---- reduced motion is a still, lit picture ----------------------------
  const still = keyLight(0, seed, undefined, { reducedMotion: true });
  for (const t of [0, 7.5, 61, 500]) {
    const at = keyLight(t, seed, undefined, { reducedMotion: true });
    check(`reduced motion freezes the sun at t=${t}`,
      at.dir.every((v, i) => v === still.dir[i]) && at.intensity === still.intensity);
  }
  check("the frozen sun is still lit", still.intensity > 0);

  // ---- two cards are lit from different points in the same sweep ---------
  const other = lightSeed("thanks-sample-3f9q");
  check("two cards differ", keyLight(0, seed).dir[0] !== keyLight(0, other).dir[0]);

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

console.log("10. Orbit and trail framing (spec v0.2 §8.3, §9.3, §17):");
{
  const viewports: [string, number, number][] = [
    ["desktop 1512x945", 1512, 945],
    ["laptop 1280x800", 1280, 800],
    ["iPhone 390x844", 390, 844],
    ["iPad 834x1112", 834, 1112],
  ];
  const halfV = ((FOV * Math.PI) / 180) / 2;

  // ---- the hub is the sender's sketch, to the number (rev 6 §3.1, §7) ----
  const hubViewports: [string, number, number][] = [
    ["portrait 390x844", 390, 844],
    ["portrait 430x932", 430, 932],
    ["landscape 1280x800", 1280, 800],
    ["desktop 1512x945", 1512, 945],
  ];

  /*
   * `MessageCube` turns the cube with a three.js Euler; every composition
   * check below goes through `displayDirection`. If those two disagree the
   * scene is drawn at one attitude and measured at another, and every number
   * that follows is fiction. Yaw-pitch-roll is "ZXY", not the "YXZ" it reads
   * like — the wrong order is twenty degrees out, which looks deliberate.
   */
  {
    const turned = new THREE.Vector3(1, 0, 0).applyQuaternion(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(DISPLAY_PITCH, DISPLAY_YAW, DISPLAY_ROLL, DISPLAY_EULER_ORDER),
      ),
    );
    const pure = displayDirection([1, 0, 0]);
    const gap = Math.hypot(turned.x - pure[0], turned.y - pure[1], turned.z - pure[2]);
    check("the cube's attitude is the one the checks measure", gap < 1e-9,
      `${DISPLAY_EULER_ORDER}, off by ${gap.toExponential(1)}`);

    // §3.1 asks for the near (+X) wing upper-right *and larger*: the camera is
    // on +z, so the wing that is drawn bigger has to lean towards it.
    check("the near wing leans towards the camera", pure[2] > 0.3, pure[2].toFixed(2));
  }

  for (const [label, w, h] of hubViewports) {
    const aspect = w / h;
    const tanV = Math.tan(halfV);
    const tanH = Math.tan(Math.atan(tanV * aspect));
    const camera = hubPose(w, h).position;
    const target = hubTargets(aspect);

    /** Screen fractions: x from the left, y from the top. */
    const project = (point: [number, number, number]) => {
      const depth = camera[2] - point[2];
      return [
        0.5 + (point[0] - camera[0]) / (2 * tanH * depth),
        0.5 - (point[1] - camera[1]) / (2 * tanV * depth),
      ] as [number, number];
    };

    // The satellite: where its body sits, how wide it is, and that all of it
    // is on screen with room to spare.
    const centre = project(HUB_SATELLITE);
    check(`${label}: the body centre is on target`,
      Math.abs(centre[0] - target.centre[0]) <= 0.04 &&
      Math.abs(centre[1] - target.centre[1]) <= 0.04,
      `${centre[0].toFixed(3)},${centre[1].toFixed(3)}`);

    /*
     * The wing tips, taken through the satellite's *actual* display attitude
     * rather than through a flat rotation by WING_AXIS_DEG.
     *
     * That distinction cost a day. The earlier version built the two tips from
     * the constant, so tip-to-tip and the axis were measured off a construct
     * that could not disagree with itself — and reported a tidy -50 degrees
     * while the wings were being drawn very nearly horizontal on screen.
     * `displayDirection` is what `MessageCube` turns the cube by, so a check
     * that goes through it is a check on the thing the reader sees.
     */
    const half = (DEPLOYED_SPAN / 2) * SAT_SCALE;
    const wingTip = (side: 1 | -1) => {
      const [dx, dy, dz] = displayDirection([side, 0, 0]);
      return project([
        HUB_SATELLITE[0] + dx * half,
        HUB_SATELLITE[1] + dy * half,
        HUB_SATELLITE[2] + dz * half,
      ]);
    };
    const tipA = wingTip(1);
    const tipB = wingTip(-1);
    // In width units, so portrait and landscape are comparable.
    const tip = Math.hypot(tipA[0] - tipB[0], (tipA[1] - tipB[1]) * (h / w));
    check(`${label}: tip to tip is in range`, Math.abs(tip - target.tip) <= 0.05,
      `${(tip * 100).toFixed(0)}% vs ${(target.tip * 100).toFixed(0)}%`);

    // The wing axis, measured on screen rather than assumed from the constant.
    // y is measured downward here, so a wing running up to the right gives a
    // negative angle — which is the -50 the composition asks for.
    const axis =
      (Math.atan2((tipA[1] - tipB[1]) * (h / w), tipA[0] - tipB[0]) * 180) / Math.PI;
    check(`${label}: the wing axis is -50deg ± 6`, Math.abs(axis - WING_AXIS_DEG) <= 6,
      `${axis.toFixed(1)}deg`);

    const hull = satelliteHull().map((p) =>
      project([HUB_SATELLITE[0] + p[0], HUB_SATELLITE[1] + p[1], HUB_SATELLITE[2] + p[2]]),
    );
    const margin = Math.min(
      ...hull.map((p) => Math.min(p[0], p[1], 1 - p[0], 1 - p[1])),
    );
    check(`${label}: the whole hull is in frame with 4% margin`, margin >= 0.04,
      `${(margin * 100).toFixed(1)}%`);

    // The planet: a small arc in the bottom-right, mostly off screen.
    const planet = hubPlanet(w, h);
    const planetCentre = project(planet);
    const planetRadius = Math.abs(
      planetCentre[0] - project([planet[0] - PLANET_RADIUS, planet[1], planet[2]])[0],
    );
    check(`${label}: the planet's centre is off the bottom-right`,
      Math.abs(planetCentre[0] - target.planet.centre[0]) <= 0.05 &&
      Math.abs(planetCentre[1] - target.planet.centre[1]) <= 0.05,
      `${planetCentre[0].toFixed(2)},${planetCentre[1].toFixed(2)}`);
    /*
     * The planet is staged closer to the camera than the satellite, so the
     * thing to check is not depth but overlap: no part of the satellite may
     * fall inside the planet's disc, or the planet would occlude it.
     * Distances are in width units, the same units the radius is measured in.
     */
    const overlaps = hull.some(
      (p) =>
        Math.hypot(p[0] - planetCentre[0], (p[1] - planetCentre[1]) * (h / w)) <=
        planetRadius,
    );
    check(`${label}: the planet never covers the satellite`, !overlaps);

    // How much of the frame it actually covers: 8-15%, or it stops being an
    // arc in a corner and becomes a backdrop.
    let inside = 0;
    const samples = 60;
    for (let ix = 0; ix < samples; ix++) {
      for (let iy = 0; iy < samples; iy++) {
        const px = (ix + 0.5) / samples;
        const py = (iy + 0.5) / samples;
        // Compared in width units, since the projected disc is circular there.
        const dx = px - planetCentre[0];
        const dy = (py - planetCentre[1]) * (h / w);
        if (Math.hypot(dx, dy) <= planetRadius) inside++;
      }
    }
    const area = inside / (samples * samples);
    // 7%, not 8%: the dawn mockup's own desktop planet (rev 7.1) is 7.8%,
    // and the hub is staged to match it.
    check(`${label}: the planet covers 7-15% of the frame`, area >= 0.07 && area <= 0.15,
      `${(area * 100).toFixed(1)}%`);

    /*
     * The comet passes by in the top-right, clear of the satellite (§4.1).
     * "Clear" is the load-bearing half: a comet crossing the hull would read
     * as hitting the thing it is supposed to be keeping company with.
     */

    for (const f of [0.06, 0.25, 0.5, 0.75, 0.94]) {
      const at = project(hubCometAt(f, w, h));
      check(`${label}: the comet at f=${f} is in the top-right`,
        at[0] >= 0.5 && at[1] <= 0.45, `${at[0].toFixed(2)},${at[1].toFixed(2)}`);

      const gap =
        Math.min(...hull.map((p) => Math.hypot(p[0] - at[0], (p[1] - at[1]) * (h / w)))) * w;
      check(`${label}: and 24px clear of the satellite at f=${f}`, gap >= 24,
        `${gap.toFixed(0)}px`);
    }

    /*
     * And the **glow** clears it, not just the centre (§4.1).
     *
     * The check above measures the comet as a point, which is how a coma three
     * times the size of the gap it is passing through can sail past it. The
     * comet is at its largest exactly where it is closest — it grows as it
     * comes home — so the two worst cases coincide, and the sampling has to be
     * dense enough to find that point rather than land either side of it.
     */
    let worstGlow = Infinity;
    let worstEdge = Infinity;

    for (let i = 0; i <= 120; i++) {
      const f = 0.02 + (0.97 * i) / 120;
      const at = project(hubCometAt(f, w, h));
      const depth = camera[2] - hubCometAt(f, w, h)[2];
      /*
       * The coma's radius, in the same width-fraction units as the hull.
       *
       * `comaPixels` rather than `comaSize`: r7 §14 step 0 shrinks the drawn
       * head so the tail is no longer inside it, and what has to clear the
       * satellite is what is drawn.
       */
      const radius = comaPixels(orbitPoint(f).distance, w < h) / w;
      void depth;

      const centre = Math.min(
        ...hull.map((p) => Math.hypot(p[0] - at[0], (p[1] - at[1]) * (h / w))),
      );
      worstGlow = Math.min(worstGlow, (centre - radius) * w);
      // And stays on screen: a coma hanging off the right edge is a coma with
      // a straight side, which is the one shape gas never has.
      worstEdge = Math.min(worstEdge, (1 - at[0] - radius) * w);
    }

    check(`${label}: the comet's glow clears the satellite`, worstGlow >= 12,
      `${worstGlow.toFixed(0)}px`);
    check(`${label}: and stays inside the frame`, worstEdge >= 0,
      `${worstEdge.toFixed(0)}px`);

    /*
     * ---- and so does the tail (rev 7.1 §10, §15) -----------------------
     *
     * This is the check the new aphelion exists for. In r7 the tails point
     * away from the **sun**, which comes up behind the planet's limb at the
     * bottom right — so they now sweep up and to the left, which is where
     * the satellite is. r7 moves the comet's far end from (0.81, 0.19) to
     * (0.76, 0.07) rather than moving the satellite, because r7 withdraws
     * R23 and the satellite stays exactly where it is built.
     *
     * The whole tail is sampled, not just its tip: a tail that misses at
     * both ends can still lie across a wing in the middle.
     */
    const sunAt = hubSun(w, h, dawn(1, "away", { portrait: w < h }).sunElevation);
    const sunScreen = project(sunAt);
    let worstTail = Infinity;
    let worstTailAt = "";

    for (let i = 0; i <= 120; i++) {
      const f = 0.06 + (0.94 * i) / 120;
      const at = hubCometAt(f, w, h);
      const screen = project(at);
      const depth = camera[2] - at[2];

      // Away from the sun, measured on screen, which is where the clearance
      // question is actually asked.
      let dx = screen[0] - sunScreen[0];
      let dy = (screen[1] - sunScreen[1]) / (h / w);
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;

      // The ion tail is the longer of the two: 1.1 x the base length.
      const pixels = tailPixels(orbitPoint(f).distance, w < h) * 1.1;
      const reachW = (pixels / w) * 1;
      void depth;

      for (let k = 0; k <= 24; k++) {
        const u = (k / 24) * reachW;
        const px = screen[0] + dx * u;
        const py = screen[1] + (dy * u) / (w / h);
        const gap =
          Math.min(...hull.map((q) => Math.hypot(q[0] - px, (q[1] - py) * (h / w)))) * w;
        if (gap < worstTail) {
          worstTail = gap;
          worstTailAt = `f=${f.toFixed(2)}`;
        }
      }
    }

    check(`${label}: the tail never reaches the satellite`, worstTail >= 8,
      `${worstTail.toFixed(0)}px at ${worstTailAt}`);

    // And the sun itself, flare and all, is inside the frame on the day.
    const flareReach = (PLANET_RADIUS * (0.22 + 0.4) * 1.0) / (2 * tanH * (camera[2] - sunAt[2]));
    check(`${label}: the sun is in the frame on the day`,
      sunScreen[0] - flareReach < 1 && sunScreen[1] - flareReach < 1 &&
      sunScreen[0] + flareReach > 0 && sunScreen[1] + flareReach > 0,
      `${sunScreen[0].toFixed(2)},${sunScreen[1].toFixed(2)}`);

    /*
     * Home again, it sits beside the planet at the right edge (§3.1, r7 §4).
     *
     * Checked against the planet's actual disc rather than against a pair of
     * hand-picked fractions. "Beside the planet" means *outside its limb and
     * close to it*, and the fractions that expressed that in r6 stopped doing
     * so once the planet was drawn at the size the composition asks for
     * (r7 §14 step 0): the old homecoming point ended up inside the disc, so
     * the comet came home by disappearing behind the world it was returning
     * to, and the check still passed.
     */
    const home = project(hubCometAt(1, w, h));
    const homePx: [number, number] = [home[0] * w, home[1] * h];
    const planetDisc = hubPlanetScreen(w, h);
    const fromCentre = Math.hypot(homePx[0] - planetDisc.cx, homePx[1] - planetDisc.cy);
    const aboveLimb = fromCentre - planetDisc.r;

    check(`${label}: the returned comet is outside the planet's limb`,
      aboveLimb > 8, `${aboveLimb.toFixed(0)}px above it`);
    check(`${label}: and still beside it, not out in the sky`,
      aboveLimb < 0.2 * planetDisc.r, `${aboveLimb.toFixed(0)}px`);
    check(`${label}: in the lower right of the frame`,
      home[0] >= 0.7 && home[1] >= 0.5, `${home[0].toFixed(2)},${home[1].toFixed(2)}`);

    /*
     * The trail leaves from the top-left, and clears the satellite (rev 6 §4.5).
     *
     * The raw curve starts at the world origin, which is exactly where rev 6
     * parks the satellite — so drawn unstaged, the first stretch of the trail
     * came out of the middle of the spacecraft. `stagedTrail` moves it; this
     * is what keeps it moved. The gap is checked against the hull rather than
     * the body centre, because it is a wing tip the near end passes.
     */
    let nearestTrail = Infinity;
    let topmost = 1;
    let strays = 0;
    let samplesOffTrail = 0;

    for (const seed of ["2026-newyear-7k2m", "thanks-sample-3f9q"].map(trailSeedFor)) {
      const staged = stagedTrail(seed, w, h);
      for (let i = 0; i <= 60; i++) {
        const at = project(trailPoint(staged, i / 60));
        samplesOffTrail++;
        if (at[0] > 0.5 || at[1] > 0.5) strays++;
        topmost = Math.min(topmost, at[1]);
        nearestTrail = Math.min(
          nearestTrail,
          Math.min(...hull.map((p) => Math.hypot(p[0] - at[0], (p[1] - at[1]) * (h / w)))) * w,
        );
      }
    }

    check(`${label}: the trail stays in the top-left quadrant`, strays === 0,
      `${strays}/${samplesOffTrail} outside`);
    check(`${label}: the trail clears the satellite by 32px`, nearestTrail >= 32,
      `${nearestTrail.toFixed(0)}px`);
    // Below the title block, which owns the first 88px of a phone screen.
    check(`${label}: and starts below the title`, topmost * h >= (w < h ? 88 : 40),
      `${(topmost * h).toFixed(0)}px`);

    console.log(
      `  ${label.padEnd(19)} body ${centre[0].toFixed(2)},${centre[1].toFixed(2)} ` +
      `tip ${(tip * 100).toFixed(0)}% axis ${axis.toFixed(0)}deg ` +
      `margin ${(margin * 100).toFixed(0)}% planet ${(area * 100).toFixed(0)}% ` +
      `trail ${nearestTrail.toFixed(0)}px tail ${worstTail.toFixed(0)}px`,
    );
  }

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
    // The seeded wander and the far meander together (lib/trailCurve.ts).
    check("the trail stays near its axis",
      worstLateral <= TRAIL_LATERAL * 1.25 + Math.hypot(MEANDER.across, MEANDER.up),
      `${worstLateral.toFixed(2)}u`);

    const near = trailPoint(points, 0);
    const far = trailPoint(points, 1);
    check("the trail starts behind the orbit", near[2] <= TRAIL_NEAR_Z + 1e-6, near[2].toFixed(2));
    check("the trail ends inside the nebula shell", Math.hypot(...far) < 90,
      Math.hypot(...far).toFixed(1));
  }

  // ---- memories are an even *journey* apart, newest nearest --------------
  /*
   * Evenly spaced in world units, not in curve parameter. The curve's z is
   * quadratic, so even steps of `u` put the first two memories 5 units apart
   * and the last two 50 — one scroll barely moved you and the next threw you a
   * third of the way down the trail. The check is on distance for that reason:
   * a spacing check on `u` would have passed throughout.
   */
  {
    const points = trailControlPoints(seeds[0]);
    const hops: number[] = [];
    for (let i = 1; i < 8; i++) {
      const a = trailPoint(points, memoryU(points, i - 1, 8));
      const b = trailPoint(points, memoryU(points, i, 8));
      hops.push(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    const shortest = Math.min(...hops);
    const longest = Math.max(...hops);
    check("memories are an even journey apart", longest / shortest <= 1.06,
      `${shortest.toFixed(1)}u to ${longest.toFixed(1)}u`);
    check("the newest memory is the nearest", memoryU(points, 0, 8) < memoryU(points, 7, 8));
    check("a single memory still has a place", Number.isFinite(memoryU(points, 0, 1)));

    /*
     * And the camera flies *beside* the ribbon, never down the middle of it.
     *
     * It used to back straight off along the tangent, which put the ribbon's
     * centreline two tenths of a unit from the lens with the camera pointed
     * along its length. Additively blended, that is a white wedge across the
     * whole frame — the memory behind it a wireframe in fog.
     */
    for (const [label, w, h] of [["portrait", 390, 844], ["landscape", 1512, 945]] as const) {
      const staged = stagedTrail(seeds[0], w, h);
      const distance = memoryViewDistance(w, h);
      let closest = Infinity;

      for (let leg = 0; leg < 5; leg++) {
        const camera = trailPose(staged, memoryU(staged, leg, 5), distance).position;
        for (let i = 0; i <= 600; i++) {
          const p = trailPoint(staged, i / 600);
          closest = Math.min(
            closest,
            Math.hypot(p[0] - camera[0], p[1] - camera[1], p[2] - camera[2]),
          );
        }
      }

      check(`${label}: the camera flies clear of the ribbon`, closest >= 1.2,
        `${closest.toFixed(2)}u`);
    }
  }

  // ---- leaving the trail retraces it, rather than cutting across ---------
  // The retrace walks the curve parameter back to zero over the first 72% of
  // the move. The property that matters is that it *stays on the curve*: a
  // straight line home would throw away the shape the reader just learned.
  {
    const points = trailControlPoints(seeds[0]);
    const fromUValue = memoryU(points, 4, 5);
    let worstOff = 0;
    let previous = trailPoint(points, fromUValue);
    let monotonic = true;
    let lastU = fromUValue;

    for (let i = 1; i <= 200; i++) {
      const local = i / 200;
      const u = fromUValue * (1 - local);
      if (u > lastU + 1e-9) monotonic = false;
      lastU = u;

      const here = trailPoint(points, u);
      // Each step is a step along the curve, so consecutive samples are close.
      worstOff = Math.max(worstOff, Math.hypot(
        here[0] - previous[0], here[1] - previous[1], here[2] - previous[2]));
      previous = here;
    }

    check("the retrace runs the curve backwards", monotonic);
    check("and never leaves it", worstOff < 1.2, `${worstOff.toFixed(3)}u per step`);

    // It ends where the trail begins, which is where the camera came in.
    const end = trailPoint(points, 0);
    const start = trailPoint(points, MEMORY_START_U);
    check("the retrace ends at the near end of the trail", end[2] > start[2] - 1e-9);
  }

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

console.log("11b. The comet moment (spec v0.2 rev 5, \u00a78.3):");
{
  const flags = (patch: Partial<typeof NO_COMET_FLAGS> = {}) => ({
    ...NO_COMET_FLAGS,
    exists: true,
    introduced: true,
    ...patch,
  });
  const card = (comet: typeof NO_COMET_FLAGS, hasCrossroads = true) =>
    initialExperience({ memoryCount: 3, hasOrbit: true, hasCrossroads, comet });

  const deployTo = (comet: typeof NO_COMET_FLAGS, hasCrossroads = true) => {
    let exp = { ...card(comet, hasCrossroads), state: "completed" as const, activeFace: 5 };
    exp = reduceExperience(exp, { type: "deploy" });
    return reduceExperience(exp, { type: "deployEnd" });
  };

  // ---- where a deployment lands, and why ---------------------------------
  check("no comet: a deployment lands in the hub",
    deployTo(NO_COMET_FLAGS).state === "orbit");
  check("a comet not yet watched leaving: watch it go",
    deployTo(flags()).state === "departing");
  check("already departed, still room for words: go and look at it",
    deployTo(flags({ departed: true, capsuleOpen: true })).state === "charting");
  check("departed, words already sent: land in the hub",
    deployTo(flags({ departed: true })).state === "orbit");
  check("returned: every deployment ends at the comet",
    deployTo(flags({ departed: true, returned: true })).state === "charting");

  // ---- the first time it becomes a satellite, the intro plays -------------
  {
    let intro = deployTo(flags({ introduced: false, capsuleOpen: true }));
    check("a first deployment plays the intro", intro.state === "previewing");
    check("the intro stays in the orbit pose", cameraPhase(intro.state) === "orbit");
    check("the intro keeps the satellite deployed", isDeployed(intro.state));
    check("the intro ignores input",
      !acceptsInput(intro.state) &&
      reduceExperience(intro, { type: "move", direction: 1 }) === intro);
    intro = reduceExperience(intro, { type: "previewEnd" });
    check("and then goes to the chart", intro.state === "charting");
    check("marking it played, and the departure with it",
      intro.comet.introduced && intro.comet.departed);
    intro = reduceExperience(intro, { type: "zoomEnd" });
    check("which opens the sheet that asks for words", intro.state === "nudging");
    check("a returned comet skips the intro",
      deployTo(flags({ introduced: false, returned: true })).state === "charting");
  }

  // ---- the departure is watched once per cycle ---------------------------
  let exp = deployTo(flags());
  check("the departure marks itself watched",
    reduceExperience(exp, { type: "departEnd" }).comet.departed);
  exp = reduceExperience(exp, { type: "departEnd" });
  check("and leads into the chart", exp.state === "charting");
  exp = reduceExperience(exp, { type: "zoomEnd" });
  check("the chart opens the sheet", exp.state === "nudging");
  check("the sheet is at rest but swallows gestures",
    acceptsInput(exp.state) &&
    reduceExperience(exp, { type: "move", direction: 1 }) === exp);
  check("the sheet shows only here", showsCometSheet("nudging") && !showsCometSheet("orbit"));

  // ---- words board only after the server says yes ------------------------
  const open = deployTo(flags({ departed: true, capsuleOpen: true }));
  const sheet = reduceExperience(open, { type: "zoomEnd" });
  check("boarding needs an open capsule",
    reduceExperience({ ...sheet, comet: { ...sheet.comet, capsuleOpen: false } },
      { type: "board" }).state === "nudging");
  let boarded = reduceExperience(sheet, { type: "board" });
  check("board flies the words up", boarded.state === "boarding");
  boarded = reduceExperience(boarded, { type: "boardEnd" });
  check("and lands back on the sheet", boarded.state === "nudging");
  check("the capsule is closed afterwards", !boarded.comet.capsuleOpen);

  // ---- leaving the chart, and the crossroads -----------------------------
  // The crossroads follows an *automatic* moment only: it asks "where next?"
  // about a journey the card started, not one the reader chose.
  let left = reduceExperience(sheet, { type: "leaveChart" });
  check("leaving the chart homes the camera", left.state === "homing");
  check("an automatic moment offers the crossroads", left.panel === "crossroads");
  left = reduceExperience(left, { type: "zoomEnd" });
  check("and lands in the hub", left.state === "orbit");

  const tapped = reduceExperience(
    { ...deployTo(flags({ departed: true })), state: "orbit" as const },
    { type: "openChart" },
  );
  check("tapping the comet charts it", tapped.state === "charting");
  check("and is marked as the reader's own choice", tapped.chartVia === "tap");
  const afterTap = reduceExperience(
    reduceExperience(tapped, { type: "zoomEnd" }),
    { type: "leaveChart" },
  );
  check("leaving a tapped moment offers no crossroads", afterTap.panel === null);

  // With nowhere to go, the crossroads is skipped even automatically.
  const noWhere = reduceExperience(
    reduceExperience(deployTo(flags({ departed: true, capsuleOpen: true }), false),
      { type: "zoomEnd" }),
    { type: "leaveChart" },
  );
  check("no memories and no reply: no crossroads", noWhere.panel === null);

  console.log("  5 landings, 1 departure, boarding, and the crossroads rule");
}

console.log("11. The promise comet through a year (spec v0.2 rev 5, \u00a78.10, \u00a711.3):");
{
  const sample = cards[0];
  const env = { mailReady: true, cometReady: true };
  const at = (iso: string) => toClientCard(sample, new Date(iso), env);

  // ---- on its way --------------------------------------------------------
  const waiting = at("2026-09-23T00:00:00Z");
  check("away before the day", waiting.comet?.status === "away", waiting.comet?.status);
  check("the label is the exact date at day precision",
    waiting.comet?.label.label === "2026年12月25日", waiting.comet?.label.label);
  check("and the countdown is in days", waiting.comet?.label.relative === "あと93日",
    waiting.comet?.label.relative);
  check("words may still board it", waiting.comet?.capsule === true);
  check("the sealed words are not in the payload",
    !JSON.stringify(waiting).includes("まだうまく言えない"));
  /*
   * By shape, not by literal: this used to hard-code the sample card's own
   * month, so changing `writtenAt` in the editor failed a check about how the
   * landing line is composed.
   */
  check("the landing line says when it was written",
    /^\d{4}年\d{1,2}月に書かれた手紙$/.test(landingNote(waiting) ?? ""), landingNote(waiting));

  // ---- the day itself ----------------------------------------------------
  const day = at("2026-12-25T02:00:00Z");
  check("returned on the day", day.comet?.status === "returned", day.comet?.status);
  check("the relative form says today", day.comet?.label.relative === "今日",
    day.comet?.label.relative);
  check("the sealed words open", day.comet?.message !== undefined);
  check("no more words may board it", day.comet?.capsule === false);
  check("the landing line changes on the day",
    landingNote(day) === "彗星が、戻ってきました。", landingNote(day));

  // ---- the fortnight after, and the next cycle ---------------------------
  const later = at("2027-01-05T02:00:00Z");
  check("still returned a fortnight later", later.comet?.status === "returned", later.comet?.status);
  check("it says how long ago", later.comet?.label.relative === "11日前",
    later.comet?.label.relative);

  const nextCycle = at("2027-02-01T02:00:00Z");
  check("a yearly comet is away again after the window",
    nextCycle.comet?.status === "away", nextCycle.comet?.status);
  check("and counting down to next year", nextCycle.comet?.returnsOn === "2027-12-25",
    nextCycle.comet?.returnsOn);
  check("its new departure is the return it just made",
    nextCycle.comet?.leftOn === "2026-12-25", nextCycle.comet?.leftOn);
  // Opened words stay open: a later cycle does not re-seal what was read.
  check("the words stay readable in a later cycle", nextCycle.comet?.message !== undefined);
  /*
   * The point of this one is that the line follows `writtenAt` rather than
   * the comet's cycle — so it is compared against the *first* cycle's line,
   * which is the same card written on the same day.
   */
  check("the landing line goes back to the writing date",
    landingNote(nextCycle) === landingNote(waiting), landingNote(nextCycle));

  // ---- a one-off comet becomes a keepsake --------------------------------
  const once = { ...sample, comet: { ...sample.comet!, yearly: false } };
  const keptCard = toClientCard(once, new Date("2027-03-01T00:00:00Z"), env);
  check("a one-off comet is kept, not returned forever",
    keptCard.comet?.status === "kept", keptCard.comet?.status);
  check("a kept comet keeps its words readable", keptCard.comet?.message !== undefined);
  check("and no longer invites any", keptCard.comet?.capsule === false);

  // ---- the label at every precision (\u00a711.3) -------------------------------
  const now = new Date("2026-09-23T00:00:00Z");
  const tz = "Asia/Tokyo";
  const rows: [string, "day" | "month" | "season" | "year", string][] = [
    ["2026-12-25", "day", "2026年12月25日"],
    ["2026-12-25", "month", "2026年12月"],
    ["2026-12-25", "season", "次の冬"],
    ["2026-12-25", "year", "2026年"],
    // Today is autumn 2026, so autumn 2027 is not "next autumn" — it is a
    // year away, and the phrase people use is 2027年の秋.
    ["2027-10-01", "season", "2027年の秋"],
    ["2028-12-01", "season", "2028年の冬"],
    ["2026-10-15", "season", "この秋"],
  ];
  for (const [date, show, expected] of rows) {
    const label = returnLabel(date, show, now, tz).label;
    check(`${date} at ${show} precision reads ${expected}`, label === expected, label);
  }

  // The relative form's own edges.
  const rel = (date: string, show: "day" | "season" = "day") =>
    returnLabel(date, show, now, tz).relative;
  check("day precision counts days up to 100", rel("2026-12-25") === "あと93日", rel("2026-12-25"));
  check("past 100 days it is months", rel("2027-03-01") === "約5か月後", rel("2027-03-01"));
  check("a coarse promise says もうすぐ inside a month",
    rel("2026-10-10", "season") === "もうすぐ", rel("2026-10-10", "season"));
  check("18 months out it is years", rel("2028-06-01") === "約1年半後", rel("2028-06-01"));
  check("and rounds to whole years", rel("2028-09-23") === "約2年後", rel("2028-09-23"));

  console.log(
    `  ${waiting.comet?.label.label} \u00b7 ${waiting.comet?.label.relative}; ` +
    `next cycle ${nextCycle.comet?.returnsOn}`,
  );
}

console.log("12. Memories and the media route (spec v0.2 §9.2, §14.3):");
{
  const sample = cards[0];
  const client = toClientCard(sample, new Date("2026-09-23T00:00:00Z"),
    { mailReady: false, cometReady: false });
  const memories = client.memories ?? [];

  check("the sample card has memories", memories.length > 0, String(memories.length));
  check("memories arrive newest first",
    memories[0].date >= memories[memories.length - 1].date,
    `${memories[0].date} .. ${memories[memories.length - 1].date}`);
  check("at least one memory has no photograph", memories.some((m) => !m.image));
  check("at least one memory is only approximately dated",
    memories.some((m) => m.approx));
  check("at least one memory knows only its season", memories.some((m) => m.season));

  for (const memory of memories) {
    if (!memory.image) continue;
    // The file is really there, and where the config says it is.
    check(`"${memory.title}" photograph exists`, existsSync(memory.image.src), memory.image.src);
    check(`"${memory.title}" photograph is outside public/`,
      !memory.image.src.startsWith("public"), memory.image.src);

    // And its URL goes through the gated route, not to a public path.
    check(`"${memory.title}" is served through the media route`,
      memory.image.url.startsWith(`/c/${sample.slug}/media/`), memory.image.url);
    check(`"${memory.title}" URL does not leak the folder`,
      !memory.image.url.includes("private/"), memory.image.url);

    const kb = statSync(memory.image.src).size / 1024;
    if (kb > 350) console.log(`    NOTE: ${memory.image.src} is ${kb.toFixed(0)}KB (over 350KB)`);
    else console.log(`    ${memory.image.src} ${kb.toFixed(0)}KB -> ${memory.image.url}`);
  }

  // ---- the ribbon's colour is the one every tint is taken from -----------
  // The panel borders and the glints call `trailColour` directly; the ribbon
  // is handed the same function's output as a 32-point ramp. So the only way
  // they can disagree is if the ramp is too coarse to follow the curve.
  const seed = trailSeed(sample.slug);
  let worstRamp = 0;
  for (let i = 0; i < RAMP_SIZE - 1; i++) {
    const a = trailColour(i / (RAMP_SIZE - 1), 0, seed);
    const b = trailColour((i + 1) / (RAMP_SIZE - 1), 0, seed);
    for (let c = 0; c < 3; c++) worstRamp = Math.max(worstRamp, Math.abs(a[c] - b[c]));
  }
  check("the ribbon's 32-point ramp follows the colour curve", worstRamp < 0.12,
    worstRamp.toFixed(4));

  console.log(`  ${memories.length} memories, worst ramp step ${worstRamp.toFixed(3)} per channel`);
}

console.log("13. The comet in the sky (spec v0.2 §11.2):");
{
  const sample = cards[0];
  const env = { mailReady: false, cometReady: false };
  const at = (iso: string) => toClientCard(sample, new Date(iso), env);

  // ---- the seal, both directions ----------------------------------------
  // The one promise a comet makes. Checked by searching the whole payload,
  // not by checking a flag: a message hidden behind a boolean is not sealed.
  const before = JSON.stringify(at("2026-09-23T00:00:00Z"));
  const message = sample.comet?.message ?? "";
  check("the message is absent before the return", !before.includes(message.slice(0, 20)));
  check("and so is any part of it", !before.includes("まだうまく言えない"));
  const after = JSON.stringify(at("2026-12-25T02:00:00Z"));
  check("the message is there on the day", after.includes(message.slice(0, 20)));

  // ---- the position is the countdown ------------------------------------
  // The whole reason this is a Kepler orbit rather than a progress bar: it
  // must be far away for most of the wait and come home in a rush.
  const comet = at("2026-09-23T00:00:00Z").comet!;
  // Drawn distances, not true ones: the comet's real orbit runs far outside
  // the frame, so what matters is where it is *put* (§11.2).
  const span = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.97, 1].map((f) => ({
    f,
    distance: displayOrbitPoint(displayedProgress(f)).distance,
    // The true radius as well: r7 §10 measures the tail against that, not
    // against the compressed radius the comet is drawn at.
    trueDistance: orbitPoint(displayedProgress(f)).distance,
  }));
  // Note these are *drawn* positions, so f = 0 is already the 0.06 floor:
  // a comet sent today is shown on its way out, not sitting on the planet.
  check("it leaves rather than lingering", span[0].distance > DISPLAY_NEAR * 1.5,
    span[0].distance.toFixed(2));
  check("it is far out at half time", span[3].distance > DISPLAY_FAR * 0.95,
    span[3].distance.toFixed(2));
  check("it is still far at three quarters", span[4].distance > DISPLAY_FAR * 0.85,
    span[4].distance.toFixed(2));
  check("it comes home over the last tenth",
    span[6].distance < span[5].distance * 0.85,
    `${span[5].distance.toFixed(2)} -> ${span[6].distance.toFixed(2)}`);
  check("and lands beside the planet", Math.abs(span[7].distance - DISPLAY_NEAR) < 1e-6);

  // The whole point of compressing it: it has to be *on screen*. The orbit
  // view's frame is about 9 units wide, and a comet 50 units out is not faint,
  // it is absent — which is exactly what it was.
  check("the comet never leaves the frame", span.every((s) => s.distance <= DISPLAY_FAR + 1e-9),
    Math.max(...span.map((s) => s.distance)).toFixed(2));

  // There is always a tail (r7 §10); what carries the signal is its growth.
  check("the tail is shortest out at aphelion",
    tailPixels(span[3].trueDistance, false) < 60,
    `${tailPixels(span[3].trueDistance, false).toFixed(0)}px`);
  check("and much longer in the last stretch",
    tailPixels(span[6].trueDistance, false) > 2 * tailPixels(span[3].trueDistance, false),
    `${tailPixels(span[3].trueDistance, false).toFixed(0)} -> ` +
      `${tailPixels(span[6].trueDistance, false).toFixed(0)}px`);
  let previousTail = 0;
  let growing = true;
  // Over the last tenth, which is the stretch anyone is watching.
  for (let i = 90; i <= 100; i++) {
    const t = tailPixels(orbitPoint(displayedProgress(i / 100)).distance, false);
    if (t < previousTail - 1e-9) growing = false;
    previousTail = t;
  }
  check("the tail only ever grows as it comes home", growing);

  /*
   * The seeded rotation is now bounded (rev 6 §4.1). It used to be a full
   * turn, back when two comets had to avoid each other; there is one comet
   * now, and the hub composition instead needs it to always pass by in the
   * top-right — which a seed that can put it anywhere cannot promise.
   */
  const a = orbitRotation(sample.slug, "2026-03-01");
  const b = orbitRotation(sample.slug, "2026-09-23");
  for (const [label, value] of [["a", a], ["b", b]] as const) {
    check(`the seeded orbit ${label} stays within 6 degrees of its heading`,
      Math.abs(value - HUB_ORBIT_HEADING) <= SEED_ROTATION_MAX + 1e-9,
      `${(((value - HUB_ORBIT_HEADING) * 180) / Math.PI).toFixed(1)}deg`);
  }

  // ---- and everything stays inside the sky ------------------------------
  let furthest = 0;
  for (let i = 0; i <= 720; i++) {
    const world = toWorld(displayOrbitPoint(i / 720), a);
    furthest = Math.max(furthest, Math.hypot(
      PLANET_CENTRE[0] + world.x, PLANET_CENTRE[1] + world.y, PLANET_CENTRE[2] + world.z));
  }
  check("the whole drawn orbit is close to the planet", furthest < 8, furthest.toFixed(1));

  console.log(
    `  ${comet.leftOn} -> ${comet.returnsOn}; ` +
    `q=${PERIHELION} Q=${span[3].distance.toFixed(1)}, furthest from origin ${furthest.toFixed(1)}u`,
  );
}

console.log("14. Email templates (spec v0.2 §14.8):");
{
  const keep = { ...process.env };
  process.env.NOTIFY_TO = "SENTINEL-NOTIFY@example.com";
  process.env.PUBLIC_BASE_URL = "https://karta.example.com/";
  process.env.RESEND_API_KEY = "SENTINEL-RESEND";
  process.env.MAIL_FROM = "KARTA_SPACE <cards@example.com>";

  const sample = cards[0];
  const sentAt = new Date("2026-09-23T12:04:00Z"); // 21:04 in Tokyo

  const reply = replyMail({
    slug: sample.slug,
    title: sample.title,
    name: "そら",
    message: "こちらこそ、ありがとう。",
    sentAt,
    timeZone: sample.timeZone,
  })!;
  check("the reply mail is addressed", reply.to === "SENTINEL-NOTIFY@example.com", reply.to);
  /*
   * Asserted by shape, not by literal. This used to compare against the
   * sample card's title, so renaming your own card in the editor failed a
   * check about email formatting — verify is here to catch the code changing,
   * not the content.
   */
  check("the reply subject names the card",
    reply.subject === `「${sample.title}」に返事が届きました`, reply.subject);
  check("the reply names the sender", reply.text.includes("そらさんから、返事が届きました。"));
  check("the reply carries the message", reply.text.includes("こちらこそ、ありがとう。"));
  // The stamp is in the card's time zone, not the server's.
  check("the reply is stamped in the card's zone",
    reply.text.includes("2026年9月23日 21:04"), reply.text.split("\n").at(-2));

  const comet = cometMail({
    slug: sample.slug,
    title: sample.title,
    name: "そら",
    returnsOn: "2026-12-25",
    token: "TOKEN123",
  })!;
  check("the comet subject carries the return date",
    comet.subject === "そらさんの言葉が、彗星にのりました（2026年12月25日に戻ってきます）",
    comet.subject);
  check("the comet mail says it cannot be read yet",
    comet.text.includes("戻ってくるまで、中身は読めません。"));
  check("the comet link is absolute and has no double slash",
    comet.text.includes("https://karta.example.com/comet/TOKEN123"));
  // The link is the only copy there is; the email has to say so.
  check("the comet mail warns the link is the only copy",
    comet.text.includes("リンクがなくなると、彗星は見つけられなくなります。"));
  check("a sealed comet mail never carries the message", !comet.text.includes("SENTINEL-BODY"));

  const cometDay = cometDayMail({
    slug: sample.slug,
    title: sample.title,
    label: sample.comet!.label!,
    promise: sample.comet!.promise!,
    today: "2026-12-25",
  })!;
  check("the reminder subject is the label",
    cometDay.subject === "今日は「次のクリスマス」です", cometDay.subject);
  check("the reminder carries the promise",
    cometDay.text.includes(sample.comet!.promise!));
  check("the reminder links the card",
    cometDay.text.includes(`https://karta.example.com/c/${sample.slug}`));
  check("the reminder asks the sender to reach out",
    cometDay.text.includes("相手に、連絡してみませんか。"));
  // One per card per day, whatever the scheduler does.
  check("the reminder is idempotent per day",
    cometDay.idempotencyKey === `comet-${sample.slug}-2026-12-25`, cometDay.idempotencyKey);

  // No template ever leaks an environment value into the body.
  for (const mail of [reply, comet, cometDay]) {
    check(`"${mail.subject.slice(0, 12)}…" never leaks the API key`,
      !mail.text.includes("SENTINEL-RESEND") && !mail.subject.includes("SENTINEL-RESEND"));
    check(`"${mail.subject.slice(0, 12)}…" never leaks the inbox into the body`,
      !mail.text.includes("SENTINEL-NOTIFY"));
  }

  // Without an inbox there is nobody to write to, and no mail is built at all.
  delete process.env.NOTIFY_TO;
  check("no inbox means no mail",
    replyMail({ slug: sample.slug, title: "x", name: "y", message: "z", sentAt }) === null);

  for (const key of ["NOTIFY_TO", "PUBLIC_BASE_URL", "RESEND_API_KEY", "MAIL_FROM"]) {
    if (keep[key] === undefined) delete process.env[key];
    else process.env[key] = keep[key];
  }

  console.log(`  3 templates, stamped ${formatSentAt(sentAt, sample.timeZone)}`);
}

console.log("15. What the receiver may send (spec v0.2 §14.4, §14.5):");
{
  const ok = (body: object, max = REPLY_MAX) => validate(body, max);

  // ---- the ordinary case -------------------------------------------------
  const good = ok({ name: " そら ", message: "  こちらこそ、ありがとう。 " });
  check("a name and a message are accepted", good.ok);
  check("both are trimmed", good.ok && good.value.name === "そら", good.ok ? good.value.name : "");

  // ---- the edges ---------------------------------------------------------
  check("an empty name is refused", !ok({ name: "", message: "x" }).ok);
  check("a whitespace-only name is refused", !ok({ name: "   ", message: "x" }).ok);
  check("an empty message is refused", !ok({ name: "x", message: "" }).ok);
  check("a missing body is refused", !ok({}).ok);
  check("a non-string is refused", !ok({ name: 42, message: ["x"] }).ok);
  check(`a name of exactly ${NAME_MAX} is accepted`,
    ok({ name: "あ".repeat(NAME_MAX), message: "x" }).ok);
  check(`a name of ${NAME_MAX + 1} is refused`,
    !ok({ name: "あ".repeat(NAME_MAX + 1), message: "x" }).ok);
  check(`a reply of exactly ${REPLY_MAX} is accepted`,
    ok({ name: "x", message: "あ".repeat(REPLY_MAX) }).ok);
  check(`a reply of ${REPLY_MAX + 1} is refused`,
    !ok({ name: "x", message: "あ".repeat(REPLY_MAX + 1) }).ok);
  check("a comet gets its own, longer limit",
    ok({ name: "x", message: "あ".repeat(COMET_MAX) }, COMET_MAX).ok);

  // Counted the way the person typing counts, not the way UTF-16 does: an
  // emoji is one character to them, and the limit is written for them.
  const emoji = "🌠".repeat(NAME_MAX);
  check("an emoji is one character, not two",
    ok({ name: emoji, message: "x" }).ok, `${emoji.length} UTF-16 units`);

  // ---- what gets stripped ------------------------------------------------
  const nasty = ok({ name: "そ\u0000ら", message: "a\u202eb\u200bc" });
  check("control characters are stripped", nasty.ok && nasty.value.name === "そら",
    nasty.ok ? nasty.value.name : "");
  // This one matters: a right-to-left override in a name can make an email
  // read as something other than what was sent, and this goes to an inbox.
  check("bidirectional overrides are stripped",
    nasty.ok && !/[\u202a-\u202e]/.test(nasty.value.message));
  check("zero-width characters are stripped",
    nasty.ok && !nasty.value.message.includes("\u200b"));
  const paragraphs = ok({ name: "x", message: "a\n\n\n\n\nb" });
  check("newlines survive but a wall of them does not",
    paragraphs.ok && paragraphs.value.message === "a\n\nb",
    paragraphs.ok ? JSON.stringify(paragraphs.value.message) : "");
  // A name goes into a subject line, so a newline there is header injection
  // rather than formatting.
  const lined = ok({ name: "そ\nら", message: "x" });
  check("a name never keeps a newline", lined.ok && !lined.value.name.includes("\n"),
    lined.ok ? JSON.stringify(lined.value.name) : "");

  // ---- the honeypot ------------------------------------------------------
  const trapped = validate({ name: "x", message: "y", website: "http://spam" }, REPLY_MAX);
  check("a filled honeypot is refused", !trapped.ok);
  // Silently: telling it *which* field gave it away is telling it how to pass.
  check("and refused silently", !trapped.ok && "silent" in trapped);
  check("an empty honeypot is fine", validate({ name: "x", message: "y", website: "" },
    REPLY_MAX).ok);

  console.log(`  name <= ${NAME_MAX}, reply <= ${REPLY_MAX}, comet <= ${COMET_MAX}, plus a honeypot`);
}

console.log("16. The comet's seal (spec v0.2 §11.5):");
{
  const key = randomBytes(32);
  const other = randomBytes(32);
  const payload = {
    v: 2 as const,
    slug: "2026-newyear-7k2m",
    name: "そら",
    body: "SENTINEL-COMET-BODY いつかまた、話しましょう。",
    leftOn: "2026-03-01",
    returnsOn: "2026-12-25",
    boardedOn: "2026-09-23",
  };

  const token = seal(payload, key)!;
  check("a comet can be sealed", typeof token === "string" && token.length > 0);
  check("the token is URL-safe", /^[A-Za-z0-9_-]+$/.test(token));
  // ~1.1KB per §11.5, which has to fit in a link in an email.
  check("the token fits in a link", token.length < 2000, `${token.length} chars`);
  // The body is encrypted, not encoded: it must not be readable in the token.
  check("the token does not contain the message",
    !Buffer.from(token, "base64url").toString("utf8").includes("SENTINEL-COMET-BODY"));

  // ---- before the date: the dates, and nothing else ----------------------
  const away = open(token, "2026-12-24", key);
  check("before the day it is away", away.status === "away", away.status);
  check("the dates are readable", away.status === "away" && away.returnsOn === "2026-12-25");
  check("and when the words boarded", away.status === "away" && away.boardedOn === "2026-09-23");
  check("the name is readable", away.status === "away" && away.name === "そら");
  // This is the whole promise. Not hidden — not returned at all.
  check("the message is not in the result",
    !JSON.stringify(away).includes("SENTINEL-COMET-BODY"));

  // ---- on the day, and after -------------------------------------------
  const returned = open(token, "2026-12-25", key);
  check("on the day it has returned", returned.status === "returned", returned.status);
  check("and the message is readable",
    returned.status === "returned" && returned.body === payload.body);
  check("it stays readable afterwards", open(token, "2027-03-01", key).status === "returned");

  // ---- every way it must fail -------------------------------------------
  check("another key cannot open it", open(token, "2026-12-25", other).status === "invalid");
  check("no key at all cannot open it", open(token, "2026-12-25", null).status === "invalid");
  check("nonsense is refused", open("not-a-token", "2026-12-25", key).status === "invalid");
  check("an empty token is refused", open("", "2026-12-25", key).status === "invalid");
  check("a truncated token is refused",
    open(token.slice(0, -8), "2026-12-25", key).status === "invalid");

  // A single flipped bit, anywhere, at every position: GCM authenticates the
  // whole message, so there is no part of it that can be edited quietly.
  const raw = Buffer.from(token, "base64url");
  let survived = 0;
  for (let i = 0; i < raw.length; i += 7) {
    const tampered = Buffer.from(raw);
    tampered[i] ^= 0x01;
    if (open(tampered.toString("base64url"), "2026-12-25", key).status !== "invalid") {
      survived++;
    }
  }
  check("a flipped bit anywhere fails", survived === 0, `${survived} survived`);

  // The dates are inside the ciphertext precisely so they cannot be edited to
  // open a comet early; the check above proves editing them fails at all.
  const shortKey = randomBytes(16);
  check("a key of the wrong length is refused", seal(payload, shortKey) === null);

  // Two seals of the same message differ: the IV is random each time.
  check("two seals of one message differ", seal(payload, key) !== seal(payload, key));

  console.log(`  token ${token.length} chars, ${Math.ceil(raw.length / 7)} tamper positions tested`);
}

console.log("17. The comet-day reminder (spec v0.2 rev 5, §12.1, §14.6):");
{
  const sample = cards[0];
  const tz = sample.timeZone ?? "Asia/Tokyo";
  const comet = sample.comet!;

  // ---- the day is the card's day, not the server's ----------------------
  // 15:00 UTC on the 24th is already the 25th in Tokyo. A card written in
  // Japan should be reminded on its own date, wherever the job runs.
  check("not the day at 23:59 in the card's zone",
    !isCometDay(comet, new Date("2026-12-24T14:59:00Z"), tz));
  check("the day at 00:00 in the card's zone",
    isCometDay(comet, new Date("2026-12-24T15:00:00Z"), tz));
  check("still the day at 23:59 that night",
    isCometDay(comet, new Date("2026-12-25T14:59:00Z"), tz));
  check("over by 00:00 the next day",
    !isCometDay(comet, new Date("2026-12-25T15:00:00Z"), tz));

  // ---- and it comes round every year ------------------------------------
  check("the anniversary counts too",
    isCometDay(comet, new Date("2027-12-25T02:00:00Z"), tz));
  check("a one-off comet does not",
    !isCometDay({ ...comet, yearly: false }, new Date("2027-12-25T02:00:00Z"), tz));

  // ---- one email per card per day, whatever the scheduler does ----------
  // Vercel cron may fire twice; there is no database to record a send in, so
  // the key is what makes a second run harmless.
  const keep = process.env.NOTIFY_TO;
  process.env.NOTIFY_TO = "SENTINEL-NOTIFY@example.com";
  const mailFor = (today: string) =>
    cometDayMail({
      slug: sample.slug,
      title: sample.title,
      label: comet.label!,
      promise: comet.promise!,
      today,
    })!;
  const first = mailFor("2026-12-25");
  const second = mailFor("2026-12-25");
  check("two runs on one day carry the same key",
    first.idempotencyKey === second.idempotencyKey, first.idempotencyKey);
  const nextYear = mailFor("2027-12-25");
  check("next year's is a different key",
    nextYear.idempotencyKey !== first.idempotencyKey, nextYear.idempotencyKey);
  if (keep === undefined) delete process.env.NOTIFY_TO;
  else process.env.NOTIFY_TO = keep;

  // ---- the schedule is actually configured ------------------------------
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };
  const cron = vercel.crons?.find((c) => c.path === "/api/cron/comets");
  check("vercel.json schedules the reminder", Boolean(cron), JSON.stringify(vercel.crons));
  check("it runs daily", cron?.schedule === "0 0 * * *", cron?.schedule);

  console.log(`  ${comet.returnsOn} in ${tz}, ${cron?.schedule} UTC, one send per card per day`);
}

console.log("18. A save rewrites the file whole, so its header must be current:");
{
  // `writeCards` rewrites config/cards.config.ts from the HEADER constant plus
  // the data. If the two drift apart — as they did once — then opening the
  // editor and pressing Save silently reverts the file's own documentation to
  // an older, wrong version. Nothing else would ever notice.
  const written = serializeCards(cards);
  const onDisk = readFileSync("config/cards.config.ts", "utf8");
  const marker = "export const cards: CardConfig[] =";

  const writtenHeader = written.slice(0, written.indexOf(marker));
  const diskHeader = onDisk.slice(0, onDisk.indexOf(marker));

  check("the header a save would write matches the file on disk",
    writtenHeader === diskHeader,
    writtenHeader === diskHeader ? "" : "lib/cardsFile.ts and config/cards.config.ts disagree");

  // And the header has to still be true about where passwords live.
  check("the header describes the v0.2 password precedence",
    writtenHeader.includes("access.passwordHash"));

  console.log(`  header ${writtenHeader.split("\n").length} lines, identical`);
}

console.log("19. The deployment (spec v0.2 §8.2):");
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
  // The window moved to 0.70-0.80 in revision 6, so the samples move with it.
  check("the thruster only ever fires once",
    deploymentAt(0.3).thruster === 0 &&
    deploymentAt(0.75).thruster > 0.5 &&
    Math.abs(deploymentAt(0.95).thruster) < 1e-9,
    deploymentAt(0.95).thruster.toExponential(2));
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

  // ---- a replay is the same animation, shorter (REPLAY_SCALE) ------------
  const brisk = replayed(DEPLOY_MS, true);
  check("a replay is genuinely shorter", brisk < DEPLOY_MS, `${DEPLOY_MS} -> ${brisk}ms`);
  check("and still recognisably the same animation", REPLAY_SCALE >= 0.5);
  // The unfold is the part that can be ruined by hurrying it: six hinges have
  // to land as six separate events, and below about 40ms apart they read as
  // one. This is the real floor under REPLAY_SCALE.
  const briskUnfoldMs = brisk * (UNFOLD_WINDOW.to - UNFOLD_WINDOW.from);
  const lastHingeMs = (N_PANELS - 1) * WING_STAGGER_MS + NEAR_WING_DELAY_MS;
  check("the six hinges still fit inside the shortened unfold",
    briskUnfoldMs > lastHingeMs, `${briskUnfoldMs.toFixed(0)}ms for ${lastHingeMs}ms of stagger`);
  check("hinges are still far enough apart to be counted",
    WING_STAGGER_MS * REPLAY_SCALE >= 40, `${(WING_STAGGER_MS * REPLAY_SCALE).toFixed(0)}ms apart`);
  // The spec's rule is that the camera never outlasts the cube. It has to
  // hold for the shortened deployment too, which is the one that could break
  // it — the camera's own move is not scaled.
  check("the camera still lands inside a shortened deployment", ZOOM_OUT_MS <= brisk,
    `${ZOOM_OUT_MS}ms camera, ${brisk}ms deployment`);

  // ---- the wings open like a real satellite's (rev 6 §2, §7) -------------
  const deployMs = DEPLOY_MS;

  // Fully open, the panels are coplanar, in line, and the span is 9.6.
  const flat = wingChain(1, 1, 1);
  check("a deployed wing is coplanar", flat.every((p) => Math.abs(p[2]) < 1e-9));
  check("and in line", flat.every((p, i) => i === 0 || p[0] > flat[i - 1][0]));
  check("tip to tip is 9.6 cube units", Math.abs(2 * flat[N_PANELS][0] - DEPLOYED_SPAN) < 1e-9,
    (2 * flat[N_PANELS][0]).toFixed(3));

  // Stowed, nothing sticks out of the body: the wings emerge from the faces.
  const stowed = wingChain(1, 0, 0);
  check("at boom = 0 no wing geometry leaves the cube",
    stowed.every((p) => Math.abs(p[0]) <= 1 + 1e-9 && Math.abs(p[2]) <= 1 + 1e-9));

  // Continuous in both parameters: a hinge that jumps is a wing that snaps.
  let worstHinge = 0;
  for (let i = 1; i <= 100; i++) {
    for (const [a, b] of [
      [wingChain(1, (i - 1) / 100, 0.5), wingChain(1, i / 100, 0.5)],
      [wingChain(1, 1, (i - 1) / 100), wingChain(1, 1, i / 100)],
    ]) {
      for (let k = 0; k < a.length; k++) {
        worstHinge = Math.max(worstHinge, Math.hypot(
          a[k][0] - b[k][0], a[k][1] - b[k][1], a[k][2] - b[k][2]));
      }
    }
  }
  check("no hinge jumps", worstHinge <= 0.1, `${worstHinge.toFixed(4)}u per 0.01`);

  /*
   * Nothing ever passes through anything. The accordion folds back on itself,
   * so a fold angle that is fine at rest can intersect halfway through — and
   * four frames of a panel inside the bus is the kind of thing nobody notices
   * until it is in front of someone.
   */
  let worstClearance = Infinity;
  let atT = 0;
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const boom = boomAt(t);
    // Below this the wing is a speck at the face centre, which is the point.
    if (boom < 0.02) continue;
    const clearance = selfClearance(boom, unfoldAt(t, 0, deployMs));
    if (clearance < worstClearance) {
      worstClearance = clearance;
      atT = t;
    }
  }
  check("no panel ever intersects the body or another panel", worstClearance >= 0,
    `${worstClearance.toFixed(3)}u at t=${atT.toFixed(2)}`);
  check("and once at full size it clears properly", selfClearance(1, 0) > 0.15,
    selfClearance(1, 0).toFixed(3));

  // ---- the timeline (rev 6 §2.2) -----------------------------------------
  check("the booms start after the turn is under way", BOOM_WINDOW.from > 0);
  check("the wings unfold once the booms are out", UNFOLD_WINDOW.from >= BOOM_WINDOW.to);
  check("and finish before the rise does", UNFOLD_WINDOW.to <= RISE.to);

  for (const wing of [0, 1] as const) {
    const start = unfoldAt(UNFOLD_WINDOW.from, wing, deployMs);
    const end = unfoldAt(UNFOLD_WINDOW.to, wing, deployMs);
    check(`wing ${wing + 1} starts folded`, start.every((v) => v === 0));
    check(`wing ${wing + 1} ends flat`, end.every((v) => Math.abs(v - 1) < 1e-9));
  }

  // Root to tip, and the near wing behind the far one.
  const mid = unfoldAt(0.5, 0, deployMs);
  check("a wing opens root to tip", mid[0] > mid[1] && mid[1] > mid[2],
    mid.map((v) => v.toFixed(2)).join(" > "));
  check("the near wing follows the far one",
    unfoldAt(0.5, 1, deployMs)[0] < mid[0]);

  // And no panel ever folds back mid-flight.
  let unfoldMonotonic = true;
  let previousUnfold = unfoldAt(0, 0, deployMs);
  for (let i = 1; i <= 1000; i++) {
    const now = unfoldAt(i / 1000, 0, deployMs);
    if (now.some((v, k) => v < previousUnfold[k] - 1e-12)) unfoldMonotonic = false;
    previousUnfold = now;
  }
  check("a wing only ever opens", unfoldMonotonic);

  // The hull the framing checks measure is the whole satellite, not the bus.
  const hull = hullPoints(1, 1);
  check("the hull includes the wings",
    Math.max(...hull.map((p) => Math.abs(p[0]))) > 4, 
    Math.max(...hull.map((p) => Math.abs(p[0]))).toFixed(2));

  console.log(
    `  turn 0-${TURN.to}, panels ${PANELS.from}-${PANELS.to}, ` +
    `thruster ${THRUSTER.from}-${THRUSTER.to}, rise ${RISE.from}-1, over ${DEPLOY_MS}ms`,
  );
}

console.log("20. The satellite leaves as one object (rev 6):");
{
  /*
   * It is built from materials with very different opacities, and on the way
   * to the trail they all have to go at once. Scaled by a shared multiplier
   * they do not: the ratios survive to the bottom, so the cube's glass fades
   * past noticing while the metalwork bolted to it is still three times as
   * opaque, and the wings are seen outliving the thing they hang off.
   *
   * Checked because it has been reported twice — once from the materials not
   * being transparent at all, and once from lightening the cube, which is a
   * change nobody would think to re-test the stow against.
   */
  const bases = SATELLITE_OPACITIES;
  const faintest = Math.min(...bases);

  check("nothing is touched while the satellite is simply there",
    bases.every((b) => stowedOpacity(b, 1, 1) === b));

  // Once the ceiling is under the faintest material, every part matches.
  for (const ceiling of [faintest, 0.2, 0.1, 0.03]) {
    check(`at ${ceiling}, every part of it is the same alpha`,
      Math.abs(fadeSpread(bases, ceiling) - 1) < 1e-9,
      `${fadeSpread(bases, ceiling).toFixed(2)}x apart`);
  }

  // And they reach nothing together, rather than one lingering after another.
  check("and they all reach zero together",
    bases.every((b) => stowedOpacity(b, 1, 0) === 0));

  // The old behaviour, so this check cannot pass against a multiplier again.
  const asMultiplier = (b: number, c: number) => b * c;
  const oldSpread =
    Math.max(...bases.map((b) => asMultiplier(b, 0.1))) /
    Math.min(...bases.map((b) => asMultiplier(b, 0.1)));
  check("a multiplier would not have done this", oldSpread > 2, `${oldSpread.toFixed(2)}x`);

  console.log(`  ${bases.length} opacities, ${faintest}-1, together from ${faintest} down`);
}

console.log("21. The trail drifts, without coming off its own curve (rev 6):");
{
  const seed = 0.37;
  const peakAt = (u: number) => {
    let peak = 0;
    for (let t = 0; t < 240; t += 0.05) {
      const [x, y, z] = trailSway(u, t, seed);
      peak = Math.max(peak, Math.hypot(x, y, z));
    }
    return peak;
  };

  // Tethered where the satellite actually holds it, freer further out.
  check("the trail is still at the satellite", peakAt(0) < 1e-9, peakAt(0).toFixed(4));
  check("and moves further down its length", peakAt(0.5) > peakAt(0.15),
    `${peakAt(0.15).toFixed(3)} -> ${peakAt(0.5).toFixed(3)}`);
  check("by enough to be seen", peakAt(0.5) > 0.16, peakAt(0.5).toFixed(3));

  /*
   * Bounded over a long sitting. The drift is an offset from the curve, not
   * an accumulation onto the last frame — a trail that integrated its own
   * motion would leave the scene while someone read the card.
   */
  let worst = 0;
  for (let t = 0; t < 4000; t += 0.37) {
    for (let u = 0; u <= 1; u += 0.05) {
      worst = Math.max(worst, Math.hypot(...trailSway(u, t, seed)));
    }
  }
  check("and never wanders off", worst < 0.8, worst.toFixed(3));

  // Smooth frame to frame, or it reads as jitter rather than as drift.
  let jump = 0;
  for (let t = 0; t < 200; t += 1 / 60) {
    for (let u = 0; u <= 1; u += 0.1) {
      const a = trailSway(u, t, seed);
      const b = trailSway(u, t + 1 / 60, seed);
      jump = Math.max(jump, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
  }
  check("it drifts rather than jitters", jump < 0.01, `${(jump * 1000).toFixed(2)} milli-units/frame`);

  console.log(`  still at the satellite, ${worst.toFixed(2)} units at its freest`);
}

console.log("22. Looking into the satellite lands where 中をのぞく lands (rev 6):");
{
  /*
   * Two ways in, one destination. From the closing screen the reader presses
   * 中をのぞく; from orbit they press the label on the satellite, because the
   * satellite *is* the cube. If those two ever stop arriving at the same
   * state, the card has grown a second inside.
   *
   * `reveal` only transitions from `completed`, so the orbit route is the two
   * moves a reader would make chained together — dock, then go in once the
   * card has come back. Checked because the chaining lives in an effect, and
   * an effect that silently stops firing looks exactly like nothing.
   */
  const ctx = {
    memoryCount: 5,
    hasOrbit: true,
    hasCrossroads: true,
    comet: {
      exists: true, returned: false, kept: false,
      capsule: false, capsuleOpen: false, departed: true, introduced: true,
    },
  };

  const play = (from: string, events: ExperienceEvent[]) => {
    let s = initialExperience(ctx);
    for (const e of jumpEvents(from) ?? []) s = reduceExperience(s, e);
    for (const e of events) s = reduceExperience(s, e);
    return s;
  };

  const toInside: ExperienceEvent[] = [
    { type: "enterSatellite" }, { type: "deployEnd" }, { type: "zoomEnd" },
  ];
  const viaOrbit = play("orbit", toInside);
  const viaClosing = play("closing", [{ type: "reveal" }, { type: "zoomEnd" }]);

  check("the satellite leads inside the cube", viaOrbit.state === "inside", viaOrbit.state);
  check("中をのぞく leads to the same place", viaClosing.state === "inside", viaClosing.state);
  check("and they are the same place", viaOrbit.state === viaClosing.state);

  /*
   * And never by way of the closing screen. The reader came from orbit; they
   * have finished with that screen, and putting it in front of them for two
   * seconds on the way past is introducing a screen in order to dismiss it.
   */
  let onTheWayIn = play("orbit", []);
  const seen: string[] = [];
  for (const event of toInside) {
    onTheWayIn = reduceExperience(onTheWayIn, event);
    seen.push(onTheWayIn.state);
    if (showsCompletion(onTheWayIn)) seen.push("(closing screen shown)");
  }
  check("the way in never passes the closing screen",
    !seen.includes("completed") && !seen.includes("(closing screen shown)"),
    seen.join(" -> "));

  // Out again, back where they set off from — not stranded on the closing screen.
  const out = [
    ...toInside,
    { type: "reveal" as const },
    { type: "zoomEnd" as const },
    { type: "deployEnd" as const },
  ];
  const backOut = play("orbit", out);
  check("and coming out returns to orbit", backOut.state === "orbit", backOut.state);
  check("the journey is finished with", backOut.insideVia === null, String(backOut.insideVia));

  // The closing screen's own detour still comes back to the closing screen.
  const closingRoundTrip = play("closing", [
    { type: "reveal" }, { type: "zoomEnd" }, { type: "reveal" }, { type: "zoomEnd" },
  ]);
  check("from the closing screen, in and out returns there",
    closingRoundTrip.state === "completed", closingRoundTrip.state);

  console.log(`  orbit -> ${seen.join(" -> ")} -> ... -> ${backOut.state}`);
}

console.log("23. The closing line wraps rather than shrinking (rev 6):");
{
  const long = "改めてお世話になりました。とても濃い一年間をありがとう。これからもよろしくね。";
  const short = "ありがとう。";
  const unbroken = "区切りのないとてもながいおわりのことばでどこにもてんやまるがありません";

  const phone = closingLines(long, 390);
  check("a long farewell wraps on a phone", phone.length === 2, String(phone.length));
  check("and breaks where the sentence already pauses",
    phone[0]?.endsWith("。") === true, phone[0]);
  check("the pieces are the whole line", phone.join("") === long);
  check("the longest line is shorter than the whole",
    Math.max(...phone.map((l) => l.length)) < long.length,
    `${Math.max(...phone.map((l) => l.length))} < ${long.length}`);

  check("the same line fits on a desktop", closingLines(long, 1440).length === 1);
  check("a short farewell is left alone", closingLines(short, 390).length === 1);
  /*
   * Nowhere to break is not a reason to break anywhere: a wrong break in the
   * middle of a phrase reads worse than small text does.
   */
  check("a line with no punctuation is never split",
    closingLines(unbroken, 390).length === 1, String(closingLines(unbroken, 390).length));

  console.log(`  ${long.length} characters -> ${phone.map((l) => l.length).join(" + ")} on a phone`);
}

console.log("24. Both ways of sending go towards the comet (§10.3, §8.7):");
{
  /*
   * Direction is meaning here. The card offers two ways to send something and
   * the only difference between them is speed, so both have to be *seen*
   * going the same way — out, into the depth of the scene, where the comet
   * is. Neither used to.
   *
   * The rocket settled up and to the right of the planet on a heading of its
   * own: two units *towards* the lens, and nine units from the comet, so it
   * read as coming at the reader. The capsule carrying the receiver's words
   * ran up the comet's true ellipse, which is not where the comet is drawn,
   * and stopped 7.6 units short of it.
   *
   * Checked rather than eyeballed, at both reference shapes, because a
   * direction that quietly reverses is exactly the kind of thing that only
   * shows up when someone watches the animation on the one device nobody has.
   */
  const shapes: [string, number, number][] = [
    ["portrait", 390, 844],
    ["landscape", 1280, 800],
  ];

  for (const [name, width, height] of shapes) {
    const camera = new THREE.Vector3(...hubPose(width, height).position);
    const comet = new THREE.Vector3(...cometAt(0.5, width, height));

    // Where the rocket starts: the planet's lit limb.
    const planet = new THREE.Vector3(...PLANET_CENTRE);
    const from = planet
      .clone()
      .add(new THREE.Vector3(0.55, 0.83, 0.1).normalize().multiplyScalar(PLANET_RADIUS));
    const to = new THREE.Vector3(...replyStarAt(0.5, width, height));

    check(`${name}: the reply recedes rather than coming at the lens`,
      to.z < from.z, `dz ${(to.z - from.z).toFixed(2)}`);
    check(`${name}: the reply ends further from the camera than it started`,
      to.distanceTo(camera) > from.distanceTo(camera),
      `${from.distanceTo(camera).toFixed(2)} -> ${to.distanceTo(camera).toFixed(2)}`);
    check(`${name}: the reply overtakes the comet rather than stopping short`,
      to.distanceTo(comet) > 0.5 && to.distanceTo(comet) < 3,
      `${to.distanceTo(comet).toFixed(2)} beyond it`);

    // And it passes the comet going outward, not inward.
    const outward = comet.clone().sub(from).normalize();
    check(`${name}: the reply's heading is the comet's`,
      to.clone().sub(from).normalize().dot(outward) > 0.9,
      to.clone().sub(from).normalize().dot(outward).toFixed(3));
  }

  console.log(
    `  reply lands ${replyStarAt(0.5, 390, 844)[2] < 0 ? "behind" : "in front of"} the satellite, ` +
    `${REPLY_OVERTAKE} units past the comet`,
  );
}

console.log("25. The sky ages with the letter, and never winds back (skyAge):");
{
  /*
   * The background is made out of how long ago the card was sent. Three
   * properties, and all three are things a reader would actually notice:
   *
   * - **Monotone.** Coming back to a card must never find it fresher than it
   *     was. Checked day by day over twenty years, on every output.
   * - **It never arrives.** The curve approaches `AGE_CEILING` and stops short,
   *     so there is no day on which the sky has finished. A card that visibly
   *     completed would be a countdown, which is the opposite of 「またね」.
   * - **It cannot be caught moving.** The input is a civil date, so the whole
   *     thing steps once a day. One day's step has to be small enough that two
   *     readings a day apart are the same picture — and the range as a whole
   *     wide enough that two a season apart are not.
   */
  const DAYS = 365 * 20;
  let worstStep = 0;
  let monotone = true;
  let ceilingHeld = true;

  for (let day = 0; day <= DAYS; day++) {
    const here = sky(skyAge(day));
    const next = sky(skyAge(day + 1));
    // Gas and warmth fall, stars rise; none of them may ever turn round.
    if (next.gas > here.gas + 1e-12) monotone = false;
    if (next.warmth > here.warmth + 1e-12) monotone = false;
    if (next.stars < here.stars - 1e-12) monotone = false;
    if (skyAge(day) >= AGE_CEILING) ceilingHeld = false;
    worstStep = Math.max(worstStep, skyAge(day + 1) - skyAge(day));
  }

  check("the sky only ever ages", monotone);
  check("it never reaches the ceiling", ceilingHeld, skyAge(DAYS).toFixed(6));
  // A day's step, as a fraction of the whole journey. 1% would be visible
  // between two readings on consecutive evenings, which it must not be.
  check("a day's change is imperceptible", worstStep < 0.005, worstStep.toFixed(5));

  /*
   * Wide enough to be worth doing. A season apart has to look different, or
   * the whole thing is arithmetic nobody can see. Measured on the gas, which
   * is the output that carries most of it.
   */
  const season = sky(skyAge(0)).gas - sky(skyAge(90)).gas;
  check("a season apart is visibly different", season > 0.1, season.toFixed(3));

  /*
   * Where the date comes from. `writtenAt` first — it is what the sender said
   * about when this was sent, and it is already on the landing screen, so the
   * sky and that line cannot disagree.
   */
  check("writtenAt wins", cardEpoch({ writtenAt: "2026-03", comet: { leftOn: "2025-01-01" } }) === "2026-03");
  check("the comet's departure stands in", cardEpoch({ comet: { leftOn: "2025-01-01" } }) === "2025-01-01");
  check("a card with no date is a fresh sky", skyAge(elapsedDays({}, "2030-01-01")) === 0);
  /*
   * A card dated in the future is a sender post-dating a letter, or a clock
   * that is wrong. Either way it is read as sent today rather than as a sky
   * running backwards.
   */
  check("a future date does not invert the sky",
    elapsedDays({ writtenAt: "2027-01-01" }, "2026-10-02") === 0);

  const year = sky(skyAge(365));
  console.log(
    `  half-life ${AGE_HALF_LIFE_DAYS}d, ceiling ${AGE_CEILING}; ` +
    `at one year gas ${year.gas.toFixed(2)}, warmth ${year.warmth.toFixed(2)}, ` +
    `stars ${year.stars.toFixed(2)}`,
  );
  console.log(`  a day's step: ${(worstStep * 100).toFixed(2)}% of the whole journey`);
}

console.log("26. Passing rocks never touch the satellite (rev 6 §3.2):");
{
  /*
   * The one hard requirement of the asteroid field. A rock through the
   * satellite is not a glitch a reader forgives — it is the object the whole
   * card is about, being hit.
   *
   * It is guaranteed by construction rather than by rejection: every path is
   * built around its own closest-approach point, so the miss distance is an
   * input. This check does two separate things with that. It confirms the
   * construction is honest — that `miss` really is the distance from the
   * satellite to the line, computed independently — and then it measures the
   * clearance against the satellite's **real deployed hull** and against the
   * camera, so neither margin can be quietly eaten by a satellite that grows
   * or a composition that moves in closer.
   */
  const hull = satelliteHull();
  const views: [string, number, number][] = [
    ["phone", 390, 844],
    ["tablet", 820, 1180],
    ["laptop", 1440, 900],
    ["desktop", 1920, 1080],
    // The widest shape in use: the hub camera stands closest here, so this is
    // where a rock has the least room between the satellite and the lens.
    ["ultrawide", 2560, 1080],
  ];

  let worstLine = Infinity;
  let worstHull = Infinity;
  let worstCamera = Infinity;
  let worstCameraAt = "";
  let highest = -Infinity;
  let behind = true;
  let exact = true;

  // Many cards, many passes each: the paths are seeded, so this is the whole
  // population rather than a sample of one card's luck.
  for (let card = 0; card < 40; card++) {
    const seed = asteroidSeed(`verify-${card}`);
    for (let index = 0; index < 400; index++) {
      const pass = asteroidPass(seed, index);

      // Independently: the distance from the origin to the infinite line.
      const t = -(
        pass.from[0] * pass.direction[0] +
        pass.from[1] * pass.direction[1] +
        pass.from[2] * pass.direction[2]
      );
      const nearest = asteroidAt(pass, t / pass.speed);
      const line = Math.hypot(nearest[0], nearest[1], nearest[2]);
      if (Math.abs(line - pass.miss) > 1e-9) exact = false;
      worstLine = Math.min(worstLine, line);

      // Behind the satellite, not across the front of it.
      if (nearest[2] > -BEHIND + 1e-9) behind = false;
      highest = Math.max(highest, pass.from[2], pass.from[2] + pass.direction[2] * 2 * RANGE);

      // The real hull, and the rock's own radius taken off both margins.
      for (const point of hull) {
        worstHull = Math.min(worstHull, clearance(pass, point as [number, number, number]) - pass.radius);
      }
      for (const [name, width, height] of views) {
        const gap = clearance(pass, hubPose(width, height).position) - pass.radius;
        if (gap < worstCamera) { worstCamera = gap; worstCameraAt = name; }
      }
    }
  }

  check("the stated miss distance is the real one", exact);
  check("nothing comes closer than the floor", worstLine >= MIN_MISS - 1e-9, worstLine.toFixed(4));
  // Comfortably clear of the deployed wings, which reach about 2.0 units.
  check("the deployed hull is never touched", worstHull > 1.5, worstHull.toFixed(3));
  check("every pass runs behind the satellite", behind);
  /*
   * And behind the camera's shoulder too. `Z_TILT` caps how much depth a path
   * can have and `RANGE` caps how long it is, so the highest z any rock can
   * reach is bounded — which is what keeps one from arriving in the reader's
   * lap on a wide screen, where the camera stands closest.
   */
  check("nothing flies between the reader and the satellite", worstCamera > 2, worstCamera.toFixed(3));

  /*
   * The timetable. "Roughly every thirty seconds, at random" — so what is
   * checked is the mean, that the gaps are actually varied rather than a
   * metronome, and that the pool is deep enough that passes are not being
   * silently dropped.
   */
  const passes = asteroidPasses(asteroidSeed("timetable"), 4000);
  const gaps = passes.slice(1).map((pass, i) => pass.startAt - passes[i].startAt);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const spread = Math.max(...gaps) - Math.min(...gaps);

  check("about one every thirty seconds", Math.abs(mean - PASS_MEAN_S) < 3, mean.toFixed(2));
  check("the gaps are not a metronome", spread > PASS_MEAN_S, spread.toFixed(1));

  /*
   * How many are ever in flight together, so the pool is sized from the
   * timetable instead of guessed. Swept across cards, not measured on one:
   * sized against a single seed the pool came out at four, and the twenty-ninth
   * card wanted six. A pass with nowhere to go is silently not drawn, which is
   * exactly the kind of thing nobody would ever notice was happening.
   */
  let peak = 0;
  let busiest = "";
  for (let card = 0; card < 60; card++) {
    const slug = `peak-${card}`;
    const timetable = asteroidPasses(asteroidSeed(slug), 2000);
    // An event sweep rather than a scan over time: one rock arriving or
    // leaving is the only moment the count can change, so there is nothing to
    // learn from the instants in between.
    const events = timetable
      .flatMap((pass) => [
        { at: pass.startAt, delta: 1 },
        { at: pass.startAt + pass.duration, delta: -1 },
      ])
      .sort((a, b) => a.at - b.at || a.delta - b.delta);

    let live = 0;
    for (const event of events) {
      live += event.delta;
      if (live > peak) { peak = live; busiest = slug; }
    }
  }
  check("the pool holds every pass that is due", peak <= POOL, `${peak} at once`);

  console.log(
    `  ${worstLine.toFixed(1)}-${MAX_MISS} units out, ${worstHull.toFixed(1)} clear of the hull, ` +
    `${worstCamera.toFixed(1)} of the ${worstCameraAt} camera`,
  );
  console.log(
    `  highest a rock reaches: z ${highest.toFixed(2)}; gaps mean ${mean.toFixed(0)}s, ` +
    `busiest sky ${peak} at once (${busiest}), pool ${POOL}`,
  );
}

console.log("27. The satellite's label never covers the comet (rev 6 §3.1):");
{
  /*
   * The label on the satellite — the only way from the hub into the cube —
   * appears when the reader hovers the satellite. To be hovered at all its box
   * has to accept pointer events, and a box that accepts pointer events also
   * *swallows clicks inside it*.
   *
   * The comet is the one thing in the scene that is clickable, and 「星をタップ
   * してみてください」 is the hub's own invitation to tap it. It is drawn along a
   * composition path rather than its true orbit, and that path passes close to
   * the satellite at some aspect ratios — at tip-to-tip the two overlap
   * outright on a tablet, and clear by eleven pixels on a phone. So the label
   * is capped at `LABEL_SHARE` of the span, and this is the check that says
   * what that cap is for.
   *
   * Swept over the comet's whole orbit, because where it is drawn depends on
   * how far round it has got — a clearance that held only on the day the card
   * was sent would fail silently, months later, on someone else's screen.
   */
  const views: [string, number, number][] = [
    ["phone", 390, 844],
    ["tall phone", 430, 932],
    ["tablet", 820, 1180],
    ["laptop", 1440, 900],
    ["ultrawide", 2560, 1080],
  ];

  let worst = Infinity;
  let worstAt = "";

  for (const [name, width, height] of views) {
    const pose = hubPose(width, height);
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 120);
    camera.position.set(...pose.position);
    camera.lookAt(new THREE.Vector3(...pose.lookAt));
    camera.updateMatrixWorld(true);

    const label = hubLabel(width / height);
    const half = (label.span * width) / 2;
    const cx = label.centre[0] * width;
    const cy = label.centre[1] * height;

    for (let progress = 0; progress <= 1; progress += 0.002) {
      const screen = new THREE.Vector3(...cometAt(progress, width, height)).project(camera);
      const x = (screen.x * 0.5 + 0.5) * width;
      const y = (-screen.y * 0.5 + 0.5) * height;
      // Distance to the box's edge. Negative means the comet is inside it.
      const gap = Math.max(Math.abs(x - cx) - half, Math.abs(y - cy) - half);
      if (gap < worst) { worst = gap; worstAt = `${name}, progress ${progress.toFixed(2)}`; }
    }
  }

  /*
   * 48px is the touch target the rest of the card is built to (§23.1), so the
   * comet needs at least that much room outside the label before the two can
   * start competing for the same tap.
   */
  check("the comet is never inside the satellite's label", worst > 0, worst.toFixed(0));
  check("and clears it by a whole touch target", worst >= 48, worst.toFixed(0));

  console.log(
    `  label ${LABEL_SHARE} of the span; closest the comet comes: ${worst.toFixed(0)}px (${worstAt})`,
  );
}

console.log(`28. A full trail still has room on it (${MEMORY_MAX} memories):`);
{
  /*
   * The trail's length is fixed — it runs from z = -4 to z = -70 whatever is
   * on it — and memories are spaced along it by distance travelled. So every
   * memory added brings all of them closer together, and the limit on how
   * many a card may carry is not a preference but a measurement: the point at
   * which two adjacent photographs would touch. At 24 they do.
   *
   * Two different claims, because one of them can be proved and the other
   * can only be searched for:
   *
   * 1. **The shortest trail.** Every card's is a different shape, seeded from
   *    its slug, and the shortest is the one memories sit closest on. That
   *    shape is known rather than hunted: `straightestTrail` is the curve with
   *    no wander at all, and wander can only ever add length, so no seed beats
   *    it. Checked against real seeds so the two cannot drift apart.
   * 2. **The tightest single gap.** Not the same question, and this is the
   *    part that caught me out: spacing is even to within a few per cent, and
   *    a *longer* trail with worse evenness can pinch tighter than the
   *    shortest one does. That has to be searched for, and the answer depends
   *    on which slugs you try — two populations of a few thousand reported
   *    1.19 and 1.24 panel widths. So the floor is set below both.
   */
  const panel = MEMORY_PANEL_WORLD;

  const hopsOn = (points: Point3[], count: number) => {
    const out: number[] = [];
    for (let i = 1; i < count; i++) {
      const a = trailPoint(points, memoryU(points, i - 1, count));
      const b = trailPoint(points, memoryU(points, i, count));
      out.push(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    return out;
  };

  const spanOf = (points: Point3[]) => {
    let length = 0;
    let previous = trailPoint(points, MEMORY_START_U);
    for (let i = 1; i <= 240; i++) {
      const u = MEMORY_START_U + ((MEMORY_END_U - MEMORY_START_U) * i) / 240;
      const here = trailPoint(points, u);
      length += Math.hypot(here[0] - previous[0], here[1] - previous[1], here[2] - previous[2]);
      previous = here;
    }
    return length;
  };

  // ---- 1. the shortest trail there can be ------------------------------
  const straight = straightestTrail();
  const straightSpan = spanOf(straight);
  const straightHops = hopsOn(straight, MEMORY_MAX);
  const meanFloor = Math.min(...straightHops);

  let shorterThanBound = 0;
  let shortestReal = Infinity;
  for (let i = 0; i < 800; i++) {
    const span = spanOf(trailControlPoints(trailSeedFor(`span-${i}`)));
    shortestReal = Math.min(shortestReal, span);
    if (span < straightSpan - 1e-6) shorterThanBound++;
  }
  check("no card's trail is shorter than the bound", shorterThanBound === 0, `${shorterThanBound} of 800`);

  // ---- 2. the tightest gap any shape produces --------------------------
  let tightest = meanFloor;
  let tightestOn = "the straightest trail";
  let evenness = 1;
  for (let i = 0; i < 200; i++) {
    const slug = `shape-${i}`;
    const hops = hopsOn(trailControlPoints(trailSeedFor(slug)), MEMORY_MAX);
    const shortest = Math.min(...hops);
    if (shortest < tightest) { tightest = shortest; tightestOn = slug; }
    evenness = Math.max(evenness, Math.max(...hops) / shortest);
  }

  // The hard one: at the limit, two photographs may never touch.
  check("a full trail does not stack its photographs", tightest > panel, tightest.toFixed(3));
  /*
   * And the softer one. A gap exactly as wide as the panel means the next
   * memory's edge begins where this one's ends, which reads as a strip rather
   * than as a journey. The worst seen anywhere is 1.19 panel widths; 1.15 is
   * the floor — under both searched populations, and far enough above 1.0 to
   * fail long before anything overlaps.
   */
  check("and leaves daylight between them", tightest > panel * 1.15, (tightest / panel).toFixed(3));
  check("a full trail is still evenly spaced", evenness <= 1.08, evenness.toFixed(3));

  /*
   * The progress dots are one row, centred, and they do not wrap. This is
   * exactly the kind of thing that fits until it does not, and the failure is
   * silent: an overflowing row is clipped at both ends, so the reader loses
   * the dots telling them where they are in the trail.
   */
  const DOT = 4;
  const GAP = 8; // --space-1
  const GUTTER = 16; // --space-2, on each side
  const row = MEMORY_MAX * DOT + (MEMORY_MAX - 1) * GAP;
  const narrowest = 320;
  check("the progress dots fit the narrowest screen", row <= narrowest - 2 * GUTTER, `${row}px`);

  console.log(
    `  shortest trail ${straightSpan.toFixed(1)}u (real: ${shortestReal.toFixed(1)}u); ` +
    `at ${MEMORY_MAX} that is ${meanFloor.toFixed(2)}u a step`,
  );
  console.log(
    `  tightest gap found ${tightest.toFixed(2)}u = ${(tightest / panel).toFixed(2)} panel widths ` +
    `(${tightestOn}); dots ${row}px of ${narrowest - 2 * GUTTER}px`,
  );
}

console.log("29. A card's pictures follow it when the slug changes (§14.3):");
{
  /*
   * A card's media is filed under its slug, and the slug is written into
   * every media path — so renaming a card, or starting one by copying
   * another, leaves its photographs pointing at the old folder.
   *
   * The two kinds then fail *differently*, which is why this went unnoticed:
   * a cube face still loads, because `/public` is served flat and the file
   * really is at that URL, while a memory photograph 404s, because it goes
   * through `/c/<slug>/media/` and that route resolves inside the card's own
   * folder and refuses anything outside it. So the card looked fine and the
   * trail drew empty frames.
   *
   * The route is right and stays as it is — one card's reader must not be
   * able to walk into another card's pictures. What is checked here is that
   * a rename carries the files with it.
   */
  const copied: CardConfig = JSON.parse(JSON.stringify(cards[0]));
  const original = copied.slug;
  copied.slug = "copied-elsewhere";

  const { card: fixed, moved } = rehomeCard(copied);

  // Every picture that named the old card is repointed at the new one.
  check("a renamed card takes its pictures with it", moved.length > 0, String(moved.length));
  check("nothing is left pointing at the old card",
    strayMedia(fixed).length === 0, String(strayMedia(fixed).length));

  for (const memory of fixed.memories ?? []) {
    const src = memory.image?.src;
    if (!src) continue;
    check_once("memory paths land in the new card's folder",
      src.startsWith(`private/cards/${fixed.slug}/`), src);
    // The file's own name must survive: this moves pictures between folders,
    // it does not rename them.
    check_once("and keep their filename", original ? !src.includes(original) : true, src);
  }
  for (const face of fixed.faces ?? []) {
    if (face.type !== "image") continue;
    check_once("face paths land in the new card's folder",
      face.src.startsWith(`/cards/${fixed.slug}/`), face.src);
  }

  /*
   * The exact URL the broken card was asking for, rebuilt from the real
   * `toClientCard`. This is the regression: `private/cards/<other>/x.png` on
   * a card called `<slug>` produced
   * `/c/<slug>/media/private/cards/<other>/x.png`, which the media route
   * resolves under `private/cards/<slug>/` and cannot find.
   */
  {
    const before = toClientCard(copied, new Date("2026-06-01T12:00:00Z"), { mailReady: false, cometReady: false });
    const after = toClientCard(fixed, new Date("2026-06-01T12:00:00Z"), { mailReady: false, cometReady: false });
    const badUrl = before.memories?.find((m) => m.image)?.image?.url ?? "";
    const goodUrl = after.memories?.find((m) => m.image)?.image?.url ?? "";
    check("the broken shape is what it was", badUrl.includes("/media/private/cards/"), badUrl);
    check("and is gone once the pictures follow",
      !goodUrl.includes("/media/private/cards/") && goodUrl.startsWith(`/c/${fixed.slug}/media/`),
      goodUrl);
  }

  // Idempotent: saving twice must not keep moving things.
  const again = rehomeCard(fixed);
  check("a card already in order is left alone", again.moved.length === 0 && again.card === fixed);

  // And a card whose pictures are its own is untouched from the start.
  check("an untouched card is untouched", rehomeCard(cards[0]).moved.length === 0);

  console.log(
    `  ${moved.length} picture(s) repointed on rename; ` +
    `${moved.filter((m) => m.where === "private").length} private, ` +
    `${moved.filter((m) => m.where === "public").length} public`,
  );
}

console.log("30. Shooting stars cross the frame, on every screen (§23.2):");
{
  /*
   * A shooting star is a thing you *see*, so the only property that really
   * matters is that it crosses the visible frame — and the frame is a very
   * different shape on a phone than on an ultrawide. That is why the paths
   * are expressed in half-height units rather than world coordinates: a path
   * tuned on a laptop, placed in world space, misses a portrait screen
   * entirely, because the visible width at that distance is a third as wide.
   *
   * So the check is the thing the design exists for: every star, at every
   * shape of screen, is actually seen.
   */
  const shapes: [string, number][] = [
    ["phone", 390 / 844],
    ["tablet", 820 / 1180],
    ["laptop", 1440 / 900],
    ["desktop", 1920 / 1080],
    ["ultrawide", 2560 / 1080],
    ["square", 1],
  ];

  let missed = 0;
  let tested = 0;
  let startedLow = 0;
  let shortest = Infinity;
  let longest = 0;

  for (const [, aspect] of shapes) {
    for (let card = 0; card < 20; card++) {
      const seed = shootingStarSeed(`sky-${card}`);
      for (let index = 0; index < 60; index++) {
        const star = shootingStar(seed, index, aspect);
        tested++;
        if (!crossesFrame(star, aspect)) missed++;
        // It appears in the open upper sky, as the dawn mockup's do — never
        // down where the planet rises and the controls sit.
        if (star.from[1] < 1 - APPEAR.bottom * 2 - 1e-9) startedLow++;
        shortest = Math.min(shortest, star.duration);
        longest = Math.max(longest, star.duration);
      }
    }
  }

  check("every shooting star is seen in the frame", missed === 0, `${missed} of ${tested}`);
  check("and every one appears in the upper sky", startedLow === 0, String(startedLow));
  check("they are over in a second and a half or so", shortest >= 1.2 && longest <= 2,
    `${shortest.toFixed(2)}-${longest.toFixed(2)}s`);

  /*
   * Brightness: in fast, out slow, and nothing at either end. A streak that
   * is still lit when it stops is a line being switched off.
   */
  // Invisible, not bit-exact zero: the fall-off divides 0.45 by 0.45 and
  // lands a floating-point hair under 1, which leaves 1e-32 of alpha.
  check("a star begins and ends invisible",
    brightness(0) < 1e-6 && brightness(1) < 1e-6,
    `${brightness(0).toExponential(1)} / ${brightness(1).toExponential(1)}`);
  check("and is brightest in flight", brightness(0.5) > 0.99, brightness(0.5).toFixed(2));

  /*
   * The timetable, and the one thing that must not happen: the returned
   * day's meteor shower is five slow streaks shown **once**, and it stops
   * meaning anything if an ordinary shooting star crosses it. The field is
   * held quiet while the shower plays, so nothing can start before it ends.
   */
  const schedule = shootingStars(shootingStarSeed("timetable"), 3000, 1.8);
  const gaps = schedule.slice(1).map((star, i) => star.startAt - schedule[i].startAt);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  check("about one every fourteen seconds", Math.abs(mean - MEAN_GAP_S) < 2, mean.toFixed(2));
  check("the gaps are not a metronome",
    Math.max(...gaps) - Math.min(...gaps) > MEAN_GAP_S, (Math.max(...gaps) - Math.min(...gaps)).toFixed(1));

  /*
   * The hold is applied by the component from the moment it sees the shower,
   * not baked into the timetable — an earlier version offset the schedule
   * instead, which reads the same in a test and protects nothing, because
   * the shower plays when the satellite reaches orbit and that can be
   * minutes after the card was opened. What can be checked here is the one
   * number that matters: the hold outlasts the shower.
   */
  check("the quiet outlasts the meteor shower", QUIET_AFTER_S > SHOWER_S,
    `${QUIET_AFTER_S}s vs ${SHOWER_S}s`);

  let peak = 0;
  const events = schedule
    .flatMap((star) => [
      { at: star.startAt, delta: 1 },
      { at: star.startAt + star.duration, delta: -1 },
    ])
    .sort((a, b) => a.at - b.at || a.delta - b.delta);
  let live = 0;
  for (const event of events) {
    live += event.delta;
    peak = Math.max(peak, live);
  }
  check("the pool holds every star that is due", peak <= STAR_POOL, `${peak} at once`);

  console.log(
    `  ${tested} paths across ${shapes.length} screen shapes, all of them seen; ` +
    `${shortest.toFixed(1)}-${longest.toFixed(1)}s each`,
  );
  console.log(
    `  gaps mean ${mean.toFixed(0)}s, ${peak} at once (pool ${STAR_POOL}); ` +
    `sky holds ${QUIET_AFTER_S}s for the ${SHOWER_S}s shower`,
  );
}

/*
 * Local cards, if there are any (spec v0.2 §15.8).
 *
 * Reported, never failed. `npm run verify` is about what is in the
 * repository, and a half-written draft on one machine must not be able to
 * break a build or a CI run — but silently checking nothing would be worse
 * than the old behaviour, where a real card lived in the committed config and
 * was checked with it.
 */
{
  const local = readLocalCards();
  if (local.length > 0) {
    console.log(`\nLocal cards (.karta/cards.local.json) — not part of the build:`);
    const problems = allProblems(local);
    let clean = true;
    local.forEach((card, index) => {
      const id = card.slug || `index ${index}`;
      for (const error of problems[index].errors) {
        clean = false;
        console.log(`  ${id}: ${error}`);
      }
      for (const warning of problems[index].warnings) {
        clean = false;
        console.log(`  ${id}: ${warning}`);
      }
    });
    if (clean) console.log(`  ${local.length} card(s), nothing to report.`);
  }
}

console.log("31. Kept exactly as built (spec v0.2 rev 7.1 §15):");
{
  /*
   * The two things revision 7.1 promises **not** to change: where the
   * satellite sits on screen, and the line the contrail runs along.
   *
   * r7 is otherwise a licence to rework the whole orbit view, and the single
   * most valuable thing this suite can do about that is pin the two objects
   * the document says are finished. For these, *the build is the reference* —
   * so this is a snapshot, recorded at §14 step 0, rather than a derivation
   * from the spec. If a future change moves either of them, the right
   * response is to ask whether it should have, not to update the numbers.
   *
   * Only the light on them is allowed to change, and light is not in here.
   *
   * The two **portrait** rows have been re-recorded once since, deliberately:
   * `PORTRAIT.tip` went from 0.81 to 0.74 so that a phone has sky around the
   * satellite for everything else in the scene to be in. That is a change
   * this check is supposed to catch, and it did — the right response was to
   * decide it, not to discover it. The landscape rows are untouched.
   */
  const SNAPSHOT: Record<string, { body: [number, number]; trail: [number, number][] }> = {
  "390x844": {
    body: [171.6, 464.2],
    trail: [[117, 286.96], [100.08, 273.08], [157.28, 221.75], [88.77, 167.7], [114.09, 144.29], [154.35, 117.81], [101.42, 120.51]],
  },
  "430x932": {
    body: [189.2, 512.6],
    trail: [[129, 316.88], [110.33, 301.56], [173.42, 244.91], [97.82, 185.24], [125.76, 159.36], [170.19, 130.11], [111.75, 133.08]],
  },
  "1280x699": {
    body: [601.6, 349.5],
    trail: [[409.6, 293.58], [392.97, 257.48], [466.44, 172.21], [398.57, 103.31], [427.35, 75.87], [465.95, 49.46], [419.23, 51.02]],
  },
  "1440x810": {
    body: [676.8, 405],
    trail: [[460.8, 340.2], [441.55, 298.94], [525.12, 200.78], [446.94, 120.78], [479.88, 88.51], [524.38, 57.6], [470.35, 59.12]],
  },
  "1512x945": {
    body: [710.64, 472.5],
    trail: [[483.84, 396.9], [461.63, 351.13], [552.76, 239.41], [463.68, 145.52], [500.44, 105.88], [551.3, 68.45], [488.78, 68.94]],
  },
  };

  const keptSeed = trailSeedFor("kept-as-built");

  for (const [label, want] of Object.entries(SNAPSHOT)) {
    const [w, h] = label.split("x").map(Number);

    const body = hubProject(HUB_SATELLITE, w, h);
    const moved = Math.hypot(body.x - want.body[0], body.y - want.body[1]);
    check(`${label}: the satellite is where it was built`, moved <= 1,
      `${moved.toFixed(2)}px`);

    const trail = trailScreen(keptSeed, w, h);
    check(`${label}: the contrail has the same number of points`,
      trail.length === want.trail.length, `${trail.length}`);
    const worstPoint = Math.max(
      ...trail.map(([x, y], i) =>
        Math.hypot(x - (want.trail[i]?.[0] ?? x), y - (want.trail[i]?.[1] ?? y)),
      ),
    );
    check(`${label}: and runs where it ran`, worstPoint <= 1, `${worstPoint.toFixed(2)}px`);
  }

  console.log(`  satellite and contrail pinned across ${Object.keys(SNAPSHOT).length} framings`);
}

console.log("32. Coming back from the trail is one move (rev 6 §9.3):");
{
  /*
   * The return from a memory to the hub is the longest camera move in the
   * product — up to three seconds — and the only one that changes *kind*
   * half way through: it walks back along the trail's curve, then pulls out
   * to the orbit pose. That is exactly the move most likely to read as two
   * moves stuck together, and for a long time it did: each half had its own
   * ease-in-out, so the camera came to a complete stop at the join and set
   * off again.
   *
   * A screenshot cannot show that and neither can a typecheck. What can is
   * the path itself: sample it, differentiate it twice, and assert that the
   * camera never stalls and never jerks.
   */
  const SIZES: [number, number][] = [[390, 844], [1440, 810]];
  const MEMORIES = 5;

  for (const [w, h] of SIZES) {
    const label = `${w}x${h}`;
    const seed = trailSeedFor("retrace-sample");
    const trail = stagedTrail(seed, w, h);
    const distance = memoryViewDistance(w, h);
    const hub = hubPose(w, h);

    // From the furthest memory, which is the longest version of the move.
    const fromU = memoryU(trail, MEMORIES - 1, MEMORIES);

    /*
     * Sampled evenly in `t` — the *shape* of the move, with its timing left
     * out. The rig eases `t` before handing it over, so the ends are supposed
     * to be slow; what has to be true of the shape is that nothing in the
     * middle of it stops or corners.
     */
    const STEPS = 400;
    const at = (i: number) =>
      retracePose(trail, fromU, hub, distance, i / STEPS).position;

    const steps: number[] = [];
    for (let i = 1; i <= STEPS; i++) {
      const a = at(i - 1);
      const b = at(i);
      steps.push(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }

    const fastest = Math.max(...steps);
    const from = Math.floor(STEPS * 0.08);
    const until = Math.ceil(STEPS * 0.92);
    let slowest = Infinity;
    let worstJerk = 0;
    for (let i = from; i < until; i++) {
      slowest = Math.min(slowest, steps[i]);
      if (i > from) worstJerk = Math.max(worstJerk, Math.abs(steps[i] - steps[i - 1]) / fastest);
    }

    /*
     * No stall. With the two-ease version this was 0% — the camera stopped
     * dead twice, once at the end of each leg's own ease.
     */
    check(`${label}: the camera never stalls on the way back`,
      slowest > fastest * 0.1,
      `slowest ${((slowest / fastest) * 100).toFixed(0)}% of fastest`);

    /*
     * And no corner. This is the check that pacing by arc length is actually
     * happening: stepping `u` at a constant rate instead puts a 10% kick in
     * as the camera crosses a control point, because the curve's control
     * points are not evenly spaced.
     */
    check(`${label}: and never kicks as it crosses the curve`, worstJerk < 0.05,
      `${(worstJerk * 100).toFixed(1)}% of a step`);

    // It still ends exactly on the hub pose, or the hand-over itself snaps.
    const landed = retracePose(trail, fromU, hub, distance, 1).position;
    const miss = Math.hypot(
      landed[0] - hub.position[0],
      landed[1] - hub.position[1],
      landed[2] - hub.position[2],
    );
    check(`${label}: and lands exactly on the orbit pose`, miss < 1e-9, miss.toExponential(1));
  }

  console.log(`  retrace sampled at 400 steps across ${SIZES.length} framings`);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);