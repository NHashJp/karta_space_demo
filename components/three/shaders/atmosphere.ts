/**
 * The planet's air, seen edge-on (spec v0.2 §23.4, as revised by rev 7.1 §6).
 *
 * A **ring facing the camera**, centred on the planet and sitting across its
 * limb, rather than the fresnel shell revision 6 used. The shell could only
 * ever give one soft band of one colour, and §6 asks for something much more
 * specific and much more dramatic: a line of lit air that runs cream-white
 * where the sun is coming up, through gold, into cyan, and out to the deep
 * blue of atmosphere seen at a shallow angle — drawn three times over, as a
 * wide haze, a tight glow and a hairline.
 *
 * Three things follow from drawing it as a ring:
 *
 * - the gradient is **conic about the sun**, measured in the disc's own
 *   plane, which is exactly how §6 writes it. On a shell it had to be
 *   recovered from a surface normal, near the silhouette, where that normal
 *   is least reliable;
 * - the three passes are three Gaussians on one radius, so the hairline can
 *   be a hairline. A shell 14% thicker than the planet cannot draw a line
 *   1.2 px wide at any viewport;
 * - the **aurora** goes here too, as strands standing off the limb on the
 *   night side — which is where it is, and where a shell could not put it.
 *
 * It is drawn at the planet's own depth with depth testing on, so the
 * satellite still passes in front of it.
 */

