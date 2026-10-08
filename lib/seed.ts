/**
 * Deterministic seeding, shared by everything that has to look random but be
 * the same every time a given card is opened: the trail's colours (§9.1) and
 * each comet's orbit rotation (§11.2).
 *
 * The spec does not say where this lives, so it lives here rather than being
 * written twice.
 */

/** FNV-1a, 32-bit. Small, stable across runs, good enough to seed from a slug. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Seeded value in [0, 1), from a hash and an index. */
export function seededUnit(seed: number, index = 0): number {
  const mixed = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b9), 0x85ebca6b) >>> 0;
  return mixed / 0x100000000;
}

/** Cubic smoothstep on [0, 1]. Zero slope at both ends, so bands never snap. */
export function smoothstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

/** Random value at each integer, smoothly interpolated between them. */
export function valueNoise1D(x: number, seed: number): number {
  const floor = Math.floor(x);
  const frac = x - floor;
  // Offset keeps negative lattice indices distinct from positive ones.
  const a = seededUnit(seed, floor + 0x4000);
  const b = seededUnit(seed, floor + 0x4001);
  return a + (b - a) * smoothstep(frac);
}
