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
 * 4. **Night-side lights.** Warm specks on land where the sun has set.
 *    Small, and the difference between a planet and an inhabited one.
 *
 * Revision 7.1 §6 turns the planet round. The face towards the camera is now
 * its **night side**, with the sun just behind the limb — so the surface this
 * shader spent most of its effort on is in shadow, and what the reader
 * actually sees is three things it barely had:
 *
 * - a **sunlit crescent** at the limb, which widens as the reunion nears,
 *   because the sun is physically climbing (`Dawn.sunElevation`). Nothing
 *   special draws it: point the key light at the limb and the N·L term that
 *   was already here produces it;
 * - **city lights**, no longer sparse. Forty-odd clusters in the outer fifth
 *   of the visible disc, flickering, fading out where it is already day. They
 *   are the single strongest reason the scene stops reading as "a cold, empty
 *   sky": somebody lives down there, and it is the person the letter is for;
 * - a trace of **aurora** along the limb (drawn in the air shell, not here).
 *
 * The night base is r7's three-stop radial — #04070e inside to #0d1a30 at the
 * limb — mixed under the albedo rather than replacing it, so the coastlines
 * are still faintly there to put the cities on.
 */

/*
 * Drawn on a **disc facing the camera**, not on a sphere.
 *
 * The hub stages this planet huge and very close — its centre under three
 * units from the lens on a desktop, with a radius of 2.2 — and far off to the
 * side of the frame. A real sphere there is drawn with heavy perspective: its
 * outline on screen is a stretched shape half as big again as the circle the
 * composition asks for (`hubPlanetScreen`). Everything that hangs off that
 * circle — the limb's air ring, the sun on the horizon, the crescent, the
 * aurora — then sat on a contour the planet did not have, and the shine on
 * the limb ran off the edge of the world.
 *
 * So the surface is a flat disc of radius 1, turned to face the camera, and
 * the sphere is reconstructed here from where the fragment lands on it. Its
 * outline is exactly the circle everything else is placed on, from every
 * camera pose, which is what the mockup — a flat painted disc — always had.
 */
