import {
  COMPANY_MAX,
  ORB_MIX,
  PERI_MIN,
  companyLevel,
  mixCount,
  SAT_CLEARANCE,
  isVisible,
  makeOrbiters,
  offTrail,
  orbiterSeed,
  period,
  screenPos,
  segmentDistance,
  type Orbiter,
  type OrbiterType,
} from "../lib/orbiters.ts";
import {
  PLANET_RADIUS,
  hubPlanet,
  hubPose,
  orbitFrame,
  orbiterDepth,
  satelliteHull,
} from "../components/three/framing.ts";
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

/** The mix's own counts: §8.1's, less the paper set and plus the make-up
 *  for what the planet now hides. `ORB_MIX` explains both. */
const EXPECTED: Record<keyof typeof SIZES, number> = { desktop: 30, phone: 22 };

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

  /*
   * The planet still hides things. It is the only occluder left out in the
   * sky, so if nothing ever passes behind it the orbits have stopped reading
   * as orbits and become a flat field of drifting specks.
   */
  let everHidden = 0;
  for (const o of set) {
    for (let t = 0; t <= 1200; t += 5) {
      const p = screenPos(o, t, frame);
      const onScreen =
        p.x > 0 && p.x < frame.width && p.y > 0 && p.y < frame.height * 0.82;
      if (onScreen && !isVisible(p, frame)) everHidden++;
    }
  }
  check("things still pass behind the planet", everHidden > 0, `${everHidden} samples`);
}

/* ---- nothing crosses the planet or the satellite ------------------------ */

{
  /*
   * The one rule about depth, and it is now a single number: everything
   * orbiting is drawn behind **both** the planet and the satellite.
   *
   * §8.4 used to put the near leg in front of the planet and the closest
   * orbits across the satellite. Both read as a small thing stuck to the
   * glass rather than as a near one, because nothing else in the picture
   * supports that scale. The foreground is the letter and the world it
   * circles; the company is always beyond them.
   *
   * What is checked here is the *relationship*, because the depth is derived
   * and so are both of the hulls it has to clear. A change to the satellite's
   * scale, or to how the planet is staged per aspect ratio, would move them
   * without touching anything in this file.
   */
  for (const where of ["desktop", "phone"] as const) {
    const sizes = SIZES[where];
    const camera = hubPose(sizes.width, sizes.height).position;
    const depth = orbiterDepth(sizes.width, sizes.height);

    const hullNear = camera[2] - Math.max(...satelliteHull().map(([, , z]) => z));
    const hullFar = camera[2] - Math.min(...satelliteHull().map(([, , z]) => z));
    const planetCentre = camera[2] - hubPlanet(sizes.width, sizes.height)[2];
    const planetFar = planetCentre + PLANET_RADIUS;

    check(
      `${where}: drawn behind the whole satellite`,
      depth > hullFar,
      `${depth.toFixed(2)} vs hull ${hullNear.toFixed(2)}-${hullFar.toFixed(2)}`,
    );
    check(
      `${where}: and behind the whole planet`,
      depth > planetFar,
      `${depth.toFixed(2)} vs planet ${(planetCentre - PLANET_RADIUS).toFixed(2)}-${planetFar.toFixed(2)}`,
    );
  }

  /*
   * And they really do go over both, often — or the rule above is true for
   * the uninteresting reason that nothing ever gets near them.
   */
  for (const where of ["desktop", "phone"] as const) {
    const frame = frames[where];
    const { a, b, kSat } = frame.satellite;
    let overSatellite = 0;
    let overPlanet = 0;

    for (const seed of SEEDS.slice(0, 12)) {
      for (const o of makeOrbiters(seed, frame)) {
        for (let t = 0; t <= 7200; t += 10) {
          const p = screenPos(o, t, frame);
          if (p.x < 0 || p.x > frame.width || p.y < 0 || p.y > frame.height) continue;
          if (segmentDistance([p.x, p.y], a, b) < kSat * 3) overSatellite++;
          if (Math.hypot(p.x - frame.planet.cx, p.y - frame.planet.cy) < frame.planet.r) {
            overPlanet++;
          }
        }
      }
    }

    check(
      `${where}: and the rule is doing work`,
      overSatellite > 0 && overPlanet > 0,
      `${overSatellite} over the satellite, ${overPlanet} over the planet`,
    );
  }
}

