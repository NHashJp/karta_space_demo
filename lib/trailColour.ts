import { hashSeed, seededUnit, smoothstep, valueNoise1D } from "./seed.ts";

/**
 * The contrail's colours drift (spec v0.2 §9.1, R7). At any moment the trail
 * shows two to four colours blending along its length; the bands slide slowly,
 * and any one point takes 20-40 seconds to become a different colour. No
 * cycling rainbows, no flashes — it should never be *noticed* changing.
 *
 * Pure, and mirrored in shaders/ribbon.ts, so the same colour can be computed
 * on the CPU (memory glints, panel tints) and on the GPU (the ribbon itself).
 */

export type Rgb = [number, number, number];

/** Five colours, every one already in the scene, so the trail is never foreign. */
export const PALETTE: Rgb[] = [
  [0.498, 0.831, 0.961], // #7fd4f5 the closing line's stroke
  [0.0, 0.682, 0.937], // #00aeef --ion
  [0.561, 0.498, 0.839], // #8f7fd6 --nebula, lifted for additive blending
  [0.780, 0.478, 0.659], // #c77aa8 the nebula shader's ember, lifted
  [0.910, 0.914, 0.922], // #e8e9eb --starlight
];

const STARLIGHT = PALETTE[4];

/**
 * How many noise lattice cells the trail's length spans — how many colour
 * bands are on the trail at once.
 *
 * §9.1 writes 3.0, which moves the colour along `u` fast enough to break the
 * continuity bound §17 asks verify to enforce (< 0.08 per channel between
 * samples 0.01 apart), and puts more than the two-to-four bands §9.1 itself
 * describes on the trail. Measured worst case per channel: 3.0 -> 0.21,
 * 1.6 -> 0.085, 1.2 -> 0.066. Recorded in docs/content-and-cards.md.
 */
export const BAND_SCALE = 1.2;

/**
 * The near end reads as exhaust: it blends toward starlight.
 *
 * §9.1 says 5%. Ramping all the way to white across 5% of `u` moves a channel
 * by 0.18 between samples 0.01 apart — on its own enough to break the same
 * continuity bound. The ramp is widened rather than removed: the same reading,
 * a white-hot near end fading into the card's own colours, inside the bound.
 */
const EXHAUST_U = 0.3;

export type TrailSeed = { s1: number; s2: number; s3: number; noise: number };

export function trailSeed(slug: string): TrailSeed {
  const seed = hashSeed(`trail:${slug}`);
  return {
    s1: seededUnit(seed, 1) * 100,
    s2: seededUnit(seed, 2) * Math.PI * 2,
    s3: seededUnit(seed, 3) * Math.PI * 2,
    noise: seed,
  };
}

/**
 * Where the bands have slid to at time `t`, in seconds. Two sines with
 * unrelated periods over a slow linear drift, like the nebula's flow field, so
 * the pattern never repeats.
 */
export function drift(t: number, seed: TrailSeed): number {
  return 0.018 * t + 0.35 * Math.sin(t / 23 + seed.s2) + 0.20 * Math.sin(t / 37 + seed.s3);
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

/**
 * The colour at position `u` along the trail (0 near, 1 far) at time `t`.
 * With `reducedMotion`, time is frozen: the card keeps its own colours, they
 * simply stop moving.
 */
export function trailColour(u: number, t: number, seed: TrailSeed, reducedMotion = false): Rgb {
  const at = reducedMotion ? 0 : drift(t, seed);
  const c = 5 * valueNoise1D(BAND_SCALE * u + seed.s1 + at, seed.noise);

  const index = Math.floor(c);
  const from = PALETTE[((index % 5) + 5) % 5];
  const to = PALETTE[((index + 1) % 5 + 5) % 5];
  const colour = mix(from, to, smoothstep(c - index));

  // Where the trail leaves the cube it is exhaust, not nebula.
  if (u < EXHAUST_U) return mix(colour, STARLIGHT, 1 - u / EXHAUST_U);
  return colour;
}

/** The ribbon fades out along its length. */
export function trailAlpha(u: number): number {
  return 0.95 * Math.pow(1 - Math.min(Math.max(u, 0), 1), 1.3);
}

export function toCss([r, g, b]: Rgb): string {
  const channel = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