export const planetVertexShader = /* glsl */ `
  varying vec2 vLocal;

  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const planetFragmentShader = /* glsl */ `
  uniform float uSurfaceAngle;
  uniform float uCloudAngle;
  uniform vec3 uSun;
  uniform vec3 uSunColor;
  uniform float uNight;
  /** The dawn, 0.2 (blue hour) to 1 (the day) — rev 7.1 §3. */
  uniform float uDawn;
  /** Seconds, for the city flicker. Frozen under reduced motion. */
  uniform float uTime;
  /**
   * Where the sun is on the disc, in planet radii from its centre, screen
   * axes with y up. Just over 1.0 out: on the limb, or a little above it
   * once the dawn has lifted it (§4, Dawn.sunElevation).
   */
  uniform vec2 uSunPos;
  /** One screen pixel, in planet radii, so city lights are sized on screen. */
  uniform float uPixel;

  varying vec2 vLocal;

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

  /*
   * The colours §6 gives are hex, which is sRGB; this shader's output goes
   * through colorspace_fragment, which encodes linear to sRGB. So r7's stops
   * have to be decoded on the way in or they come back out about ten times
   * too bright — which is the difference between a night side and a pale
   * daylit ball, and is exactly how the first attempt at this went wrong.
   *
   * 2.2 rather than the exact piecewise curve: these are all deep colours
   * where the two agree closely, and a number anyone can check by eye against
   * the document is worth more here than the last per cent.
   *
   * The surface palette above predates r7 and is deliberately left alone — it
   * was tuned in this same convention, and correcting it would change the
   * planet's daylight, which r7 does not ask for.
   */
  vec3 srgb(vec3 c) {
    return pow(c, vec3(2.2));
  }

  vec3 spin(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  }

  void main() {
    float rr = dot(vLocal, vLocal);
    if (rr > 1.0) discard;
    // The sphere under this point of the disc, in view space (the disc faces
    // the camera), and the same point in the world, so the ground does not
    // slide when the camera turns.
    vec3 normal = vec3(vLocal, sqrt(1.0 - rr));
    vec3 unit = normalize((vec4(normal, 0.0) * viewMatrix).xyz);

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
    float cloud = smoothstep(0.54, 0.82, fbm(cloudPoint, 4));
    /*
     * Thinner and a shade cooler than they were. At half weight in near-white
     * the weather covered the ocean, and a planet that reads as a pale ball
     * takes the eye off the one thing in the corner that should have it: the
     * lit rim of its own air (mockups M5, M14b).
     */
    albedo = mix(albedo, vec3(0.80, 0.85, 0.91), cloud * 0.36);

    // ---- the night side the camera is looking at (rev 7.1 §6) ------------
    /*
     * Everything below is in the **disc's own screen space**, and that is a
     * deliberate departure from how a planet is normally shaded.
     *
     * The usual way — N·L against a sun direction — cannot draw this picture.
     * The sun sits *on the visible limb*, a little over one radius from the
     * centre, and the arc of this planet the composition actually shows is
     * the same arc the sun is on. Any hemisphere lighting therefore lights
     * the whole of what you can see, which is a daylit ball: the exact image
     * r7 replaces. §6 does not describe hemisphere lighting. It describes a
     * radial wash from a point on the limb, and that is what this is.
     *
     * For a unit sphere the surface point and its normal are the same vector,
     * so normal.xy is already where the fragment lands on the disc, in
     * planet radii, and radius is how far out it is.
     */
    float facing = max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0);
    float radius = sqrt(max(0.0, 1.0 - facing * facing));
    vec2 disc = normal.xy;

    /*
     * The night radial: #04070e inside, #08111f, #0d1a30 at the limb — and
     * the *stops* matter as much as the colours.
     *
     * §6 gives it as a canvas gradient from 0.6R to R, so the inner three
     * fifths of the disc are flat #04070e and the whole transition happens in
     * the outer two fifths. Spreading it across the full radius instead — an
     * easy thing to do, and what this did at first — lifts the middle of the
     * disc by a factor of three, and the planet stops being a dark shape with
     * a bright edge and becomes a grey ball. The drama in this composition is
     * entirely contrast: black, then one brilliant line.
     */
    vec3 nightDeep = srgb(vec3(0.016, 0.027, 0.055));
    vec3 nightMid  = srgb(vec3(0.031, 0.067, 0.122));
    vec3 nightEdge = srgb(vec3(0.051, 0.102, 0.188));
    vec3 night = mix(nightDeep, nightMid, smoothstep(0.60, 0.96, radius));
    night = mix(night, nightEdge, smoothstep(0.96, 1.0, radius));

    /*
     * The land is still there under it, and *barely*. It is here so the
     * coastlines have somewhere to put cities, not so that anyone can see
     * them: at any weight where the continents read, the night side reads as
     * lit, which is the one thing it must not do.
     */
    vec3 color = night + albedo * 0.012 * (1.0 - cloud * 0.4);

    /*
     * The sunlit crescent: a wash from the sun, clipped to the disc, whose
     * radius is R · (0.18 + 0.5p). It widens as the day nears, which is the
     * countdown written on the planet itself.
     *
     * **Composited, not added.** §6 gives it as an rgba gradient painted over
     * the disc, and the difference is the whole look: adding it lifts the
     * entire visible arc towards grey, because the sun sits on the limb and
     * the arc the composition shows is the arc the sun is on — so almost all
     * of the planet you can see is inside the wash. Mixing towards the wash
     * colour instead leaves the night side at the night colour and only the
     * sliver near the sunrise lit, which is the dramatic, high-contrast
     * reading the mockup has and the one the whole scene is composed for.
     *
     * Piecewise linear between the three stops, because a canvas gradient is
     * linear and a smoothstep here visibly widens the bright part.
     */
    float toSun = length(disc - uSunPos);
    float reach = 0.18 + 0.5 * uDawn;
    float u = clamp(toSun / max(reach, 1e-4), 0.0, 1.0);

    vec3 washWarm = srgb(vec3(1.0, 0.839, 0.627));   // #ffd6a0
    vec3 washCool = srgb(vec3(0.353, 0.588, 0.824)); // #5a96d2
    vec3 washDeep = srgb(vec3(0.078, 0.157, 0.314)); // #142850, the last stop

    float washA = u < 0.3
      ? mix(0.35 + 0.4 * uDawn, 0.05 + 0.22 * uDawn, u / 0.3)
      // Squared on the way out, so the scattered blue falls off the way air
      // does and the night side stays night rather than going grey.
      : mix(0.05 + 0.22 * uDawn, 0.0, pow((u - 0.3) / 0.7, 0.6));
    vec3 washColour = u < 0.3
      ? mix(washWarm, washCool, u / 0.3)
      : mix(washCool, washDeep, (u - 0.3) / 0.7);

    // The ground shows through the lit part, which is what stops the crescent
    // reading as a painted highlight rather than as morning on a world.
    color = mix(color, washColour + albedo * 0.22 * (1.0 - u), washA);

    // A specular skim where the sunrise crosses ocean.
    color += washWarm * pow(1.0 - u, 6.0) * (1.0 - isLand) * 0.30 * uSunColor;

    // ---- city lights (r7 §6: prominent now) -------------------------------
    /*
     * Clustered rather than scattered: a coarse field decides where a cluster
     * is at all and a fine one puts the lights inside it, which is what makes
     * them read as towns instead of as noise. They ride the surface rotation,
     * because they are on the ground.
     */
    /*
     * Two scales: a coarse field says where a cluster is at all, and a much
     * finer one puts the individual lights inside it. The fine one has to be
     * *fine* — at the scale this started out, every "light" was fifteen
     * pixels across and the coast read as a row of orange clouds. These are
     * towns seen from orbit; they are points.
     */
    /*
     * Sized in **screen pixels**, as the dawn mockup draws them: about
     * forty-five small clusters near the limb, each a handful of 1–2 px
     * points. Fixed surface frequencies made a light fifteen pixels across on
     * a desktop and the coast read as a row of orange clouds; scaling by the
     * pixel keeps a town a speck at every size the planet is drawn.
     */
    float pointFreq = 1.0 / (2.3 * 2.6 * uPixel);
    float clusterFreq = 1.0 / (2.3 * 26.0 * uPixel);
    float cluster = pow(smoothstep(0.66, 0.86, valueNoise(surfacePoint * clusterFreq)), 1.2);
    float grain = valueNoise(surfacePoint * pointFreq);
    float cities = pow(smoothstep(0.72, 0.96, grain), 2.0) * cluster * isLand;

    /*
     * In the outer third of the disc, which is the part of this planet the
     * composition actually shows — and on a phone that matters twice over,
     * because the planet is relatively much bigger there and the frame cuts
     * deeper into it. §6 says "the outer 18%"; reaching a little further in
     * is what keeps the night side inhabited rather than empty on a phone.
     */
    float outer = smoothstep(0.78, 0.84, radius) * (1.0 - smoothstep(0.988, 1.0, radius));
    cities *= outer;

    // Out where it is already day there is nothing to see: they fade inside
    // (0.12 + 0.25p) · R of the sun.
    float day = 1.0 - smoothstep(0.02, 0.12 + 0.25 * uDawn, toSun);
    cities *= 1.0 - day;

    // Each cluster on its own phase, so the coast twinkles: +/-35%.
    float flicker = 0.75 + 0.25 * sin(uTime * 0.9 + grain * 40.0 + cluster * 9.0);

    vec3 cityCore = srgb(vec3(1.0, 0.839, 0.588));  // #ffd696
    vec3 cityGlow = srgb(vec3(1.0, 0.769, 0.471));  // #ffc478
    color += cityCore * cities * flicker * uNight * 1.5 * (1.0 - cloud * 0.5);
    // A warmer rim on each point, the mockup's small glow round a light —
    // on the point itself, not as a wash over the cluster.
    color += cityGlow * cities * flicker * uNight * 0.35;

    gl_FragColor = vec4(color, 1.0);

    #include <colorspace_fragment>
  }
`;
