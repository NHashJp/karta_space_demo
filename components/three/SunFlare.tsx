"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PLANET_RADIUS, hubPose, hubSun, hubUnproject, worldPerPixel } from "./framing";
import { useDawn } from "./DawnProvider";

/**
 * The sun, coming up behind あなたの星 (rev 7.1 §6).
 *
 * Two objects, and the difference between them is the whole trick:
 *
 * - the **sun** itself is staged at the planet's own depth, just outside its
 *   limb, and is drawn with ordinary depth testing. So while `sunElevation` is
 *   negative the planet's disc simply covers it and all that escapes is the
 *   halo spilling past the edge — which is what blue hour looks like. As the
 *   dawn rises the sprite climbs out from behind the limb on its own, with
 *   nothing anywhere deciding that it should;
 * - the **flare** is drawn at the same depth with depth testing off and a late
 *   render order, so it is unmistakably in front of everything. Lens flare is
 *   not in the world; it is in the lens.
 *
 * Both are additive planes rather than sprites. The hub camera looks straight
 * down −Z with no roll, so a plane in XY is already facing it and billboarding
 * would be arithmetic for nothing.
 */

/** A soft radial blob: two exponentials, so it is zero before the quad's edge. */
const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/*
 * The falloff §6's sprite is drawn with: full at the centre, 45% of that at
 * 35% of the radius, nothing at the edge. Piecewise, because that is a
 * canvas gradient's shape and it is noticeably tighter in the middle than any
 * single exponential — which is what keeps the sun a *point* with a glow
 * rather than a soft ball.
 */
const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = r < 0.35
      ? mix(1.0, 0.45, r / 0.35)
      : mix(0.45, 0.0, (r - 0.35) / 0.65);
    a *= uIntensity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`;

/**
 * The flare: eight rays, a horizontal streak and two ghosts, all in one quad.
 *
 * One quad rather than one mesh per element because this is drawn every frame
 * over the whole corner of the screen, and r7's budget for the entire dawn is
 * well under a millisecond (§8.8). Everything here is a few sines of an angle.
 */
const flareFragment = /* glsl */ `
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform float uIntensity;
  uniform float uSpin;
  uniform float uGhost;
  /** A ray half-width, in the same units as p: 1.6 screen pixels. */
  uniform float uRayWidth;
  varying vec2 vUv;

  void main() {
    // The quad is 1.4 reaches wide, so the streak fits; rays are measured
    // against one reach.
    vec2 p = (vUv - 0.5) * 2.0 * 1.4;

    /*
     * Eight rays, as lines of constant **pixel** width.
     *
     * Not as angular lobes. A lobe of fixed angle is a wedge: it is a pixel
     * wide at the sun and thirty at the end of its reach, so the light is
     * spread thinner the further out it goes and the ray fades out long
     * before it is supposed to. A flare's rays are needles — the same width
     * all the way along, just dimmer — and drawing them from the distance to
     * the axis rather than from the angle is what makes them needles.
     *
     * Alternating: four long and slightly broader, four at 55% of the length
     * and thinner. Even spacing with even weights reads as a mechanical
     * starburst; the alternation is what makes it a lens.
     */
    float rays = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = uSpin + float(i) * 0.7853982;
      vec2 dir = vec2(cos(a), sin(a));
      float along = dot(p, dir);
      if (along < 0.0) continue;
      float perp = abs(p.x * dir.y - p.y * dir.x);
      bool minor = (i - (i / 2) * 2) == 1;
      float reach = minor ? 0.55 : 1.0;
      float width = uRayWidth * (minor ? 0.62 : 1.0);
      float weight = minor ? 0.40 : 0.58;
      rays += exp(-pow(perp / max(width, 1e-5), 2.0))
        * max(0.0, 1.0 - along / reach) * weight;
    }

    // A thin horizontal streak, the way an anamorphic lens smears a point.
    float streak = max(0.0, 1.0 - abs(p.x) / 1.4)
      * exp(-pow(abs(p.y) / max(uRayWidth * 1.1, 1e-5), 2.0)) * 0.28;

    // Two ghosts, on the line from the sun towards the middle of the frame.
    float ghosts = 0.0;
    ghosts += exp(-pow(length(p - vec2(uGhost, 0.0) * 0.55) * 7.0, 2.0)) * 0.10;
    ghosts += exp(-pow(length(p - vec2(uGhost, 0.0) * 0.95) * 5.0, 2.0)) * 0.07;

    float a = (rays + streak + ghosts) * uIntensity;
    if (a < 0.002) discard;

    vec3 color = mix(uCool, uWarm, clamp(rays * 1.6 + streak * 2.0, 0.0, 1.0));
    gl_FragColor = vec4(color * a, a);
    #include <colorspace_fragment>
  }
