import { hashSeed } from "./seed.ts";

/**
 * Company in orbit (spec v0.2 rev 7.1 §8).
 *
 * Revision 6's hub held one object in an empty sky. Everything about the
 * geometry was right and the whole thing read as *after* something — which
 * is the opposite of what a letter counting down to a reunion is for. R30's
 * answer is not to make the satellite busier but to give it neighbours:
 * tiny satellites blinking, a station catching the sun, tumbling rocks, a far
 * moonlet, a paper crane and a couple of paper planes.
 *
 * Three decisions carry the whole effect and none of them is decoration.
 *
 * **The orbits are real.** Kepler ellipses with the planet's centre at one
 * focus, seen nearly edge-on, which means every object *slows and turns* out
 * in the sky where you can see it and *falls away fast* past the planet. A
 * thing that moves at a constant speed across a frame reads as a sprite on a
 * path; a thing that hangs, turns over and drops reads as being in orbit.
 * That difference is the entire reason this module solves Kepler's equation
 * instead of interpolating an ellipse.
 *
 * **Nothing darts.** The period is 7 to 14 minutes, so the median speed on
 * screen is about 5 px/s. You cannot watch one of these move. You can look
 * away and look back and find it somewhere else, which is the pace of a sky.
 *
 * **Every card gets its own set**, seeded from the slug. Two cards opened side
 * by side are visibly different skies, and the same card is the same sky every
 * time it is opened.
 *
 * Pure: no three.js, no DOM, no clock. The renderer asks it where things are
 * at time `t`; the verify suite asks it the same question two hours in.
 */

export type OrbiterType = "cubesat" | "station" | "rock" | "moonlet";
export type OrbiterSet = "craft" | "rocks" | "moon";

/** Seconds for one orbit with a semi-major axis of one planet radius. */
export const ORB_BASE_S = 330;

/** The periapsis never dips below the atmosphere, in planet radii. */
export const PERI_MIN = 1.06;

/** How far from the satellite's span an apoapsis has to sit, in body half-edges. */
export const SAT_CLEARANCE = 1.6;

/** How far from the contrail a craft has to start, as a fraction of the width. */
export const TRAIL_CLEARANCE = 0.06;

/**
 * The mix (§8.1), minus one set.
 *
 * §8.1 also lists a **paper** set — a paper crane and two paper planes. It is
 * not here. r7 calls it "the playful one" and makes it switchable precisely
 * because it is the part of R30 that is a different kind of object from the
 * rest: everything else up here is a spacecraft or a rock, on an orbit, in
 * vacuum, and origami is a thing from the other world entirely. Next to the
 * satellite — which *is* the letter — it read as decoration rather than as
 * company, which is the one thing R30 is trying not to be.
 *
 * Dropped rather than merely switched off, so there is no dead shape code
 * waiting to be switched back on by accident. §8.1's counts drop with it:
 * 26 on a desktop and 19 on a phone, not 29 and 21.
 */
export const ORB_MIX: Record<
  OrbiterType,
  {
    set: OrbiterSet;
    /** [desktop, phone] */
    n: [number, number];
    /** Apoapsis distance from the planet's centre, in planet radii. */
    d: [number, number];
    /** Must be in view at t = 0. Rocks are not: they keep a uniform phase. */
    hero: boolean;
  }
> = {
  cubesat: { set: "craft", n: [6, 5], d: [1.3, 2.0], hero: true },
  station: { set: "craft", n: [1, 1], d: [1.4, 1.8], hero: true },
  rock: { set: "rocks", n: [18, 12], d: [1.25, 2.7], hero: false },
  moonlet: { set: "moon", n: [1, 1], d: [1.95, 2.5], hero: true },
};

export type Orbiter = {
  type: OrbiterType;
  set: OrbiterSet;
  /** Apoapsis distance from the planet's centre, in planet radii. */
  apo: number;
  e: number;
  /** Semi-major axis, in planet radii. */
  a: number;
  /** Direction of the apoapsis in the screen plane, radians (screen y down). */
  beta: number;
  /** 0.06–0.40: how open the ellipse looks — the plane's tilt off the line of sight. */
  thin: number;
  /** Mean anomaly at t = 0. */
  ph: number;
  dir: 1 | -1;
  size: number;
  /** Rock size, 0–1. */
  rs: number;
  /** Radians per second, −0.25…0.25. */
  spin: number;
  /** A phase for blinks, glints and spin. */
  sp: number;
  /** Seven radial factors, 0.65–1.15 (rocks). */
  shape: number[];
};

/** The orbital period, in seconds. Kepler's third law, with ORB_BASE_S as the unit. */
export function period(o: Orbiter): number {
  return ORB_BASE_S * Math.pow(o.a, 1.5);
}

/**
 * Where an orbiter is at time `t`, in planet radii, with the planet at the
 * origin. X right, Y **down** (as on screen), Z towards the camera.
 *
 * Six Newton steps on Kepler's equation. Six is not a guess: the eccentricity
 * here never exceeds about 0.46, where Newton converges quadratically from
 * E = M, so six steps are at machine precision and a seventh changes nothing.
 */
