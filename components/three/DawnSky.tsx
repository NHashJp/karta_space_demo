"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FOV } from "./framing";
import { useDawn } from "./DawnProvider";

/**
 * The sky the dawn happens in (rev 7.1 §6, "Sky", and §4's Milky Way band).
 *
 * Two screen-filling layers, because every number r7 gives for the sky is a
 * fraction of the viewport and nothing about it is in the world:
 *
 * - **over the gas, under the satellite**: the band of the Milky Way across
 *   the upper left, and the warm haze around the sun, which is what actually
 *   makes the corner of the frame feel like morning rather than like a lamp;
 * - **over everything**: a light wash from the sun, 5% at blue hour and 21%
 *   on the day. It is the one thing here that touches the satellite and the
 *   contrail, and it is allowed to (§7) because it touches the whole frame
 *   equally — it is the air between the lens and the scene, not a change to
 *   either of them.
 *
 * Both are planes parented to the camera with depth testing off, so they are
 * exactly the frame whatever the camera is doing. Both are **additive**, for
 * a reason worth stating: `NebulaBackdrop` is an opaque sphere enclosing the
 * whole scene, so nothing drawn behind it is ever seen. The base gradient
 * therefore lives in that shader (§18 puts it there too); everything here
 * only ever adds light on top of it.
 */

const skyVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/*
 * The back layer. Screen coordinates throughout: x right, y **down**, both
 * 0..1, which is how §4's table is written.
 */