`;

type Props = { reducedMotion: boolean };

export function SunFlare({ reducedMotion }: Props) {
  const { d, visibility } = useDawn();
  const size = useThree((state) => state.size);

  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const flare = useRef<THREE.Mesh>(null);

  const coreUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#fffaeb") },
      uIntensity: { value: 1 },
    }),
    [],
  );
  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#ffd6a0") },
      uIntensity: { value: 0.5 },
    }),
    [],
  );
  const flareUniforms = useMemo(
    () => ({
      uWarm: { value: new THREE.Color("#ffe6b4") },
      uCool: { value: new THREE.Color("#bfe0ff") },
      uIntensity: { value: 0 },
      uSpin: { value: 0.12 },
      uGhost: { value: -1 },
      uRayWidth: { value: 0.01 },
    }),
    [],
  );

  /*
   * Where the sun stands this frame, and which way the frame's centre lies
   * from it — the line the ghosts sit on. Both follow from the dawn and the
   * viewport, so they are solved on those rather than every frame.
   */
  const placement = useMemo(() => {
    const sun = hubSun(size.width, size.height, d.sunElevation);
    const camera = hubPose(size.width, size.height).position;
    const depth = camera[2] - sun[2];
    const centre = hubUnproject(size.width / 2, size.height / 2, depth, size.width, size.height);
    return {
      sun,
      // −1 when the frame's centre is to the left of the sun, which it always
      // is in this composition; kept general so a future framing cannot break it.
      ghost: Math.sign(centre[0] - sun[0]) || -1,
    };
  }, [size.width, size.height, d.sunElevation]);

  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const [x, y, z] = placement.sun;

    for (const mesh of [core.current, halo.current, flare.current]) {
      mesh?.position.set(x, y, z);
    }

    /*
     * One intensity for the whole sun (§6): it climbs with the dawn and with
     * how much of the disc has cleared the limb.
     *
     * The core and halo were tuned independently of it at first, and ended up
     * about two and a half times as bright as the reference — which turned
     * the sunrise into a soft ball and drowned the rays that are supposed to
     * be the shape of it. They are proportions of the one number now: the
     * core at 0.9, the halo at 0.35, exactly as the reference has them.
     */
    const intensity = (0.25 + 0.75 * visibility) * (0.55 + 0.45 * d.p);
    coreUniforms.uIntensity.value = 0.9 * intensity;
    haloUniforms.uIntensity.value = 0.35 * intensity;

    const f = flareUniforms;
    f.uIntensity.value = intensity;
    // A barely-there turn, so the rays are not a decal. §15 freezes it.
    f.uSpin.value = 0.12 + Math.sin(t * 0.05) * 0.02;
    f.uGhost.value = placement.ghost;

    /*
     * Length R · (0.22 + 0.4p) · (0.6 + 0.4·vis) for the rays (§6), and the
     * quad is 1.4 of that each way so the horizontal streak has room.
     */
    const reach = PLANET_RADIUS * (0.22 + 0.4 * d.p) * (0.6 + 0.4 * visibility);
    flare.current?.scale.setScalar(Math.max(0.001, reach * 2 * 1.4));
    // 2.4 screen pixels, expressed in the shader's own units (one unit of
    // `p` is one reach), so a ray is a needle at any viewport.
    const camera = hubPose(size.width, size.height).position;
    const perPixel = worldPerPixel(Math.max(0.1, camera[2] - placement.sun[2]), size.height);
    f.uRayWidth.value = (2.4 * perPixel) / Math.max(reach, 1e-4);
  });

  return (
    <group>
      {/* Behind the limb: ordinary depth testing, so the planet occludes it. */}
      <mesh ref={halo} renderOrder={-2}>
        <planeGeometry args={[PLANET_RADIUS * 0.52, PLANET_RADIUS * 0.52]} />
        <shaderMaterial
          uniforms={haloUniforms}
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={core} renderOrder={-1}>
        <planeGeometry args={[PLANET_RADIUS * 0.16, PLANET_RADIUS * 0.16]} />
        <shaderMaterial
          uniforms={coreUniforms}
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* In front of everything: a flare is in the lens, not in the world. */}
      <mesh ref={flare} renderOrder={40}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={flareUniforms}
          vertexShader={glowVertex}
          fragmentShader={flareFragment}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
