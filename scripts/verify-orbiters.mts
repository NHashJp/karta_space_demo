import {
  ORB_MIX,
  PERI_MIN,
  SAT_CLEARANCE,
  isVisible,
  layerOf,
  makeOrbiters,
  offTrail,
  orbiterSeed,
  period,
  screenPos,
  segmentDistance,
  type Orbiter,
  type OrbiterType,
} from "../lib/orbiters.ts";
import { orbitFrame } from "../components/three/framing.ts";
import { trailSeedFor } from "../lib/trailCurve.ts";

/**
 * Company in orbit (spec v0.2 rev 7.1 §15).
 *
 * The orbiters are the one part of r7 that cannot be judged from a screenshot.
 * A still frame says nothing about whether the sky is still populated in ten
 * minutes, whether anything ever crosses the satellite, or whether a card
 * opened twice shows the same set — and all three are the difference between
 * "the letter has company" and "there is clutter in the corner".
 *
 * So the checks here are mostly about *time*: two simulated hours, sampled
 * every ten seconds, asking how many things are in view and how fast they are
 * going. The numbers r7 gives were measured over 40 seeds in the mockup and
 * are reproduced here against the real framing.
 */

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? `  ${detail}` : ""}`);
};

const SIZES = {
  desktop: { width: 1440, height: 810 },
  phone: { width: 390, height: 844 },
};

const SEEDS = Array.from({ length: 40 }, (_, i) => orbiterSeed(`sample-card-${i}`));

console.log("Orbiters: company in orbit (spec v0.2 rev 7.1 §8, §15):");

const frames = {
  desktop: orbitFrame(trailSeedFor("sample"), SIZES.desktop.width, SIZES.desktop.height),
  phone: orbitFrame(trailSeedFor("sample"), SIZES.phone.width, SIZES.phone.height),
};

/* ---- deterministic ------------------------------------------------------ */

const first = makeOrbiters(SEEDS[0], frames.desktop);
const again = makeOrbiters(SEEDS[0], frames.desktop);
check(
  "the same seed gives the same set",
  JSON.stringify(first) === JSON.stringify(again),
);

const signatures = new Set(SEEDS.map((s) => JSON.stringify(makeOrbiters(s, frames.desktop))));
check("40 seeds give 40 different sets", signatures.size === 40, `${signatures.size}`);

/* ---- counts ------------------------------------------------------------- */

/** §8.1's counts, less the paper set (see ORB_MIX for why it is not here). */
const EXPECTED: Record<keyof typeof SIZES, number> = { desktop: 26, phone: 19 };

for (const where of ["desktop", "phone"] as const) {
  const frame = frames[where];
  let worstMissing = 0;
  const byType = new Map<OrbiterType, Set<number>>();

  for (const seed of SEEDS) {
    const set = makeOrbiters(seed, frame);
    worstMissing = Math.max(worstMissing, EXPECTED[where] - set.length);
    for (const type of Object.keys(ORB_MIX) as OrbiterType[]) {
      const counts = byType.get(type) ?? new Set<number>();
      counts.add(set.filter((o) => o.type === type).length);
      byType.set(type, counts);
    }
  }

  check(
    `${where}: at most one object is ever missing from ${EXPECTED[where]}`,
    worstMissing <= 1,
    `worst ${worstMissing}`,
  );

  for (const [type, mix] of Object.entries(ORB_MIX) as [
    OrbiterType,
    (typeof ORB_MIX)[OrbiterType],
  ][]) {
    const want = mix.n[where === "phone" ? 1 : 0];
    const seen = [...(byType.get(type) ?? [])];
    check(
      `${where}: ${type} count is ${want}`,
      seen.every((n) => n === want || n === want - 1),
      seen.sort().join("/"),
    );
  }
}

/* ---- the orbits themselves ---------------------------------------------- */

for (const where of ["desktop", "phone"] as const) {
  const frame = frames[where];
  const box = frame.phone ? { x: [0.06, 0.94], y: [0.08, 0.62] } : { x: [0.05, 0.9], y: [0.08, 0.7] };
  let worstPeriapsis = Infinity;
  let outsideRange = 0;
  let outsideBox = 0;
  let underCaption = 0;
  let onSatellite = 0;
  let shortPeriod = Infinity;
  let longPeriod = 0;

  for (const seed of SEEDS) {
    for (const o of makeOrbiters(seed, frame)) {
      worstPeriapsis = Math.min(worstPeriapsis, o.a * (1 - o.e));

      const range = ORB_MIX[o.type].d;
      if (o.apo < range[0] - 1e-9 || o.apo > range[1] + 1e-9) outsideRange++;

      // The apoapsis, back on screen: at E = π the object is at +apo along beta.
      const ax = frame.planet.cx + Math.cos(o.beta) * o.apo * frame.planet.r;
      const ay = frame.planet.cy + Math.sin(o.beta) * o.apo * frame.planet.r;
      const fx = ax / frame.width;
      const fy = ay / frame.height;
      if (fx < box.x[0] - 1e-6 || fx > box.x[1] + 1e-6 || fy < box.y[0] - 1e-6 || fy > box.y[1] + 1e-6) {
        outsideBox++;
      }
      if (fx > frame.caption.x && fy < frame.caption.y) underCaption++;
      if (
        segmentDistance([ax, ay], frame.satellite.a, frame.satellite.b) <
        frame.satellite.kSat * SAT_CLEARANCE
      ) {
        onSatellite++;
      }

      shortPeriod = Math.min(shortPeriod, period(o));
      longPeriod = Math.max(longPeriod, period(o));
    }
  }

  check(
    `${where}: nothing ever passes through the planet`,
    worstPeriapsis >= PERI_MIN - 1e-9,
    `min periapsis ${worstPeriapsis.toFixed(3)} R`,
  );
  check(`${where}: every apoapsis is in its type's range`, outsideRange === 0, `${outsideRange} out`);
  check(`${where}: every apoapsis is in the placement box`, outsideBox === 0, `${outsideBox} out`);
  check(`${where}: nothing dwells under the caption`, underCaption === 0, `${underCaption}`);
  check(`${where}: nothing dwells on the satellite`, onSatellite === 0, `${onSatellite}`);
  check(
    `${where}: periods are 5-20 minutes`,
    shortPeriod >= 300 && longPeriod <= 1200,
    `${(shortPeriod / 60).toFixed(1)}-${(longPeriod / 60).toFixed(1)} min`,
  );
}

