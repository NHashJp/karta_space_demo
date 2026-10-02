/** Point stars with per-star colour, size and twinkle phase. */

export const starsVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  /*
   * How much of the deep field shows through, from the card's age
   * (lib/skyAge.ts). An older card has less gas in front of its stars, so more
   * of them are there to be seen. Applied to size as well as to brightness,
   * because a star that only gets brighter reads as a turned-up exposure,
   * while one that also opens up reads as a clearer sky.
   */
  uniform float uBrightness;

  varying vec3 vColor;
  varying float vTwinkle;
  varying float vBrightness;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    float twinkle = 0.55 + 0.45 * sin(uTime * aSpeed + aPhase);
    vTwinkle = twinkle;
    vColor = aColor;
    vBrightness = uBrightness;

    // Size attenuation, nudged by the twinkle so stars appear to breathe.
    gl_PointSize = aSize * uBrightness * uPixelRatio * (150.0 / -viewPosition.z)
      * (0.8 + 0.2 * twinkle);
  }
`;

export const starsFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vBrightness;

  void main() {
    float distance = length(gl_PointCoord - 0.5);
    if (distance > 0.5) discard;

    // Tight core with a soft halo, so a star reads as shining rather than as a dot.
    float core = smoothstep(0.5, 0.0, distance);
    float glow = pow(core, 3.5);
    // Clamped: the faintest stars may brighten, but none of them blow out.
    float alpha = min(1.0, glow * vTwinkle * vBrightness);

    gl_FragColor = vec4(vColor * (0.55 + 0.9 * glow), alpha);

    #include <colorspace_fragment>
  }
`;
