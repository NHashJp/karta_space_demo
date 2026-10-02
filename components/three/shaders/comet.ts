/**
 * The comet's coma and tails (spec v0.2 §11.2, rev 6 §5).
 *
 * The first version drew the coma as an additively blended sphere and each
 * tail as a flat strip. Both are *shapes*, and a comet is not a shape — it is
 * a density. A sphere of constant colour has a silhouette, and the eye finds
 * that silhouette immediately: it reads as a bead of glass, not as gas coming
 * off a rock. A strip has two hard edges running its whole length, which is
 * the one thing a tail never has.
 *
 * So both are falloffs now. The coma is a core and a much wider skirt, which
 * is roughly how a real coma's brightness falls; the tails fade across their
 * width as well as along their length, and turn to face the camera so they can
 * never be caught edge-on and vanish.
 */

/**
 * Both billboard around their own origin: the quad's local xy is treated as an
 * offset in *view* space, so it always faces the lens however the scene turns.
 */
export const comaVertexShader = /* glsl */ `
  uniform float uSize;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    centre.xy += position.xy * uSize;
    gl_Position = projectionMatrix * centre;
  }
`;

export const comaFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCore;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    /*
     * Two falloffs, not one. A single gaussian gives a soft ball; the long
     * shallow skirt underneath it is what makes the coma look like something
     * streaming off the nucleus rather than painted around it.
     */
    float core = exp(-r * r * 11.0);
    float skirt = exp(-r * 2.6);

    // Faded to nothing at the quad's edge, so the billboard has no border of
    // its own at any brightness.
    float edge = 1.0 - smoothstep(0.72, 1.0, r);
    float alpha = (core * 0.85 + skirt * 0.38) * edge * uOpacity;
    if (alpha < 0.003) discard;

    // Whiter at the centre, the tail's colour further out: hot in the middle
    // is what every bright thing in a dark sky looks like.
    vec3 colour = mix(uColor, uCore, core);
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`;

export const tailVertexShader = /* glsl */ `
  uniform vec3 uDirection;

  attribute float aSide;
  attribute float aT;
  attribute float aHalf;

  varying float vT;
  varying float vSide;

  void main() {
    vT = aT;
    vSide = aSide;

    // Widened in view space, across both the tail's direction and the line of
    // sight, so the strip turns with the camera and is never edge-on.
    vec4 centre = modelViewMatrix * vec4(position, 1.0);
    vec3 along = normalize((modelViewMatrix * vec4(uDirection, 0.0)).xyz);
    vec3 across = cross(along, vec3(0.0, 0.0, 1.0));
    float len = length(across);
    across = len > 0.0001 ? across / len : vec3(1.0, 0.0, 0.0);

    centre.xyz += across * aHalf * aSide;
    gl_Position = projectionMatrix * centre;
  }
`;

export const tailFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vT;
  varying float vSide;

  void main() {
    // Along its length: thinning out, never ending at an edge.
    float lengthwise = pow(1.0 - clamp(vT, 0.0, 1.0), 1.6);
    // And across it. This is the half the first version was missing, and the
    // reason the tails read as two ribbons of plastic.
    float across = 1.0 - smoothstep(0.0, 1.0, abs(vSide));

    float alpha = lengthwise * across * across * uOpacity;
    if (alpha < 0.003) discard;

    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;
