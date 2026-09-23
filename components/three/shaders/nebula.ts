/**
 * Nebula backdrop: domain-warped fractal noise on the inside of a large sphere.
 *
 * Two things keep it from reading as a flat scroll. The cloud is warped by a
 * second noise field, which gives it wisps and hollows instead of even fog;
 * and it drifts along a flow vector built from sines whose periods share no
 * common multiple, so the direction wanders and the motion never repeats.
 *
 * v0.2 adds the depth (spec v0.2 §23.2). Three things, in order of how much
 * they matter:
 *
 * 1. **Dark dust lanes.** Ridged noise that *absorbs* up to 70% of the light
 *    where the gas is densest. Most of the sense of depth comes from this —
 *    without something in front, bright gas is just a bright surface.
 * 2. **Filaments**, on their own flow vector at 0.7x the cloud's speed. Two
 *    layers moving at different rates is parallax, and parallax is distance.
 * 3. **Bright knots** in the densest gas, each with a wide faint halo, so the
 *    eye has somewhere to land.
 *
 * Plus a composition bias: the densest gas lies along a diagonal band, which
 * keeps the lower third — where the planet sits and the UI lives — calm.
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
  uniform vec3 uFilamentCool;
  uniform vec3 uFilamentWarm;
  uniform float uIntensity;

  varying vec3 vDirection;

  // Phones trade an octave of dust, and an octave of filament, for frame rate
  // (spec §27, v0.2 §23.5).
  #ifdef LOW_DETAIL
    #define NEBULA_OCTAVES 3
    #define RIDGE_OCTAVES 2
  #else
    #define NEBULA_OCTAVES 4
    #define RIDGE_OCTAVES 3
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

  /**
   * Ridged noise: |noise - 0.5| inverted, which turns the smooth blobs of
   * value noise into creases. Both the dust lanes and the filaments are this
   * shape — one subtracts light, the other adds it.
   */
  float ridged(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < RIDGE_OCTAVES; i++) {
      float n = 1.0 - abs(valueNoise(p) * 2.0 - 1.0);
      value += amplitude * n * n;
      p *= 2.17;
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

    // Warp the warp. One level gives wisps; two gives soft billows that still
    // hold a fine edge where they fold over.
    #ifndef LOW_DETAIL
      vec3 q = p * 1.7 + warp * 1.2;
      vec3 warp2 = vec3(
        fbmLow(q + vec3(4.1, 0.9, 7.3)),
        fbmLow(q + vec3(2.2, 6.4, 3.8)),
        fbmLow(q + vec3(9.6, 1.5, 5.0))
      ) - 0.5;
      warp += warp2 * 0.55;
    #endif

    float base = fbm(p + warp * 1.75);
    float detail = fbmLow(p * 2.9 + warp * 2.4 + flow * 0.3);
    float clouds = smoothstep(0.38, 0.97, base * 0.78 + detail * 0.32);

    // A second, much slower field decides where the dust glows warm rather
    // than cold, so the palette keeps shifting without ever announcing itself.
    float temperature = fbmLow(dir * 1.3 + flow * 0.45);
    float breath = 0.86 + 0.14 * sin(uTime * 0.041 + base * 3.1);

    // The densest gas lies along a diagonal band, so the lower third of the
    // frame — where the planet rises and every control sits — stays calm.
    float band = 1.0 - smoothstep(0.0, 0.85, abs(dir.y * 0.78 - dir.x * 0.34 - 0.12));
    clouds *= 0.55 + 0.45 * band;

    vec3 color = mix(uVoid, uDeep, smoothstep(0.12, 0.88, base));
    color = mix(color, uNebula, clouds * 0.88);
    color = mix(color, uIon, pow(clouds, 3.0) * 0.48 * smoothstep(0.62, 0.30, temperature));
    color = mix(color, uEmber, pow(clouds, 4.0) * 0.30 * smoothstep(0.48, 0.78, temperature));

    // Deepen the empty regions so the bright filaments feel further away.
    float depth = pow(clouds, 1.35);
    color *= (0.07 + depth * 1.02) * uIntensity * breath;

    // ---- filaments: their own field, at 0.7x the cloud's speed ------------
    // The different rate is the whole point. Two layers drifting together are
    // one layer; drifting at different rates, they have distance between them.
    vec3 filamentFlow = flowField(uTime * 0.7 + 137.0) * 0.44;
    float filament = ridged(dir * 3.4 + filamentFlow + warp * 0.9);
    filament = pow(smoothstep(0.52, 0.96, filament), 1.8);
    vec3 filamentColor = mix(uFilamentCool, uFilamentWarm,
      smoothstep(0.35, 0.72, temperature));
    color += filamentColor * filament * clouds * 0.46 * uIntensity;

    // ---- dark dust lanes: the depth, mostly -------------------------------
    // Absorption, not shading. Gas in front of gas takes light away, which is
    // what stops the bright regions reading as a flat lit surface.
    float lanes = ridged(dir * 2.1 - flow * 0.35 + 11.0);
    float absorption = smoothstep(0.58, 0.95, lanes) * clouds * 0.7;
    color *= 1.0 - absorption;

    // ---- bright knots deep inside the densest gas -------------------------
    float knotField = valueNoise(dir * 5.6 + 41.0);
    float knots = pow(smoothstep(0.86, 1.0, knotField) * clouds, 2.0);
    float halo = pow(smoothstep(0.62, 1.0, knotField) * clouds, 1.4) * 0.22;
    color += mix(uIon, uEmber, step(0.5, temperature)) * (knots * 1.6 + halo) * uIntensity;

    gl_FragColor = vec4(color, 1.0);

    #include <colorspace_fragment>
  }
`;
