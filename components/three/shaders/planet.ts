/**
 * 「あなたの星」 — the receiver's planet (spec v0.2 §23.4).
 *
 * Entirely procedural: no Earth textures, no environment maps, nothing to
 * download. That is not only a budget decision. A recognisable Earth would
 * make this *the* planet rather than *their* planet, and the whole point of
 * the orbit view is that the letter is now circling somewhere that belongs to
 * the person reading it.
 *
 * The parts that make a sphere read as a lit world, in the order they matter:
 *
 * 1. **The terminator.** A hard N·L edge reads as a billiard ball. Wrapped
 *    Lambert (wrap 0.2) softens it into the scattered band a real atmosphere
 *    makes, and it is what sells the whole thing.
 * 2. **Limb darkening.** Real spheres are darker at the edge than the middle,
 *    because you are looking through more of them.
 * 3. **Clouds**, stretched along longitude and turning faster than the
 *    surface, so the two layers separate.
 * 4. **Night-side lights.** Sparse warm specks on land where the sun has set.
 *    Small, and the difference between a planet and an inhabited one.
 */

export const planetVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const planetFragmentShader = /* glsl */ `
  uniform float uSurfaceAngle;
  uniform float uCloudAngle;
  uniform vec3 uSun;
  uniform vec3 uSunColor;
  uniform float uNight;

  varying vec3 vNormal;
  varying vec3 vPosition;

  #ifdef LOW_DETAIL
    #define SURFACE_OCTAVES 3
  #else
    #define SURFACE_OCTAVES 5
  #endif

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.13, 0.37));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), u.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x), u.y),
      u.z
    );
  }

  float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amplitude * valueNoise(p);
      p *= 2.07;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 spin(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  }

  void main() {
    vec3 unit = normalize(vPosition);
    vec3 normal = normalize(vNormal);

    // ---- surface ---------------------------------------------------------
    vec3 surfacePoint = spin(unit, uSurfaceAngle) * 2.3;
    float land = fbm(surfacePoint, SURFACE_OCTAVES);
    // A second, larger field decides where continents are at all, so the
    // coastlines have shape instead of being noise thresholded everywhere.
    land = land * 0.72 + fbm(surfacePoint * 0.45 + 13.0, 3) * 0.55;

    vec3 ocean = vec3(0.071, 0.149, 0.290);   // #12264a
    vec3 shelf = vec3(0.114, 0.216, 0.388);   // #1d3763
    vec3 coast = vec3(0.165, 0.267, 0.408);   // #2a4468
    vec3 highland = vec3(0.208, 0.224, 0.361);// #35395c
    vec3 peak = vec3(0.290, 0.282, 0.408);    // #4a4868

    vec3 albedo = ocean;
    albedo = mix(albedo, shelf, smoothstep(0.46, 0.55, land));
    albedo = mix(albedo, coast, smoothstep(0.55, 0.60, land));
    albedo = mix(albedo, highland, smoothstep(0.60, 0.68, land));
    albedo = mix(albedo, peak, smoothstep(0.68, 0.80, land));

    float isLand = smoothstep(0.54, 0.60, land);

    // Polar caps, softened so they do not sit on the surface like a hat.
    float polar = smoothstep(0.72, 0.95, abs(unit.y));
    albedo = mix(albedo, vec3(0.529, 0.584, 0.671), polar * (0.35 + 0.5 * isLand));

    // ---- clouds ----------------------------------------------------------
    // Stretched along longitude: weather on a spinning world bands.
    vec3 cloudPoint = spin(unit, uCloudAngle);
    cloudPoint = vec3(cloudPoint.x, cloudPoint.y * 3.0, cloudPoint.z) * 1.9;
    float cloud = smoothstep(0.50, 0.78, fbm(cloudPoint, 4));
    albedo = mix(albedo, vec3(0.90, 0.92, 0.95), cloud * 0.5);

    // ---- lighting --------------------------------------------------------
    float ndl = dot(normal, uSun);
    // Wrapped Lambert: the terminator becomes the scattered band an atmosphere
    // makes, rather than the hard edge of a billiard ball.
    float wrap = 0.2;
    float diffuse = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);

    // Limb darkening: more atmosphere to look through at the edge.
    float facing = max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0);
    float limb = 0.4 + 0.6 * pow(facing, 0.55);

    vec3 color = albedo * uSunColor * diffuse * limb;

    // Ocean specular, following the same sun as everything else.
    vec3 halfway = normalize(uSun + vec3(0.0, 0.0, 1.0));
    float specular = pow(max(dot(normal, halfway), 0.0), 120.0);
    color += uSunColor * specular * (1.0 - isLand) * 0.55 * step(0.0, ndl);

    // ---- night side ------------------------------------------------------
    // Sparse warm specks on land, fading across the terminator rather than
    // switching on at it. The receiver's planet is inhabited.
    float darkness = smoothstep(-0.05, -0.32, ndl);
    float cityField = valueNoise(surfacePoint * 9.0);
    float cities = pow(smoothstep(0.80, 0.97, cityField), 2.0) * isLand;
    color += vec3(1.0, 0.812, 0.541) * cities * darkness * uNight * (1.0 - cloud * 0.7);

    // A trace of ambient, so the night side is a dark shape and not a hole.
    color += albedo * 0.035;

    gl_FragColor = vec4(color, 1.0);

    #include <colorspace_fragment>
  }
`;
