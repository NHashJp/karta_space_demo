/** Point stars with per-star colour, size and twinkle phase. */

export const starsVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    float twinkle = 0.55 + 0.45 * sin(uTime * aSpeed + aPhase);
    vTwinkle = twinkle;
    vColor = aColor;

    // Size attenuation, nudged by the twinkle so stars appear to breathe.
    gl_PointSize = aSize * uPixelRatio * (150.0 / -viewPosition.z) * (0.8 + 0.2 * twinkle);
  }
`;

export const starsFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    float distance = length(gl_PointCoord - 0.5);
    if (distance > 0.5) discard;

    // Tight core with a soft halo, so a star reads as shining rather than as a dot.
    float core = smoothstep(0.5, 0.0, distance);
    float glow = pow(core, 3.5);
    float alpha = glow * vTwinkle;

    gl_FragColor = vec4(vColor * (0.55 + 0.9 * glow), alpha);

    #include <colorspace_fragment>
  }
`;
