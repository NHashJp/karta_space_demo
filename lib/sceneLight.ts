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

/* ---------------------------------------------------------------------------
 * The hub's co-moving camera (spec v0.2 rev 6, §3.2)
 * ------------------------------------------------------------------------- */

/**
 * Station keeping.
 *
 * In the hub the satellite does not travel round a ring on screen — the camera
 * moves with it, the way a chase view does. What is left is the drift of a
 * thing holding its position: ±3% and ±2.4° over 30 seconds.
 *
 * §3.2 specifies half of that. It was implemented exactly and read as parked —
 * a 1.5% drift on a phone is six pixels over half a minute, which nobody will
 * ever see. Doubling it is a deliberate departure from the number, and it is
 * still small enough that the body centre stays well inside the 4% the framing
 * checks allow.
 *
 * This is why the hub feels like *being alongside* rather than watching from a
 * fixed point. A satellite sliding across the frame every 48 seconds reads as
 * a diagram of an orbit; one that holds still while the sky turns behind it
 * reads as the place you are.
 */
export const STATION_PERIOD_S = 30;
export const STATION_DRIFT = 0.03;
export const STATION_ROLL_DEG = 2.4;

/** The sky turns instead, at 1.2° per 10 s — the orbit, felt rather than drawn. */
export const SKY_TURN_DEG_PER_S = 0.12;

export function stationKeeping(t: number, seed: number, options: LightOptions = {}) {
  if (options.reducedMotion) return { offsetX: 0, offsetY: 0, roll: 0 };

  const phase = seededUnit(seed, 31) * Math.PI * 2;
  const angle = (2 * Math.PI * t) / STATION_PERIOD_S + phase;
  return {
    // Two axes on different multiples, so it wanders rather than swings.
    offsetX: STATION_DRIFT * Math.sin(angle),
    offsetY: STATION_DRIFT * Math.sin(angle * 0.63 + 1.1),
    roll: STATION_ROLL_DEG * DEG * Math.sin(angle * 0.81),
  };
}

/** How far the sky has turned by `t`, in radians. */
export function skyTurn(t: number, options: LightOptions = {}): number {
  return options.reducedMotion ? 0 : (t * SKY_TURN_DEG_PER_S * Math.PI) / 180;
}
