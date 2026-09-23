import { hashSeed, seededUnit } from "./seed.ts";

/**
 * The sun (spec v0.2 §23.3).
 *
 * One key light, shared by everything: the planet's terminator, the glint that
 * sweeps the satellite's panels, the rim on the atmosphere. It moves — slowly,
 * a few degrees over a minute or two — which is what makes the scene read as a
 * place rather than a picture. Nobody should ever catch it moving; the planet
 * should simply be lit differently than it was a minute ago.
 *
 * Pure, so the verify suite can assert the two properties that matter: it is
 * continuous (a jump in the sun is a jump in every shadow at once), and it
 * stays inside the arc the composition was framed for.
 */

export type KeyLight = {
  /** Unit vector from the scene towards the sun. */
  dir: [number, number, number];
  color: string;
  intensity: number;
};

/** The arc the sun is allowed to travel, in degrees. */
export const AZIMUTH_CENTRE = -38;
export const AZIMUTH_SLOW = 9;
export const AZIMUTH_FAST = 3;
export const ELEVATION_CENTRE = 42;
export const ELEVATION_SWING = 5;

/** Seconds. Co-prime-ish periods, so the pattern never visibly repeats. */
const AZIMUTH_SLOW_S = 96;
const AZIMUTH_FAST_S = 37;
const ELEVATION_S = 71;
const BREATH_S = 23;

const BASE_COLOUR = "#fff4e6";
/** The day something comes back is a warmer day. */
const RETURNED_COLOUR = "#ffe2b8";
const RETURNED_BLEND = 0.1;

const BREATH = 0.06;

const DEG = Math.PI / 180;

export type LightOptions = {
  /** Reduced motion freezes the sun at t = 0: a still, lit picture (§23.3). */
  reducedMotion?: boolean;
};

/**
 * The sun at time `t` seconds, for the card identified by `seed`.
 *
 * The seed only shifts the phases, never the arc: two cards are lit from
 * slightly different points in the same slow sweep, so they do not look
 * identical side by side without either of them looking wrong.
 */
export function keyLight(
  t: number,
  seed: number,
  returned: boolean,
  options: LightOptions = {},
): KeyLight {
  const time = options.reducedMotion ? 0 : t;
  const s1 = seededUnit(seed, 11) * Math.PI * 2;
  const s2 = seededUnit(seed, 12) * Math.PI * 2;
  const s3 = seededUnit(seed, 13) * Math.PI * 2;

  const azimuth =
    AZIMUTH_CENTRE +
    AZIMUTH_SLOW * Math.sin((2 * Math.PI * time) / AZIMUTH_SLOW_S + s1) +
    AZIMUTH_FAST * Math.sin((2 * Math.PI * time) / AZIMUTH_FAST_S + s2);

  const elevation =
    ELEVATION_CENTRE + ELEVATION_SWING * Math.sin((2 * Math.PI * time) / ELEVATION_S + s3);

  const a = azimuth * DEG;
  const e = elevation * DEG;
  const cosE = Math.cos(e);

  return {
    dir: [cosE * Math.sin(a), Math.sin(e), cosE * Math.cos(a)],
    color: returned ? blend(BASE_COLOUR, RETURNED_COLOUR, RETURNED_BLEND) : BASE_COLOUR,
    intensity: 1 + BREATH * Math.sin((2 * Math.PI * time) / BREATH_S),
  };
}

/** The same seed the trail uses, so a card's light and its trail agree. */
export function lightSeed(slug: string): number {
  return hashSeed(`${slug}:light`);
}

function blend(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const mixed = a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Camera breathing (§23.2): a slow dolly and roll while the scene is at rest.
 *
 * Returns multipliers rather than positions, because the rig owns where the
 * camera is and this only nudges it. It is **never** applied while text is
 * being read — a paragraph that drifts while your eyes are on it is worse than
 * a still scene, and §17 checks the breath is zero in `reading`, `remembering`
 * and `inside`.
 */
export const BREATH_PERIOD_S = 26;
export const BREATH_DISTANCE = 0.007; // ±0.7%
export const BREATH_ROLL_DEG = 0.22;

export function cameraBreath(t: number, seed: number, options: LightOptions = {}) {
  if (options.reducedMotion) return { distance: 1, roll: 0 };
  const phase = seededUnit(seed, 21) * Math.PI * 2;
  const angle = (2 * Math.PI * t) / BREATH_PERIOD_S + phase;
  return {
    distance: 1 + BREATH_DISTANCE * Math.sin(angle),
    roll: BREATH_ROLL_DEG * DEG * Math.sin(angle * 0.5),
  };
}