const skyFragment = /* glsl */ `
  uniform float uDawn;
  uniform float uAspect;
  uniform vec2 uSun;        // screen uv, y down
  uniform float uFlare;     // the Propel swell (§11), 0 normally
  uniform float uMilky;     // 0 or 1: the band is optional
  uniform vec2 uMilkyA;
  uniform vec2 uMilkyB;
  uniform float uMilkyW;    // core width, as a fraction of max(w, h)
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  /** Distance from p to the segment a-b, with both scaled so x is in height units. */
  float segDistance(vec2 p, vec2 a, vec2 b) {
    vec2 v = b - a;
    float t = clamp(dot(p - a, v) / max(dot(v, v), 1e-6), 0.0, 1.0);
    return length(p - a - v * t);
  }

  void main() {
    vec2 s = vec2(vUv.x, 1.0 - vUv.y);
    vec3 color = vec3(0.0);

    /*
     * The Milky Way. Measured in height units on both axes so the band is the
     * same thickness whichever way it runs across the frame.
     *
     * Four layers, because a band of the galaxy is not a stripe:
     *
     * - a wide, faint **halo**, two and a half times the core's width. It is
     *   the layer that makes the band read as something you are *inside*
     *   rather than as a brushstroke laid on the sky;
     * - the **core**, bright and cream-centred;
     * - two **dust lanes**, wandering along it, which is the only thing that
     *   stops a band of light from reading as fog. The galaxy's dark bands
     *   are as recognisable as its bright ones;
     * - **stars**, two octaves of them, dense enough to be a field rather
     *   than a sprinkle.
     */
    if (uMilky > 0.5) {
      vec2 p = vec2(s.x * uAspect, s.y);
      vec2 a = vec2(uMilkyA.x * uAspect, uMilkyA.y);
      vec2 b = vec2(uMilkyB.x * uAspect, uMilkyB.y);
      float d = segDistance(p, a, b);
      float w = uMilkyW * max(uAspect, 1.0);

      // How far along the band this pixel is, for the lanes to wander with.
      vec2 axis = b - a;
      float along = clamp(dot(p - a, axis) / max(dot(axis, axis), 1e-6), 0.0, 1.0);

      float halo = exp(-pow(d / (w * 2.4), 2.0));
      float core = exp(-pow(d / w, 2.0));

      /*
       * The lanes. Each is a dark Gaussian offset from the centre line,
       * wandering with a low-frequency noise so it is never a straight bar.
       */
      float wander = noise2(vec2(along * 7.0, 3.1)) - 0.5;
      float lane1 = exp(-pow((d - w * (0.10 + 0.55 * wander)) / (w * 0.34), 2.0));
      float wander2 = noise2(vec2(along * 4.0, 11.7)) - 0.5;
      float lane2 = exp(-pow((d - w * (0.85 + 0.6 * wander2)) / (w * 0.26), 2.0));
      float dust = clamp(lane1 * 0.62 + lane2 * 0.40, 0.0, 0.85);

      // Cream in the core, violet-blue in the wings, the way it looks.
      vec3 milkyCore = vec3(0.953, 0.902, 0.812);
      vec3 milkyWing = vec3(0.561, 0.612, 1.0);
      vec3 milky = mix(milkyWing, milkyCore, smoothstep(0.30, 1.0, core));

      color += milkyWing * halo * 0.055;
      color += milky * core * 0.150 * (1.0 - dust);

      /*
       * Grain, standing in for the mockup's five thousand little stars.
       *
       * The exponents are what make it stars rather than fog. A smooth noise
       * raised to a low power is a field of soft blobs a couple of pixels
       * across, which at this density reads as a dense cluster sitting in
       * front of the sky — the opposite of a band seen edge-on from inside
       * it. Raised far enough, only the peaks survive and they are points.
       */
      float grain = pow(noise2(p * 520.0), 34.0) * 1.6
        + pow(noise2(p * 1150.0 + 7.0), 44.0) * 1.2
        + pow(noise2(p * 300.0 + 19.0), 54.0) * 0.8
        + pow(noise2(p * 820.0 + 31.0), 48.0) * 1.0;

      float field = mix(halo * 0.5, 1.0, core);
      color += vec3(1.0, 0.953, 0.882) * grain * field * (1.0 - dust * 0.7) * 1.9;
    }

    /*
     * The warm haze around the sun. A screen blend over the sky, so it lifts
     * the dark end rather than painting over it: gold at the sun, through a
     * dusty red, into violet, gone by the far corner.
     */
    vec2 toSun = vec2((s.x - uSun.x) * uAspect, s.y - uSun.y);
    float r = length(toSun) / ((0.55 + 0.35 * uDawn) * max(uAspect, 1.0));
    float warmA = 0.10 + 0.32 * uDawn + uFlare * 0.2;
    vec3 haze =
      vec3(1.0, 0.839, 0.627) * warmA * max(0.0, 1.0 - smoothstep(0.0, 0.25, r)) +
      vec3(0.839, 0.510, 0.431) * warmA * 0.35 * max(0.0, 1.0 - smoothstep(0.1, 0.6, r)) +
      vec3(0.471, 0.353, 0.667) * warmA * 0.12 * max(0.0, 1.0 - smoothstep(0.3, 1.0, r));

    color += clamp(haze, 0.0, 1.0);

    float a = clamp(max(color.r, max(color.g, color.b)), 0.0, 1.0);
    if (a < 0.002) discard;
    gl_FragColor = vec4(color, a);
    #include <colorspace_fragment>
  }
`;

/** The wash, over the top of the whole frame. */
const washFragment = /* glsl */ `
  uniform float uDawn;
  uniform float uAspect;
  uniform vec2 uSun;
  varying vec2 vUv;

  void main() {
    vec2 s = vec2(vUv.x, 1.0 - vUv.y);
    vec2 toSun = vec2((s.x - uSun.x) * uAspect, s.y - uSun.y);
    float r = length(toSun) / (1.1 * max(uAspect, 1.0));
    float a = (0.05 + 0.16 * uDawn) * max(0.0, 1.0 - r);
    if (a < 0.002) discard;
    gl_FragColor = vec4(vec3(1.0, 0.784, 0.549) * a, a);
    #include <colorspace_fragment>
  }
`;

