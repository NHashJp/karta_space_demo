/**
 * How the satellite leaves the scene (spec v0.2 rev 6).
 *
 * Two different things happen to its materials, and they are not the same
 * kind of operation:
 *
 * - **Dimming**, on the closing screen, is a *multiplier*. The satellite is
 *   still there and still an object; it is simply further back in the
 *   picture, and the parts that were brighter stay brighter.
 * - **Stowing**, on the way to the trail, is a *ceiling*. The satellite is
 *   leaving, and everything it is made of has to leave together.
 *
 * That distinction is the whole of this file, and it is here rather than
 * inline because getting it wrong is invisible in code review and obvious on
 * screen. The satellite is not one material: the cube's glass sits at 0.34,
 * its wires and the array's grid at 0.94, the booms and the mast at 1. Scale
 * all of those by one factor and the ratios survive all the way down — so at
 * the moment the cube has faded past noticing, the metalwork bolted to it is
 * still three times as opaque, and the wings visibly outlive the thing they
 * are attached to. It has been reported twice.
 *
 * A ceiling collapses the difference instead. Early on it changes nothing,
 * because every material is already below it. As it comes down it takes the
 * brightest parts first, and from the moment it passes the faintest material
 * they are all at the same alpha and go out as one object.
 */

/**
 * The opacity a material should be drawn at.
 *
 * @param base     what it is when nothing is happening to it
 * @param dimming  0..1, the closing screen's multiplier
 * @param ceiling  0..1, the stow — 1 while deployed, 0 once gone
 */
export function stowedOpacity(base: number, dimming: number, ceiling: number): number {
  return Math.min(base * dimming, ceiling);
}

/**
 * The widest gap between any two of these materials at a given ceiling, as a
 * ratio. One means they are indistinguishable — which is what has to be true
 * before any of them becomes invisible, or the satellite comes apart as it
 * goes.
 */
export function fadeSpread(bases: number[], ceiling: number): number {
  const shown = bases.map((base) => stowedOpacity(base, 1, ceiling)).filter((a) => a > 0);
  if (shown.length === 0) return 1;
  return Math.max(...shown) / Math.min(...shown);
}

/**
 * Every opacity the satellite is built from, so the check below is measuring
 * the real thing. Mirrored in `MessageCube` (the shell), `SolarWings` (the
 * booms, the mast and the panel outlines) and `shaders/panelCells` (the grid).
 */
export const SATELLITE_OPACITIES = [0.34, 0.94, 1];
