/**
 * The planet's air (spec v0.2 §23.4).
 *
 * Two parts, drawn on a slightly larger sphere with back faces:
 *
 * - a **fresnel rim**, bright cyan where the sun is up and violet at the
 *   terminator, which is the single thing that makes a shaded sphere read as a
 *   planet rather than a ball;
 * - an **outer halo** of two exponentials. The important property is that it
 *   reaches zero *before* the geometry does — an earlier version faded
 *   linearly and left a visible circular edge in the sky where the mesh
 *   stopped, which is worse than having no halo at all.
 */

export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const atmosphereFragmentShader = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uLit;
  uniform vec3 uShadow;
  uniform float uScale;

  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 normal = normalize(vNormal);
    float fresnel = pow(1.0 - max(dot(normal, vView), 0.0), 2.6);

    // How much sun this bit of air is in. The rim brightens where the sun is
    // and cools through violet as it crosses the terminator.
    float ndl = dot(normal, uSun);
    float lit = smoothstep(-0.35, 0.45, ndl);
    vec3 color = mix(uShadow, uLit, lit);

    // The halo: two exponentials over the shell's own thickness, so it is
    // already zero well before the geometry's edge. uScale is the shell's
    // radius over the planet's, so at 1.14 the halo has 14% to fade in and
    // uses all of it.
    float depth = clamp((1.0 - max(dot(normal, vView), 0.0)), 0.0, 1.0);
    float halo = exp(-depth * 3.2) * 0.55 + exp(-depth * 11.0) * 0.45;
    float band = 1.0 - smoothstep(0.0, uScale - 1.0, (uScale - 1.0) * depth);

    /*
     * A tight bright line right on the limb, over the softer halo (mockups
     * M5, M14b). The rim is the only hard edge in the orbit view and it is
     * what tells the eye the bottom-right corner is a world rather than a
     * gradient; at the old weight it read as a smudge at phone size.
     */
    float edge = pow(1.0 - max(dot(normal, vView), 0.0), 9.0);

    float alpha = (fresnel * 0.95 + halo * 0.4 + edge * 0.55) * band
      * (0.25 + 0.75 * lit);
    alpha = min(alpha, 1.0);
    if (alpha < 0.002) discard;

    gl_FragColor = vec4(color * alpha, alpha);

    #include <colorspace_fragment>
  }
`;