export function orbiterPos(o: Orbiter, t: number): [number, number, number] {
  const M = o.ph + o.dir * 2 * Math.PI * (t / period(o));
  let E = M;
  for (let i = 0; i < 6; i++) {
    E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
  }

  // Along the apoapsis direction (+apo at E = π), and across it in the plane.
  const u = o.a * (o.e - Math.cos(E));
  const w = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);

  const bx = Math.cos(o.beta);
  const by = Math.sin(o.beta);
  const nx = -by;
  const ny = bx;

  /*
   * `thin` is the cosine of how far the orbital plane is turned out of the
   * screen. The across-track component is split between the screen (× thin)
   * and the line of sight (× sqrt(1 − thin²)), which is what makes a circle
   * in space read as a long, thin ellipse on screen — and what sends the
   * object behind the planet on one leg and in front of it on the other.
   */
  return [
    bx * u + nx * w * o.thin,
    by * u + ny * w * o.thin,
    w * Math.sqrt(1 - o.thin * o.thin),
  ];
}

/* ---------------------------------------------------------------------------
 * Placement (§8.3)
 * ------------------------------------------------------------------------- */

/** The hub, in screen pixels, as `components/three/framing.ts` measures it. */
export type OrbitFrameLike = {
  width: number;
  height: number;
  phone: boolean;
  planet: { cx: number; cy: number; r: number };
  satellite: { a: [number, number]; b: [number, number]; kSat: number };
  /** The contrail's polyline. Empty on a card with no memories. */
  trail: [number, number][];
  /** The top-right corner the promise caption covers, as viewport fractions. */
  caption: { x: number; y: number };
};

/** Where apoapses may sit, as viewport fractions (§4). */
const BOX = {
  phone: { x: [0.06, 0.94], y: [0.08, 0.62] },
  desktop: { x: [0.05, 0.9], y: [0.08, 0.7] },
} as const;

/** How many times placement will try before giving up on one object (§8.3). */
const PLACEMENT_TRIES = 80;
/** How many phases a hero will try before it is allowed to start hidden. */
const PHASE_TRIES = 60;

/**
 * The PRNG. An LCG, seeded the way the mockup seeds it, so the sets this
 * produces are the sets the mockup's numbers in §15 were measured from.
 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The per-card seed. Falls back to the slug's hash, as §8.2 allows. */
export function orbiterSeed(slug: string): number {
  return hashSeed(`${slug}:orbit`);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Distance from p to the segment a–b. */
export function segmentDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const length = vx * vx + vy * vy;
  const u = length < 1e-9 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / length));
  return Math.hypot(p[0] - a[0] - vx * u, p[1] - a[1] - vy * u);
}

/** Where an orbiter is on screen, in pixels, plus its depth sign. */
export type OrbiterPoint = { x: number; y: number; z: number; apo: number };

export function screenPos(o: Orbiter, t: number, frame: OrbitFrameLike): OrbiterPoint {
  const [x, y, z] = orbiterPos(o, t);
  const R = frame.planet.r;
  return {
    x: frame.planet.cx + x * R,
    y: frame.planet.cy + y * R,
    z: z * R,
    apo: o.apo * R,
  };
}

/**
 * Visible, for placement and for verify (§8.3 step 4).
 *
 * Two ways to be invisible: off the edges of the frame, or on the far leg of
 * the orbit with the planet's disc in the way. The second is the one that
 * matters — it is how the sky keeps changing without anything appearing from
 * nowhere.
 */
export function isVisible(p: OrbiterPoint, frame: OrbitFrameLike): boolean {
  const behind = p.z < 0 && Math.hypot(p.x - frame.planet.cx, p.y - frame.planet.cy) < frame.planet.r;
  if (behind) return false;
  return (
    p.x > frame.width * 0.03 &&
    p.x < frame.width * 0.97 &&
    p.y > frame.height * 0.04 &&
    // Above the bottom bar, which is chrome and not sky.
    p.y < frame.height * 0.82
  );
}

/**
 * The set of things orbiting this card's planet, in this frame.
 *
 * Deterministic in `seed` and in the frame. Two cards differ; one card on two
 * visits does not; and resizing the window re-places them, which is correct —
 * the composition it was placed into is a different composition.
 */
