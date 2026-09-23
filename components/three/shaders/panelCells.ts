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
  uniform vec3 uSun;
  uniform vec3 uSunColor;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  const vec2 CELLS = vec2(6.0, 16.0);

  void main() {
    // The gap between cells, as a fraction of one cell.
    vec2 cell = fract(vUv * CELLS);
    vec2 edge = min(cell, 1.0 - cell);
    float gap = 1.0 - smoothstep(0.0, 0.045, min(edge.x, edge.y));

    // A bus bar down the middle of each panel: one asymmetry, which is most of
    // what stops a regular grid reading as wallpaper.
    float bar = 1.0 - smoothstep(0.0, 0.012, abs(vUv.x - 0.5));

    vec3 color = mix(uBase, uCell, 0.22);
    color = mix(color, uCell * 1.5, gap * 0.5);
    color = mix(color, vec3(0.62, 0.70, 0.79), bar * 0.6);

    vec3 normal = normalize(vNormal);
    float ndl = max(dot(normal, uSun), 0.0);
    color *= 0.35 + 0.75 * ndl;

    // Glass over silicon: almost nothing until the angle lines up, then a
    // flare. The sun moves on its own, so this sweeps the panels in turn.
    vec3 halfway = normalize(uSun + vView);
    float glint = pow(max(dot(normal, halfway), 0.0), 68.0);
    color += uSunColor * glint * 0.85;

    // A faint fresnel along the edge, so the plate has a thickness the eye can
    // find against a dark sky.
    float rim = pow(1.0 - max(dot(normal, vView), 0.0), 3.0);
    color += vec3(0.62, 0.70, 0.79) * rim * 0.18;

    gl_FragColor = vec4(color, uOpacity);

    #include <colorspace_fragment>
  }
`;
