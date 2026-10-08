/**
 * Solar-panel cells (spec v0.2 §8.2).
 *
 * A grid, drawn rather than textured, on a navy plate. The spec asks these to
 * "read as elegant hardware, not a toy", and the thing that decides which one
 * you get is the **scale of the cells relative to the plate**: too large and
 * it is a chessboard, too small and it is a flat navy rectangle. Sixteen by
 * six, with a hairline gap and a very low emissive, is where hardware starts.
 *
 * The other half of it is the glint. A real panel is glass over silicon: it is
 * nearly black until the sun's angle lines up, and then it flares.
 *
 * Revision 6 left that to the specular term alone, and in practice it never
 * fired. The idea was that the sun's own drift would sweep the flare across
 * the panels every couple of minutes — but the satellite holds station, the
 * sun's wobble is ±3°, and a `pow(·, 68)` lobe is a few degrees wide: the
 * angles essentially never line up, so the arrays were simply dark glass for
 * the whole visit.
 *
 * So r7 §5's sweep is **driven**, not hoped for. A narrow pulse runs across
 * the six panels in turn on a nine-second cycle, each one flashing for about
 * a third of a second, with four seconds of quiet before it comes round
 * again. It is the one thing in the hub that is briefly, deliberately bright,
 * and it is what stops the satellite reading as a dead object: hardware in
 * sunlight catches the light, and a thing that never catches the light is a
 * thing that is not there.
 *
 * The cap is §5's: at most `0.06 + 0.14 · p`, and added rather than replacing,
 * so a panel is never washed out. The specular is kept underneath it for the
 * rare moments the angles really do line up.
 */

export const panelCellsVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const panelCellsFragmentShader = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uCell;
  uniform vec3 uLine;
  uniform vec3 uSun;
  uniform vec3 uSunColor;
  uniform float uOpacity;
  /** Seconds. Frozen under reduced motion, which stills the sweep. */
  uniform float uTime;
  /** The dawn, 0.2..1: the sweep is brighter the nearer the day (r7 §5). */
  uniform float uDawn;
  /** Which of the six panels this is, left to right across the satellite. */
  uniform float uIndex;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  const vec2 CELLS = vec2(6.0, 16.0);

  /** One sweep every nine seconds, the six panels 0.12 of a phase apart. */
  const float SWEEP_S = 9.0;
  const float SWEEP_SPAN = 1.8;
  const float SWEEP_LEAD = 0.35;
  const float SWEEP_STAGGER = 0.12;
  /** Variance of the pulse. 0.004 is about a third of a second per panel. */
  const float SWEEP_WIDTH = 0.004;

  /*
   * The array as the mockups draw it (M5, M12a, M14b): dark glass with a pale
   * wire grid ruled over it, not a lit blue surface with dark seams between
   * the cells.
   *
   * The difference is which of the two is the figure. A bright panel is a
   * solid object that happens to be near the letter; a dark one you can see a
   * little sky through is a structure the letter is carried on, and it lets
   * the cube stay the brightest thing in the frame — which is the whole point
   * of the composition.
   */
  void main() {
    vec2 cell = fract(vUv * CELLS);
    vec2 edge = min(cell, 1.0 - cell);
    // A thin ruled line, rather than a wide gap between lit cells.
    float grid = 1.0 - smoothstep(0.0, 0.03, min(edge.x, edge.y));

    // A bus bar down the middle of each panel: one asymmetry, which is most of
    // what stops a regular grid reading as wallpaper.
    float bar = 1.0 - smoothstep(0.0, 0.01, abs(vUv.x - 0.5));
    float line = max(grid, bar);

    vec3 normal = normalize(vNormal);
    float ndl = max(dot(normal, uSun), 0.0);

    // The plate: dark glass, barely lit, with the faintest cast of the cell
    // colour still in it so it is not simply grey.
    vec3 plate = mix(uBase, uCell, 0.14) * (0.18 + 0.36 * ndl);
    // And the wire ruled across it, which does catch the sun.
    vec3 wire = uLine * (0.5 + 0.5 * ndl);

    vec3 color = mix(plate, wire, line);

    // Glass over silicon: almost nothing until the angle lines up, then a
    // flare. Kept for the rare moments it really does line up.
    vec3 halfway = normalize(uSun + vView);
    float glint = pow(max(dot(normal, halfway), 0.0), 68.0);
    color += uSunColor * glint * 0.55;

    /*
     * And the sweep (r7 §5). A narrow pulse crossing the six panels in turn:
     * this one's moment arrives uIndex * SWEEP_STAGGER into the run, and
     * lasts about a third of a second.
     *
     * Leaned on the facing term, but only gently. Gating it on N·L outright
     * would put it back where revision 6 left it — invisible whenever the
     * geometry did not cooperate — and the point of §5's sweep is that it is
     * something the reader can count on seeing.
     */
    float phase = fract(uTime / SWEEP_S) * SWEEP_SPAN - SWEEP_LEAD - uIndex * SWEEP_STAGGER;
    float sweep = exp(-(phase * phase) / SWEEP_WIDTH) * (0.06 + 0.14 * uDawn);
    color += vec3(1.0, 0.925, 0.824) * sweep * (0.55 + 0.45 * ndl);

    // A faint fresnel along the edge, so the plate has a thickness the eye can
    // find against a dark sky.
    float rim = pow(1.0 - max(dot(normal, vView), 0.0), 3.0);
    color += uLine * rim * 0.22;

    // The glass is see-through; the wire ruled on it is not.
    float alpha = clamp(mix(0.5, 0.94, line) + rim * 0.16, 0.0, 1.0);

    /*
     * uOpacity is a **ceiling**, not a multiplier, and matches the one
     * MessageCube puts on every other material in the satellite.
     *
     * Multiplying kept this array's grid at 0.94 of whatever was left while
     * the cube's glass had only 0.34 of it, so on the way to the trail the
     * wings stayed visible long after the cube they are bolted to had gone.
     * A ceiling takes the brightest parts down first and lets everything
     * leave together.
     */
    gl_FragColor = vec4(color, min(alpha, uOpacity));

    #include <colorspace_fragment>
  }
`;