/** §4: where the band crosses the frame, and how wide its core is. */
/** Inside the camera's far plane (120), behind everything the hub stages. */
const SKY_DISTANCE = 100;

const MILKY = {
  portrait: { a: [1.05, -0.06], b: [-0.2, 0.5], width: 0.12 },
  landscape: { a: [0.6, -0.08], b: [-0.05, 0.72], width: 0.11 },
} as const;

type Props = {
  /** The band is optional: a card can be given a plain sky (§4, §29). */
  milkyWay?: boolean;
  /** The Propel beat swells the haze by 0.35 for its two and a bit seconds. */
  flare?: React.RefObject<number>;
};

export function DawnSky({ milkyWay = true, flare }: Props) {
  const { d, sunScreen } = useDawn();
  const size = useThree((state) => state.size);

  const back = useRef<THREE.Mesh>(null);
  const wash = useRef<THREE.Mesh>(null);

  const aspect = size.width / size.height;
  const milky = MILKY[size.width < size.height ? "portrait" : "landscape"];

  const backUniforms = useMemo(
    () => ({
      uDawn: { value: 0.2 },
      uAspect: { value: 1 },
      uSun: { value: new THREE.Vector2(0.9, 0.6) },
      uFlare: { value: 0 },
      uMilky: { value: 1 },
      uMilkyA: { value: new THREE.Vector2() },
      uMilkyB: { value: new THREE.Vector2() },
      uMilkyW: { value: 0.11 },
    }),
    [],
  );

  const washUniforms = useMemo(
    () => ({
      uDawn: { value: 0.2 },
      uAspect: { value: 1 },
      uSun: { value: new THREE.Vector2(0.9, 0.6) },
    }),
    [],
  );

  useFrame(({ camera }) => {
    /*
     * Both planes ride the camera, one unit in front of it, sized to the
     * frustum at that distance. Depth testing is off, so the distance decides
     * nothing except the scale; what decides what covers what is the render
     * order.
     */
    const height = 2 * Math.tan(((FOV * Math.PI) / 180) / 2);
    /*
     * The sky is placed far back, where it is depth-tested against the
     * planet, and the wash just in front of the lens. Transparent things are
     * drawn after solid ones whatever their render order, so a sky one unit
     * from the lens with depth testing off was painted *over* the planet —
     * its warm haze lay across the night side and turned a dark world with a
     * brilliant edge into a grey one. In the mockup the planet covers the sky.
     */
    const placed: [THREE.Mesh | null, number][] = [
      [back.current, SKY_DISTANCE],
      [wash.current, 1],
    ];
    for (const [mesh, distance] of placed) {
      if (!mesh) continue;
      mesh.quaternion.copy(camera.quaternion);
      mesh.position.copy(camera.position);
      mesh.translateZ(-distance);
      mesh.scale.set(height * aspect * distance, height * distance, 1);
    }

    const sx = sunScreen[0] / size.width;
    const sy = sunScreen[1] / size.height;

    const b = backUniforms;
    b.uDawn.value = d.p;
    b.uAspect.value = aspect;
    b.uSun.value.set(sx, sy);
    b.uFlare.value = flare?.current ?? 0;
    b.uMilky.value = milkyWay ? 1 : 0;
    b.uMilkyA.value.set(milky.a[0], milky.a[1]);
    b.uMilkyB.value.set(milky.b[0], milky.b[1]);
    b.uMilkyW.value = milky.width;

    const w = washUniforms;
    w.uDawn.value = d.p;
    w.uAspect.value = aspect;
    w.uSun.value.set(sx, sy);
  });

  return (
    <>
      {/*
        After the gas (renderOrder -10) and before the stars (-5), so the band
        sits in the sky rather than in front of it and the stars still shine
        through it — which is how a real band of the galaxy reads.
      */}
      <mesh ref={back} renderOrder={-6} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={backUniforms}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={wash} renderOrder={60} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={washUniforms}
          vertexShader={skyVertex}
          fragmentShader={washFragment}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
