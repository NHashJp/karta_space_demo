/**
 * The contrail's ribbon (spec v0.2 §9.1).
 *
 * The colour along the trail has to be the same function in two places: this
 * ribbon draws it, and the CPU tints each memory's glint and its panel border
 * from the trail's colour at that point. A panel outlined in a colour the
 * trail beside it is not would be a strange, hard-to-name wrongness.
 *
 * The obvious approach — write the noise twice, once in TypeScript and once in
 * GLSL — cannot actually deliver that. The two would have to agree bit for bit
 * across different float precisions, and every future edit would have to be
 * made in both places correctly.
 *
 * So there is only one implementation. `lib/trailColour.ts` is sampled at
 * `RAMP_SIZE` points along `u` once per frame on the CPU, handed over as a
 * uniform, and interpolated here. Thirty-two samples a frame is nothing, and
 * the ribbon is now *by construction* the same colours as everything tinted
 * from it.
 */

export const RAMP_SIZE = 32;

export const ribbonVertexShader = /* glsl */ `
  attribute float aU;
  attribute float aSide;

  varying float vU;
  varying float vSide;
  varying float vRange;

  void main() {
    vU = aU;
    vSide = aSide;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    // Distance from the lens, not depth along it: the ribbon passes *beside*
    // the camera on the way down the trail, and it is that passing-by that
    // has to fade rather than only what is dead ahead.
    vRange = length(view.xyz);
    gl_Position = projectionMatrix * view;
  }
`;

export const ribbonFragmentShader = /* glsl */ `
  uniform vec3 uRamp[${RAMP_SIZE}];
  uniform float uIntensity;
  uniform float uNearFade;
  uniform float uFlow;

  varying float vU;
  varying float vSide;
  varying float vRange;

  vec3 sampleRamp(float u) {
    float x = clamp(u, 0.0, 1.0) * float(${RAMP_SIZE} - 1);
    float i = floor(x);
    int a = int(i);
    int b = min(a + 1, ${RAMP_SIZE} - 1);
    return mix(uRamp[a], uRamp[b], x - i);
  }

  void main() {
    vec3 colour = sampleRamp(vU);

    /*
     * Fading along the length, at *both* ends (rev 6).
     *
     * The far end always tapered to nothing. The near one did not: it sat at
     * full brightness and simply stopped where the geometry started, so the
     * widest, brightest part of the ribbon ended in a flat cap drawn straight
     * across its width — a cut, not an ending.
     *
     * Now it comes in from nothing over the first eighth of the length. The
     * brightest point moves to about u = 0.12 and the trail arrives at a
     * point, the way the far end already leaves at one. 1.119 is what puts
     * that new peak back at the 0.95 the old near end had, so the trail is
     * no dimmer than it was — only no longer cut off.
     */
    /*
     * And it lasts **to the end of the memories**. The far end used to fade as
     * (1 − u)^1.3, which is already down to a fifth by u = 0.7 — about the
     * fifth memory of a full trail — so the reader travelling it found the
     * contrail gone around them for the whole second half of the journey.
     * Now it only eases down to a little over half, and leaves for good over
     * the last few per cent, past the oldest memory (at u = 0.92).
     */
    float head = smoothstep(0.0, 0.12, vU);
    float u = clamp(vU, 0.0, 1.0);
    float tail = (1.0 - 0.45 * u) * (1.0 - smoothstep(0.94, 1.0, u));
    float lengthwise = 0.98 * head * tail;

    /*
     * The cross-section (rev 6).
     *
     * A gaussian rather than a smoothstep. Both reach zero at the ribbon's
     * edge, but they spend their width very differently: smoothstep holds
     * most of its value out to about two-thirds and then falls off quickly,
     * which puts a visible boundary there — the trail looked like a bright
     * band with a rim rather than like gas thinning out. A gaussian gives
     * most of the width to the falloff, so the edge is a long feather with
     * nowhere for the eye to land.
     *
     * The subtraction is what actually matters: exp(-K) at the boundary is
     * small but not nothing, and a small non-zero alpha at the last vertex is
     * exactly a hard edge. Taking it off lands the curve on zero, and
     * dividing by the same thing puts the centre back at 1.
     */
    const float K = 5.0;
    float d = clamp(abs(vSide), 0.0, 1.0);
    // 0.948 is the ratio of the two profiles' areas: a gaussian carries about
    // 5% more light across the width than the old curve did, and this change
    // is meant to be about the edge rather than about the exposure.
    float across = 0.948 * (exp(-K * d * d) - exp(-K)) / (1.0 - exp(-K));

    /*
     * And fading as it comes close to the lens.
     *
     * Without this the trail scene is unusable: the camera travels the length
     * of the ribbon, so some part of it is always near, and an additively
     * blended strip a fraction of a unit away stacks into a white wedge across
     * the whole frame. Every segment is individually correct; the sum is not.
     */
    float near = smoothstep(0.0, uNearFade, vRange);

    /*
     * Something running down it (rev 6).
     *
     * The colours already drift, but drift has no direction — the trail read
     * as a painted stripe rather than as a wake with a spacecraft at the end
     * of it. In the orbit view it is one of the four things the composition
     * is made of and the only one that was completely still.
     *
     * Two layers, because one was not enough to see. A broad swell gives the
     * whole ribbon a slow breath, and a narrow crest rides on top of it — a
     * bead of light that visibly travels the length of the trail, roughly
     * every seven seconds. The crest is what the eye catches; the swell is
     * what stops it looking like a single object sliding along a wire.
     *
     * Both are a *brightening*, never a mark, so there is no hard edge to
     * follow: the trail reads as running rather than as animated. Damped to
     * nothing at the near end so neither can flicker inside the fade.
     */
    float phase = vU * 2.0 - uFlow;
    float swell = 0.5 + 0.5 * sin(phase * 6.2831853);
    // A narrow bump at each crest: 1 where the swell peaks, ~0 elsewhere.
    float crest = pow(swell, 6.0);
    float moving = smoothstep(0.06, 0.45, vU);
    float pulse = 1.0 + (0.24 * (swell * 2.0 - 1.0) + 0.60 * crest) * moving;

    /*
     * Squared once, not twice. The old profile needed the second squaring to
     * look soft at all; this one is already soft, and squaring it again would
     * spend the feather getting the edge to zero it is already at and pinch
     * the core instead.
     */
    float alpha = lengthwise * across * near * uIntensity * pulse;
    if (alpha < 0.002) discard;

    // Premultiplied, so the additive blend does not brighten the thin edges
    // of the ribbon more than its middle.
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`;