export function makeOrbiters(
  seed: number,
  frame: OrbitFrameLike,
  sets: Partial<Record<OrbiterSet, boolean>> = {},
): Orbiter[] {
  const r = lcg(Math.imul(seed, 7919) + 13);
  const out: Orbiter[] = [];
  const box = frame.phone ? BOX.phone : BOX.desktop;
  const { a: wingA, b: wingB, kSat } = frame.satellite;
  const clearSat = kSat * SAT_CLEARANCE;

  for (const [type, mix] of Object.entries(ORB_MIX) as [
    OrbiterType,
    (typeof ORB_MIX)[OrbiterType],
  ][]) {
    if (sets[mix.set] === false) continue;
    const n = mix.n[frame.phone ? 1 : 0];

    for (let i = 0; i < n; i++) {
      /*
       * 1. Pick the apoapsis **on screen**, not in space.
       *
       * This is the inversion that makes the whole thing work. An orbit
       * chosen in space puts its slow, turning, interesting part wherever the
       * geometry happens to put it — usually off the frame. Choosing the
       * dwell point first and solving for an orbit through it guarantees that
       * what the reader sees is every object at its most legible.
       */
      let found: [number, number, number] | null = null;
      for (let k = 0; k < PLACEMENT_TRIES && !found; k++) {
        const x = lerp(box.x[0], box.x[1], r()) * frame.width;
        const y = lerp(box.y[0], box.y[1], r()) * frame.height;
        const d = Math.hypot(x - frame.planet.cx, y - frame.planet.cy) / frame.planet.r;
        const underCaption = x > frame.caption.x * frame.width && y < frame.caption.y * frame.height;
        const onSatellite = segmentDistance([x, y], wingA, wingB) < clearSat;
        if (d >= mix.d[0] && d <= mix.d[1] && !underCaption && !onSatellite) {
          found = [x, y, d];
        }
      }
      // At most one may be missing (§15). Skipping is better than placing one
      // on top of the satellite, which is the only thing on screen that matters.
      if (!found) continue;

      const apo = found[2];
      /*
       * 2. The eccentricity, capped so the periapsis clears the atmosphere.
       *
       * Then biased *high* — 0.6 to 1 of the maximum — because the whole
       * point is the dwell: an eccentric orbit spends most of its period near
       * apoapsis, which is the point we just placed inside the frame.
       */
      const eMax = (apo - PERI_MIN) / (apo + PERI_MIN);
      const e = eMax * lerp(0.6, 1, r());

      const o: Orbiter = {
        type,
        set: mix.set,
        apo,
        e,
        a: apo / (1 + e),
        beta: Math.atan2(found[1] - frame.planet.cy, found[0] - frame.planet.cx),
        thin: lerp(0.06, 0.4, r()),
        ph: r() * Math.PI * 2,
        dir: r() < 0.5 ? 1 : -1,
        size: 0.85 + r() * 0.35,
        rs: r(),
        spin: (r() - 0.5) * 0.5,
        sp: r() * Math.PI * 2,
        shape: Array.from({ length: 7 }, () => 0.65 + r() * 0.5),
      };

      /*
       * 3. Heroes start in view, and clear of both the satellite and the
       * contrail. Rocks do not: they keep a uniform phase, which is what
       * makes the sky at minute ten look like the sky at second one instead
       * of like a set that has drifted off.
       */
      if (mix.hero) {
        for (let k = 0; k < PHASE_TRIES && !startsWell(o, frame, clearSat); k++) {
          o.ph = r() * Math.PI * 2;
        }
      }

      out.push(o);
    }
  }

  return out;
}

function startsWell(o: Orbiter, frame: OrbitFrameLike, clearSat: number): boolean {
  const p = screenPos(o, 0, frame);
  if (!isVisible(p, frame)) return false;
  if (segmentDistance([p.x, p.y], frame.satellite.a, frame.satellite.b) <= clearSat) return false;
  return offTrail([p.x, p.y], frame);
}

/** Clear of the contrail by 6% of the width (§8.3). It is kept as built (§7). */
export function offTrail(p: [number, number], frame: OrbitFrameLike): boolean {
  const gap = frame.width * TRAIL_CLEARANCE;
  for (let i = 1; i < frame.trail.length; i++) {
    if (segmentDistance(p, frame.trail[i - 1], frame.trail[i]) <= gap) return false;
  }
  return true;
}

/* ---------------------------------------------------------------------------
 * Depth (§8.4)
 * ------------------------------------------------------------------------- */

export type OrbiterLayer = "far" | "near" | "nearest";

/**
 * Which of three layers an orbiter is in this frame.
 *
 * The point of the layers is a single reading: *things pass behind the planet
 * on one side and in front of it on the other*. On the far leg the planet's
 * own depth hides them. On the near leg they are in front of the planet but
 * behind the satellite, which is the letter and stays the subject. Only the
 * closest part of the closest orbits crosses the satellite at all.
 */
export function layerOf(p: OrbiterPoint): OrbiterLayer {
  if (p.z < 0) return "far";
  return p.z < 0.6 * p.apo ? "near" : "nearest";
}

/** Near-leg things read larger, far-leg things smaller (§8.4, §8.5). */
export function depthScale(p: OrbiterPoint): number {
  return 1 + 0.35 * (p.z / p.apo);
}

/** The base pixel scale before an object's own `size` (§8.5). */
export function pixelScale(frame: OrbitFrameLike): number {
  return frame.phone ? 1.15 : 1.3 * Math.min(1.45, Math.max(0.9, frame.width / 1000));
}

/** Overall light level: the far leg sits a little deeper in the haze (§8.6). */
export function litLevel(p: OrbiterPoint, dawnP: number): number {
  return (0.72 + 0.28 * dawnP) * (p.z < 0 ? 0.85 : 1);
}
