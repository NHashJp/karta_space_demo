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

    // Fading along the length, and across the width. A hard-edged strip reads
    // as a ribbon of plastic; a soft one as something burning off.
    float lengthwise = 0.95 * pow(1.0 - clamp(vU, 0.0, 1.0), 1.3);
    float across = 1.0 - smoothstep(0.0, 1.0, abs(vSide));

    /*
     * And fading as it comes close to the lens.
     *
     * Without this the trail scene is unusable: the camera travels the length
     * of the ribbon, so some part of it is always near, and an additively
     * blended strip a fraction of a unit away stacks into a white wedge across
     * the whole frame. Every segment is individually correct; the sum is not.
     */
    float near = smoothstep(0.0, uNearFade, vRange);

    float alpha = lengthwise * across * across * near * uIntensity;
    if (alpha < 0.002) discard;

    // Premultiplied, so the additive blend does not brighten the thin edges
    // of the ribbon more than its middle.
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`;
