/**
 * Nebula backdrop: domain-warped fractal noise on the inside of a large sphere.
 *
 * Two things keep it from reading as a flat scroll. The cloud is warped by a
 * second noise field, which gives it wisps and hollows instead of even fog;
 * and it drifts along a flow vector built from sines whose periods share no
 * common multiple, so the direction wanders and the motion never repeats.
 */

export const nebulaVertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const nebulaFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uVoid;
  uniform vec3 uDeep;
  uniform vec3 uNebula;
  uniform vec3 uIon;
  uniform vec3 uEmber;
  uniform float uIntensity;

  varying vec3 vDirection;

  // Phones trade one octave of dust for frame rate (spec §27).
  #ifdef LOW_DETAIL
    #define NEBULA_OCTAVES 3
  #else
    #define NEBULA_OCTAVES 4
  #endif

  // Sine-free hash: the trigonometric one costs far too much at four octaves.
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x),
        u.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x),
        u.y
      ),
      u.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < NEBULA_OCTAVES; i++) {
      value += amplitude * valueNoise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  float fbmLow(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 2; i++) {
      value += amplitude * valueNoise(p);
      p *= 2.11;
      amplitude *= 0.5;
    }
    return value;
  }

  /**
   * Drift direction. Each axis sums two sines with deliberately unrelated
   * periods (roughly 59s/23s, 43s/85s, 72s/27s), so the field wanders instead
   * of sliding one way, and the combined path does not close.
   */
  vec3 flowField(float t) {
    return vec3(
      sin(t * 0.0170) * 1.00 + sin(t * 0.0431 + 1.73) * 0.42,
      cos(t * 0.0234) * 0.86 + sin(t * 0.0117 + 2.91) * 0.51,
      sin(t * 0.0139 + 0.62) * 0.94 + cos(t * 0.0367 + 4.18) * 0.38
    );
  }

  void main() {
    vec3 dir = normalize(vDirection);
    vec3 flow = flowField(uTime) * 0.62;
    vec3 p = dir * 2.05 + flow;

    // Warp the sampling position by another noise field: this is what turns
    // even fog into wisps, voids and filaments.
    vec3 warp = vec3(
      fbmLow(p + vec3(1.7, 9.2, 4.4)),
      fbmLow(p + vec3(8.3, 2.8, 6.1)),
      fbmLow(p + vec3(3.9, 5.5, 1.2))
    ) - 0.5;

    float base = fbm(p + warp * 1.75);
    float detail = fbmLow(p * 2.9 + warp * 2.4 + flow * 0.3);
    float clouds = smoothstep(0.38, 0.97, base * 0.78 + detail * 0.32);

    // A second, much slower field decides where the dust glows warm rather
    // than cold, so the palette keeps shifting without ever announcing itself.
    float temperature = fbmLow(dir * 1.3 + flow * 0.45);
    float breath = 0.86 + 0.14 * sin(uTime * 0.041 + base * 3.1);

    vec3 color = mix(uVoid, uDeep, smoothstep(0.12, 0.88, base));
    color = mix(color, uNebula, clouds * 0.88);
    color = mix(color, uIon, pow(clouds, 3.0) * 0.48 * smoothstep(0.62, 0.30, temperature));
    color = mix(color, uEmber, pow(clouds, 4.0) * 0.30 * smoothstep(0.48, 0.78, temperature));

    // Deepen the empty regions so the bright filaments feel further away.
    float depth = pow(clouds, 1.35);
    color *= (0.07 + depth * 1.02) * uIntensity * breath;

    gl_FragColor = vec4(color, 1.0);

    #include <colorspace_fragment>
  }
`;
