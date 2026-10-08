import { hashSeed, seededUnit } from "./seed.ts";
import type { Dawn } from "./dawn.ts";

/**
 * The sun (spec v0.2 §23.3, as revised by rev 7.1 §5).
 *
 * One key light, shared by everything: the planet's terminator, the glint that
 * sweeps the satellite's panels, the rim on the atmosphere. It moves — slowly,
 * a few degrees over a minute or two — which is what makes the scene read as a
 * place rather than a picture. Nobody should ever catch it moving; the planet
 * should simply be lit differently than it was a minute ago.
 *
 * Revision 7.1 makes it **the dawn**. The colour runs from blue hour to gold
 * and the intensity doubles as the reunion nears, so the countdown is not
 * something the scene says but something it looks like. Two things follow from
 * that and both matter:
 *
 * - In the hub the direction is no longer an arc of its own. It points from
 *   the satellite at the sun coming up behind the planet's limb — the caller
 *   passes that direction in as `toSun`, because where the sun is on screen is
 *   a question about the composition and this module is pure. Without one it
 *   keeps r5's arc, which is what the landing, reading and closing screens
 *   still use: those are unchanged by r7.
 * - There is a **fill**, from the opposite side, at a quarter strength. The
 *   shadow side of the satellite is now turned away from a sun that is low and
 *   bright, and without a fill it went to black — which is the "one dark
 *   object in a cold sky" reading r7 exists to get rid of.
 *
 * Pure, so the verify suite can assert the properties that matter: it is
 * continuous (a jump in the sun is a jump in every shadow at once), it stays
 * inside the arc the composition was framed for, and the fill is never zero.
 */

export type Vec3 = [number, number, number];

export type KeyLight = {
  /** Unit vector from the scene towards the sun. */
  dir: Vec3;
  color: string;
  intensity: number;
  /** The cool bounce from the other side, so no face is ever black (§5). */
  fill: { dir: Vec3; color: string; intensity: number };
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

/**
 * r5's light, still used where r7 changes nothing: the landing screen, the
 * reading of the card, and the closing screen (§3, "where it applies").
 */
const BASE_COLOUR = "#fff4e6";
/** The day something comes back is a warmer day. */
const RETURNED_COLOUR = "#ffe2b8";
const RETURNED_BLEND = 0.1;

/** Blue hour, and the full golden sunrise the dawn runs between (§5). */
export const BLUE_HOUR_COLOUR = "#9fb8ff";
export const GOLDEN_COLOUR = "#ffe2b8";

/** The fill is the sky's own colour, not the sun's: cool, and always there. */
export const FILL_COLOUR = "#6f86c4";
export const FILL_INTENSITY = 0.25;

/** How far the sun wanders off the direction it is given: ±3° over 37 s (§5). */
const WOBBLE_DEG = 3;
const WOBBLE_S = 37;

const BREATH = 0.04;

const DEG = Math.PI / 180;

export type LightOptions = {
  /** Reduced motion freezes the sun at t = 0: a still, lit picture (§23.3). */
  reducedMotion?: boolean;
  /**
   * Where the sun actually is, as a unit vector from the satellite (rev 7.1
   * §5). Supplied by the hub, which is the only view that stages a sun;
   * everywhere else the r5 arc stands.
   */
  toSun?: Vec3;
  /** r5's warm day, for the views r7 leaves alone. Ignored once `d` is given. */
  returned?: boolean;
};

/**
 * The sun at time `t` seconds, for the card identified by `seed`, at dawn `d`.
 *
 * The seed only shifts the phases, never the arc: two cards are lit from
 * slightly different points in the same slow sweep, so they do not look
 * identical side by side without either of them looking wrong.
 *
 * Without a `d` this is r5's light exactly, because three screens still want
 * it (§3): the orbit scene is the only place the dawn applies.
 */
export function keyLight(
  t: number,
  seed: number,
  d?: Dawn,
  options: LightOptions = {},
): KeyLight {
  const time = options.reducedMotion ? 0 : t;
  const s1 = seededUnit(seed, 11) * Math.PI * 2;
  const s2 = seededUnit(seed, 12) * Math.PI * 2;
  const s3 = seededUnit(seed, 13) * Math.PI * 2;

  let dir: Vec3;
  if (options.toSun) {
    /*
     * The hub's sun, with the same small wobble the arc had. It is applied as
     * a rotation in the plane the direction already lies in rather than as an
     * azimuth, because `toSun` can point anywhere and an azimuth nudge on a
     * near-vertical vector is a very large move.
     */
    const [x, y, z] = unit(options.toSun);
    const wobble =
      ((WOBBLE_DEG * Math.PI) / 180) *
      Math.sin((2 * Math.PI * time) / WOBBLE_S + s2);
    // A perpendicular that is never degenerate, whichever way `toSun` points.
    const side = unit(
      Math.abs(y) < 0.9 ? cross([x, y, z], [0, 1, 0]) : cross([x, y, z], [1, 0, 0]),
    );
    dir = unit([
      x * Math.cos(wobble) + side[0] * Math.sin(wobble),
      y * Math.cos(wobble) + side[1] * Math.sin(wobble),
      z * Math.cos(wobble) + side[2] * Math.sin(wobble),
    ]);
  } else {
    const azimuth =
      AZIMUTH_CENTRE +
      AZIMUTH_SLOW * Math.sin((2 * Math.PI * time) / AZIMUTH_SLOW_S + s1) +
      AZIMUTH_FAST * Math.sin((2 * Math.PI * time) / AZIMUTH_FAST_S + s2);

    const elevation =
      ELEVATION_CENTRE + ELEVATION_SWING * Math.sin((2 * Math.PI * time) / ELEVATION_S + s3);

    const a = azimuth * DEG;
    const e = elevation * DEG;
    const cosE = Math.cos(e);
    dir = [cosE * Math.sin(a), Math.sin(e), cosE * Math.cos(a)];
  }

  const breath = 1 + BREATH * Math.sin((2 * Math.PI * time) / BREATH_S);

  return {
    dir,
    color: d
      ? blend(BLUE_HOUR_COLOUR, GOLDEN_COLOUR, d.p)
      : blend(BASE_COLOUR, RETURNED_COLOUR, options.returned ? RETURNED_BLEND : 0),
    // mix(0.6, 1.2, p): the day is twice as bright as blue hour (§5).
    intensity: (d ? 0.6 + 0.6 * d.p : 1) * breath,
    fill: {
      dir: [-dir[0], -dir[1], -dir[2]],
      color: FILL_COLOUR,
      intensity: FILL_INTENSITY,
    },
  };
}

function unit(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** The same seed the trail uses, so a card's light and its trail agree. */
export function lightSeed(slug: string): number {
  return hashSeed(`${slug}:light`);
}

export function blend(from: string, to: string, amount: number): string {
  const k = amount < 0 ? 0 : amount > 1 ? 1 : amount;
  const a = parseHex(from);
  const b = parseHex(to);
  const mixed = a.map((channel, i) => Math.round(channel + (b[i] - channel) * k));
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