/* ---- the start of a visit ----------------------------------------------- */

for (const where of ["desktop", "phone"] as const) {
  const frame = frames[where];
  let misses = 0;
  for (const seed of SEEDS) {
    for (const o of makeOrbiters(seed, frame)) {
      if (!ORB_MIX[o.type].hero) continue;
      const p = screenPos(o, 0, frame);
      const clear =
        isVisible(p, frame) &&
        segmentDistance([p.x, p.y], frame.satellite.a, frame.satellite.b) >
          frame.satellite.kSat * SAT_CLEARANCE &&
        offTrail([p.x, p.y], frame);
      if (!clear) misses++;
    }
  }
  check(`${where}: every craft is in clear view at t = 0`, misses === 0, `${misses} misses`);
}

/* ---- two hours ---------------------------------------------------------- */

const STEADY = {
  desktop: { median: 10, p10: 6 },
  phone: { median: 6, p10: 3 },
};

for (const where of ["desktop", "phone"] as const) {
  const frame = frames[where];
  const counts: number[] = [];

  for (const seed of SEEDS.slice(0, 12)) {
    const set = makeOrbiters(seed, frame);
    for (let t = 0; t <= 7200; t += 10) {
      counts.push(set.filter((o) => isVisible(screenPos(o, t, frame), frame)).length);
    }
  }

  counts.sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  const p10 = counts[Math.floor(counts.length * 0.1)];
  const want = STEADY[where];

  check(
    `${where}: the sky stays populated over two hours`,
    median >= want.median && p10 >= want.p10,
    `median ${median}, p10 ${p10}`,
  );
}

