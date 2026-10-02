"use client";

/**
 * The screen layer (spec v0.2 §23.2, L7): a vignette and a film grain over
 * everything.
 *
 * Both are DOM rather than a post-processing pass, deliberately. A
 * post-process would cost a full-screen render target on a phone that is
 * already drawing a nebula, a planet and two comets, for an effect that is two
 * CSS layers. The grain is one 160px tile stepped at 150 ms — the one static
 * texture in the whole product, because good noise is not worth a shader.
 *
 * What it buys: the vignette pulls the eye to the middle of the frame, where
 * every screen puts its text, and the grain hides the banding that a very dark
 * gradient shows on an 8-bit display.
 */
export function AmbientOverlay() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__vignette" />
      <div className="ambient__grain" />
    </div>
  );
}
