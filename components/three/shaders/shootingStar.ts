/**
 * One shooting star: a hot head with a tail tapering away behind it.
 *
 * Drawn on a single quad, which is enough because of where the quad is put.
 * The star is positioned in *camera space* and travels in the camera's own
 * x-y plane, so a plane whose normal is the camera's forward axis is always
 * facing the lens — no billboarding maths, no per-frame lookAt. The component
 * only has to roll it about that axis to point it along the flight.
 *
 * Three things make it read as a meteor rather than a drawn line:
 *
 * 1. **The tail narrows.** The gaussian across the streak is scaled by how
 *    far along it you are, so the trail comes to nothing instead of ending
 *    in a blunt edge.
 * 2. **The head is hot and small.** A high power of the lengthwise
 *    coordinate, so the white core occupies the last few per cent and the
 *    rest stays the cooler body colour.
 * 3. **It is brightest just behind the head, not at it.** The alpha sums a
 *    broad term and a sharp one, which is what gives the little flare that
 *    the eye reads as speed.
 */

export const shootingStarVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const shootingStarFragmentShader = /* glsl */ `
  uniform vec3 uHead;
  uniform vec3 uTail;
  uniform float uOpacity;
  /** 1 for an ordinary star; more for a fireball's brighter head. */
  uniform float uGlow;

  varying vec2 vUv;

  void main() {
    // 0 at the tail, 1 at the head. The quad is built with +Y leading.
    float t = vUv.y;

    // How wide the streak is here. Never quite zero, or the thinnest part
    // of the tail vanishes into a dashed line on a low pixel ratio.
    float width = mix(0.12, 1.0, pow(t, 0.7));
    float across = (vUv.x - 0.5) * 2.0 / width;
    float core = exp(-5.5 * across * across);

    // The body of the trail, and the flare at the head.
    float body = pow(t, 2.2);
    float head = pow(t, 14.0);

    // A fireball's head carries a soft halo wider than its core.
    float halo = exp(-1.4 * across * across) * pow(t, 9.0) * 0.55 * (uGlow - 1.0);

    vec3 color = mix(uTail, uHead, head);
    float alpha = uOpacity * (core * (body * 0.8 + head * 1.7 * uGlow) + halo);

    gl_FragColor = vec4(color * (0.75 + 0.9 * head), alpha);

    #include <colorspace_fragment>
  }
`;