/* ---- calm --------------------------------------------------------------- */

/*
 * §15 gives 12 px/s at 1440x810 and 7 px/s at 390x844, measured in the mockup.
 *
 * The mockup draws the planet at 0.495 x width; this build draws it at 0.55
 * (r6's number, which r7 §4 leaves alone). An orbiter's screen speed is
 * proportional to the planet's screen radius — the orbit is measured in planet
 * radii — so the same ORB_BASE_S of 330 s yields 11% more pixels per second
 * here, and the limit is scaled by exactly that ratio rather than the period
 * being changed. The document's constants win over the mockup; this is the one
 * number in §15 that is derived from the mockup's own composition.
 */
const PLANET_SCALE = 0.55 / 0.495;
const SPEED_LIMIT = { desktop: 12 * PLANET_SCALE, phone: 7 };
const STEP = 0.1;

for (const where of ["desktop", "phone"] as const) {
  const frame = frames[where];
  let fastest = 0;
  let worstJump = 0;

  for (const seed of SEEDS.slice(0, 12)) {
    for (const o of makeOrbiters(seed, frame)) {
      for (let t = 0; t <= 1200; t += 2) {
        const a = screenPos(o, t, frame);
        const b = screenPos(o, t + STEP, frame);
        // Only count it while it is actually on screen: the fast swing past
        // the planet happens behind the planet, where nobody sees it.
        if (!isVisible(a, frame)) continue;
        const jump = Math.hypot(b.x - a.x, b.y - a.y);
        worstJump = Math.max(worstJump, jump);
        fastest = Math.max(fastest, jump / STEP);
      }
    }
  }

  check(
    `${where}: nothing goes faster than ${SPEED_LIMIT[where].toFixed(1)} px/s`,
    fastest <= SPEED_LIMIT[where],
    `${fastest.toFixed(1)} px/s`,
  );
  check(`${where}: nothing jumps more than 2px in 0.1s`, worstJump <= 2, `${worstJump.toFixed(2)}px`);
}

/* ---- the clock rate is a rate, not a position --------------------------- */

{
  const frame = frames.desktop;
  const set = makeOrbiters(SEEDS[3], frame);
  /*
   * The review mockup can run the sky at six times speed. That must be a
   * change to how fast `t` advances and never to `t` itself — otherwise
   * switching back and forth teleports everything, which is exactly the bug
   * this check exists to prevent in the build's own fade in and out.
   */
  let worst = 0;
  for (const o of set) {
    for (const t of [0, 37.5, 410, 2000]) {
      const a = screenPos(o, t, frame);
      const b = screenPos(o, t, frame);
      worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  check("position depends only on t", worst === 0);

  // And the three depth layers are all actually used, or the planet never
  // occludes anything and the whole reading of §8.4 is lost.
  const layers = new Set<string>();
  for (const o of set) for (let t = 0; t <= 1200; t += 5) layers.add(layerOf(screenPos(o, t, frame)));
  check("all three depth layers occur", layers.size === 3, [...layers].join("/"));
}

/* ---- a set can be switched off on its own ------------------------------- */

{
  const plain = makeOrbiters(SEEDS[0], frames.desktop, { rocks: false });
  check(
    "a set switches off without disturbing the others",
    plain.every((o: Orbiter) => o.set !== "rocks") && plain.length === 8,
    `${plain.length} left`,
  );
}

console.log(
  failures === 0
    ? "  all orbiter checks passed."
    : `\n${failures} orbiter check(s) failed.`,
);
if (failures > 0) process.exit(1);