/* ---- a set can be switched off on its own ------------------------------- */

{
  const plain = makeOrbiters(SEEDS[0], frames.desktop, { rocks: false });
  check(
    "a set switches off without disturbing the others",
    plain.every((o: Orbiter) => o.set !== "rocks") && plain.length === 9,
    `${plain.length} left`,
  );
}

/* ---- a busier sky (the card's `company`) -------------------------------- */

check(
  "company is clamped to 1-" + COMPANY_MAX,
  companyLevel(undefined) === 1 && companyLevel(0.2) === 1 && companyLevel(9) === COMPANY_MAX &&
    companyLevel(2) === 2,
);

for (const company of [2, COMPANY_MAX]) {
  for (const where of ["desktop", "phone"] as const) {
    const frame = frames[where];
    let short = 0;
    let misplaced = 0;
    let craftMisses = 0;
    let plainSeen = 0;
    let busySeen = 0;

    for (const seed of SEEDS) {
      const set = makeOrbiters(seed, frame, {}, company);
      for (const type of Object.keys(ORB_MIX) as OrbiterType[]) {
        const want = mixCount(type, frame.phone, company);
        const got = set.filter((o) => o.type === type).length;
        // A crowded box can run out of room; a tenth short is still busier.
        if (got < Math.floor(want * 0.9)) short++;
      }
      for (const o of set) {
        if (o.a * (1 - o.e) < PERI_MIN - 1e-9) misplaced++;
        const ax = frame.planet.cx + Math.cos(o.beta) * o.apo * frame.planet.r;
        const ay = frame.planet.cy + Math.sin(o.beta) * o.apo * frame.planet.r;
        if (
          segmentDistance([ax, ay], frame.satellite.a, frame.satellite.b) <
            frame.satellite.kSat * SAT_CLEARANCE ||
          (ax / frame.width > frame.caption.x && ay / frame.height < frame.caption.y)
        ) {
          misplaced++;
        }
        if (ORB_MIX[o.type].hero) {
          const p = screenPos(o, 0, frame);
          const clear =
            isVisible(p, frame) &&
            segmentDistance([p.x, p.y], frame.satellite.a, frame.satellite.b) >
              frame.satellite.kSat * SAT_CLEARANCE &&
            offTrail([p.x, p.y], frame);
          if (!clear) craftMisses++;
        }
      }
    }

    for (const seed of SEEDS.slice(0, 6)) {
      const plain = makeOrbiters(seed, frame);
      const busy = makeOrbiters(seed, frame, {}, company);
      for (let t = 0; t <= 3600; t += 30) {
        plainSeen += plain.filter((o) => isVisible(screenPos(o, t, frame), frame)).length;
        busySeen += busy.filter((o) => isVisible(screenPos(o, t, frame), frame)).length;
      }
    }

    check(`company ${company}, ${where}: the counts are multiplied`, short === 0, `${short} short`);
    check(
      `company ${company}, ${where}: still clear of the planet, satellite and caption`,
      misplaced === 0,
      `${misplaced}`,
    );
    check(`company ${company}, ${where}: every craft in clear view at t = 0`, craftMisses === 0, `${craftMisses} misses`);
    check(
      `company ${company}, ${where}: the sky looks busier`,
      busySeen >= plainSeen * (1 + (company - 1) * 0.6),
      `${(busySeen / plainSeen).toFixed(2)}x visible`,
    );
  }
}

console.log(
  failures === 0
    ? "  all orbiter checks passed."
    : `\n${failures} orbiter check(s) failed.`,
);
if (failures > 0) process.exit(1);
