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
 * nearly black until the sun's angle lines up, and then it flares. Because the
 * sun here moves (§23.3), that flare sweeps across the four panels in turn on
 * its own, every couple of minutes, and nobody has to animate it.
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

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  const vec2 CELLS = vec2(6.0, 16.0);

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
    // flare. The sun moves on its own, so this sweeps the panels in turn.
    vec3 halfway = normalize(uSun + vView);
    float glint = pow(max(dot(normal, halfway), 0.0), 68.0);
    color += uSunColor * glint * 0.55;

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