export const atmosphereVertexShader = /* glsl */ `
  varying vec2 vLocal;

  void main() {
    // The ring is built in the XY plane in planet radii, so the local
    // position is already the disc coordinate every term below wants.
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragmentShader = /* glsl */ `
  /** The dawn, 0.2..1 (rev 7.1 §3). */
  uniform float uDawn;
  /** Seconds. Frozen under reduced motion, which stills the aurora. */
  uniform float uTime;
  /** The sun's bearing from the planet's centre, in the disc's plane. */
  uniform float uSunAngle;
  /**
   * The arc of limb the frame shows, as bearings: where it crosses the bottom
   * edge, and where it crosses the right edge. The aurora runs from the first
   * of those 62% of the way towards the second (§6).
   */
  uniform vec2 uVisibleArc;
  /** One screen pixel, in planet radii. Keeps the hairline a hairline. */
  uniform float uPixel;

  varying vec2 vLocal;

  float hash1(float x) {
    return fract(sin(x * 127.1) * 43758.5453);
  }

  /** The shortest signed angle from a to b. */
  float delta(float a, float b) {
    float d = a - b;
    return abs(atan(sin(d), cos(d)));
  }

  void main() {
    float r = length(vLocal);
    float angle = atan(vLocal.y, vLocal.x);
    float fromSun = delta(angle, uSunAngle);

    /*
     * §6's stops, in turns from the sunrise: cream at the sun, gold just off
     * it, cyan at 1.3 s and blue at 3.2 s, where s = 0.05 + 0.06p. The band
     * widens as the day nears, because there is more lit air to see.
     */
    float s = (0.05 + 0.06 * uDawn) * 6.2831853;
    vec3 cream = vec3(1.000, 0.941, 0.843);  // #fff0d7
    vec3 gold  = vec3(1.000, 0.784, 0.549);  // #ffc88c
    vec3 cyan  = vec3(0.431, 0.824, 1.000);  // #6ed2ff
    vec3 blue  = vec3(0.278, 0.482, 0.918);  // #478bea, a touch above #3264dc
                                             // so the far limb still reads

    vec3 conic = cream;
    conic = mix(conic, gold, smoothstep(0.35 * s, 1.0 * s, fromSun));
    conic = mix(conic, cyan, smoothstep(1.0 * s, 1.3 * s, fromSun));
    conic = mix(conic, blue, smoothstep(1.3 * s, 3.2 * s, fromSun));

    // How much lit air there is at this bearing: full at the sunrise, gone
    // round the back, so the limb is a sunrise rather than a drawn circle.
    /*
     * How much lit air there is at this bearing: full at the sunrise, gone
     * round the back, so the limb is a sunrise rather than a drawn circle.
     *
     * The second term is the one that keeps a thin blue line running the
     * whole length of the arc the frame shows. Without it the limb faded out
     * a third of the way along on a phone, and the planet read as much
     * smaller than it is — the eye takes the end of the bright line for the
     * edge of the world.
     */
    float reach =
      (1.0 - smoothstep(1.3 * s, 3.2 * s, fromSun)) * 0.50 +
      (1.0 - smoothstep(3.2 * s, 3.2 * s + 2.2, fromSun)) * 0.50;
    reach *= 0.34 + 0.66 * uDawn;

    /*
     * The three passes. §6: a haze 0.03R wide blurred by 10 px, a glow 0.008R
     * blurred by 2 px, and a 1.2 px line. Here they are three Gaussians on the
     * distance from the limb, the last of them a pixel and a bit wide at
     * whatever size the planet happens to be drawn.
     */
    float d = r - 1.0;
    float haze = exp(-pow(d / 0.020, 2.0)) * 0.16;
    float glow = exp(-pow(d / 0.0060, 2.0)) * 0.45;
    float line = exp(-pow(d / max(uPixel * 1.1, 0.0006), 2.0)) * 0.95;

    /*
     * The haze leans outward, hard: air glows into space, not into the
     * ground. Letting it spill inward at any weight puts a twenty-pixel
     * white band over the night side, and the night side going grey is the
     * one thing that stops this reading as a dark world with a brilliant
     * edge. The weight on the line is what carries the limb; the haze is
     * only there so the line is not a wire.
     */
    haze *= d < 0.0 ? 0.22 : 1.0;

    /*
     * Clamped, and that matters more than it looks. Three overlapping passes
     * sum to well over one at the sunrise, and an unclamped additive write
     * clips each channel separately — which turns the gold into white and
     * throws away the one gradient §6 is actually about. A limb that is
     * white all the way round is a drawn circle; a limb that runs cream to
     * gold to cyan to blue is a sunrise seen from orbit.
     */
    float alpha = min(1.0, (haze + glow + line) * reach);
    vec3 color = conic;

    /*
     * The aurora (§6). Radial strands standing off the limb on the dark
     * side — from the far end of the visible arc back towards the sunrise,
     * stopping 62% of the way — green through blue to violet, never above
     * 10% alpha, and fainter as the dawn rises because by then there is
     * daylight over it.
     */
    float auroraEnd = mix(uVisibleArc.x, uVisibleArc.y, 0.62);
    float along = clamp((angle - uVisibleArc.x) / (auroraEnd - uVisibleArc.x), 0.0, 1.0);
    float arc = smoothstep(0.0, 0.15, along) * smoothstep(1.0, 0.7, along);
    float wobble =
      0.5 + 0.5 * sin(uTime * 0.35 + hash1(floor(angle * 190.0)) * 6.2831853)
        * sin(along * 17.0 + uTime * 0.2);
    float strands = pow(0.5 + 0.5 * sin(angle * 380.0), 2.0);
    float height = 0.03 + 0.035 * wobble;
    float up = (1.0 - smoothstep(0.0, height, d)) * step(0.0, d);
    float aurora = arc * strands * wobble * up * 0.10 * (1.0 - 0.5 * uDawn);

    vec3 auroraColor = mix(
      mix(vec3(0.361, 1.0, 0.710), vec3(0.471, 0.784, 1.0), smoothstep(0.0, 0.5, d / height)),
      vec3(0.667, 0.471, 1.0),
      smoothstep(0.5, 1.0, d / height)
    );

    vec3 lit = color * alpha + auroraColor * aurora;
    float a = min(alpha + aurora, 1.0);
    if (a < 0.003) discard;

    gl_FragColor = vec4(lit, a);

    #include <colorspace_fragment>
  }
`;
