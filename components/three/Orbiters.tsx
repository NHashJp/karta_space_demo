"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  hubSunScreen,
  hubUnproject,
  orbitFrame,
  orbiterDepths,
  worldPerPixel,
  type OrbitFrame,
} from "./framing";
import {
  depthBucket,
  depthScale,
  litLevel,
  makeOrbiters,
  pixelScale,
  screenPos,
  type Orbiter,
} from "@/lib/orbiters";
import { useDawn } from "./DawnProvider";

/**
 * Company in orbit (rev 7.1 §8.4–§8.8).
 *
 * `lib/orbiters.ts` decides where everything is, in screen pixels and in its
 * own time. This draws it, and two decisions are worth explaining.
 *
 * **Screen-anchored, depth-ordered.** Each object is placed on the hub
 * camera's ray through its pixel and then pushed along that ray to one of
 * three depths. Because it stays on its ray, the depth changes *nothing*
 * about where it appears — only about what covers it. That is what buys the
 * reading r7 asks for: things vanish behind the planet on one leg of the
 * orbit and pass in front of it on the other, with no sorting code and no
 * render-order tricks. It also means the look does not depend on how far the
 * build's camera happens to be from the planet, which is staged per aspect
 * ratio and is not a number anything else should be built on.
 *
 * **Three meshes for twenty-nine objects.** Not three hundred little meshes,
 * which is the obvious way to write this and would cost more draw calls than
 * the rest of the scene put together (§8.8 allows eight). Every object's
 * shape is a handful of flat polygons in screen units, so all of them are
 * rebuilt into one vertex buffer each frame on the CPU: about nine hundred
 * vertices, which is nothing, in exchange for one draw call for all the
 * bodies, one for the glows and one for the crane's warm light. The depth
 * buffer still does the occlusion, because every vertex carries its real
 * world depth.
 *
 * Nothing here is a tap target (§8.7): twenty-nine small objects drifting
 * across a scene whose whole interaction model is "tap the thing you can see"
 * would otherwise swallow taps meant for the satellite or the comet.
 */

const FADE_IN_S = 0.6;
const FADE_OUT_S = 0.4;

/** Room in the buffers. Measured at 936 and 360; these are comfortable. */
const MAX_SOLID_VERTS = 4096;
const MAX_GLOW_VERTS = 1536;

const noRaycast = () => null;

type RGB = [number, number, number];

type Props = {
  /** The card's own seed: the same card always shows the same sky (§8.2). */
  seed: number;
  /** The contrail's seed, so the orbiters know where it runs (§8.3). */
  trailSeed: number;
  hasTrail: boolean;
  reducedMotion: boolean;
  /**
   * Shown in the hub and everything staged in it; faded out when the camera
   * leaves for the chart, the close-up or the trail (§8.7). The clock keeps
   * running either way, so nothing jumps on the way back.
   */
  visible: boolean;
};

export function Orbiters({
  seed,
  trailSeed,
  hasTrail,
  reducedMotion,
  visible,
}: Props) {
  const size = useThree((state) => state.size);
  const { d } = useDawn();

  const frame = useMemo<OrbitFrame>(
    () => orbitFrame(trailSeed, size.width, size.height, hasTrail),
    [trailSeed, size.width, size.height, hasTrail],
  );

  const set = useMemo(() => makeOrbiters(seed, frame), [seed, frame]);

  /** Each object's rock outline, built once: it is a fact about the object. */
  const outlines = useMemo(
    () =>
      set.map((o) =>
        o.type === "rock"
          ? o.shape.map((m, i) => {
              const a = (i / o.shape.length) * Math.PI * 2;
              const r = 2.2 + 2.8 * o.rs * o.rs;
              return [Math.cos(a) * r * m, Math.sin(a) * r * m * 0.8] as [number, number];
            })
          : null,
      ),
    [set],
  );

  /** Where the three depth buckets sit (§8.4; solved in `orbiterDepths`). */
  const depths = useMemo(
    () => orbiterDepths(size.width, size.height),
    [size.width, size.height],
  );

  /*
   * The clock. Seconds since the orbit view first opened in this visit, kept
   * here rather than read off the renderer's own clock because §8.2 is
   * explicit: it has to keep running while sheets are open and while the
   * camera is away, so that coming back to the hub never teleports the sky.
   */
  const clock = useRef(0);
  const fade = useRef(visible ? 1 : 0);

  const solid = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);

  const buffers = useMemo(
    () => ({
      solid: makeBuffers(MAX_SOLID_VERTS, false),
      glow: makeBuffers(MAX_GLOW_VERTS, true),
    }),
    [],
  );
  useEffect(
    () => () => {
      buffers.solid.geometry.dispose();
      buffers.glow.geometry.dispose();
    },
    [buffers],
  );

  const materials = useMemo(
    () => ({
      solid: new THREE.ShaderMaterial({
        uniforms: { uFade: { value: 1 } },
        vertexShader: solidVertex,
        fragmentShader: solidFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
      glow: new THREE.ShaderMaterial({
        uniforms: { uFade: { value: 1 } },
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    }),
    [],
  );
  useEffect(
    () => () => {
      materials.solid.dispose();
      materials.glow.dispose();
    },
    [materials],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // The clock runs whether or not anything is on screen (§8.2). Reduced
    // motion freezes everything at t = 0, where every craft is in view (§8.7).
    if (!reducedMotion) clock.current += dt;
    const t = reducedMotion ? 0 : clock.current;

    const target = visible ? 1 : 0;
    const step = dt / (visible ? FADE_IN_S : FADE_OUT_S);
    const gap = target - fade.current;
    fade.current += Math.sign(gap) * Math.min(Math.abs(gap), step);

    materials.solid.uniforms.uFade.value = fade.current;
    materials.glow.uniforms.uFade.value = fade.current;

    if (solid.current) solid.current.visible = fade.current > 0.004;
    if (glow.current) glow.current.visible = fade.current > 0.004;
    if (fade.current <= 0.004) return;

    const sun = hubSunScreen(size.width, size.height, d.sunElevation);
    const k0 = pixelScale(frame);

    const write = { solid: resetWriter(buffers.solid), glow: resetWriter(buffers.glow) };

    set.forEach((o, index) => {
      const p = screenPos(o, t, frame);
      // Everything off the frame by a comfortable margin is simply skipped:
      // it is the cheapest cull there is and it never shows.
      if (p.x < -80 || p.y < -80 || p.x > frame.width + 80 || p.y > frame.height + 80) return;

      const depth = depths[depthBucket(p, frame)];
      const origin = hubUnproject(p.x, p.y, depth, size.width, size.height);
      // Screen pixels per local unit, and then world units per local unit at
      // whatever depth this object landed at.
      const k = k0 * o.size * depthScale(p);
      const unit = k * worldPerPixel(depth, size.height);

      const lit = litLevel(p, d.p);
      // The sun's bearing from this object, on screen, which is what every
      // shaded side and every glint is measured against.
      const sunAngle = Math.atan2(sun[1] - p.y, sun[0] - p.x);

      drawOrbiter({
        o,
        t,
        lit,
        sunAngle,
        unit,
        perPixel: 1 / k,
        origin,
        outline: outlines[index],
        dawn: d.p,
        reducedMotion,
        write,
      });
    });

    commit(buffers.solid, write.solid);
    commit(buffers.glow, write.glow);
  });

  return (
    <group>
      <mesh
        ref={solid}
        geometry={buffers.solid.geometry}
        material={materials.solid}
        frustumCulled={false}
        renderOrder={6}
        raycast={noRaycast}
      />
      <mesh
        ref={glow}
        geometry={buffers.glow.geometry}
        material={materials.glow}
        frustumCulled={false}
        renderOrder={7}
        raycast={noRaycast}
      />
    </group>
  );
}

/* ---------------------------------------------------------------------------
 * The two materials
 * ------------------------------------------------------------------------- */

const solidVertex = /* glsl */ `
  attribute vec4 tint;
  varying vec4 vTint;
  void main() {
    vTint = tint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const solidFragment = /* glsl */ `
  uniform float uFade;
  varying vec4 vTint;
  void main() {
    float a = vTint.a * uFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vTint.rgb, a);
    #include <colorspace_fragment>
  }
`;

/** The same, with a radial falloff across each quad: halos, glints, blooms. */
const glowVertex = /* glsl */ `
  attribute vec4 tint;
  attribute vec2 blob;
  varying vec4 vTint;
  varying vec2 vBlob;
  void main() {
    vTint = tint;
    vBlob = blob;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform float uFade;
  varying vec4 vTint;
  varying vec2 vBlob;
  void main() {
    float r = length(vBlob);
    if (r > 1.0) discard;
    // Two exponentials: a soft core that is already zero at the quad's edge,
    // so a halo never shows the square it is drawn on.
    float falloff = exp(-r * 3.1) * 0.6 + exp(-r * 9.0) * 0.4;
    float a = vTint.a * falloff * uFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vTint.rgb * a, a);
    #include <colorspace_fragment>
  }
`;

/* ---------------------------------------------------------------------------
 * Buffers
 * ------------------------------------------------------------------------- */

type Buffers = {
  geometry: THREE.BufferGeometry;
  position: THREE.BufferAttribute;
  tint: THREE.BufferAttribute;
  blob?: THREE.BufferAttribute;
  max: number;
};

function makeBuffers(max: number, withBlob: boolean): Buffers {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
  const tint = new THREE.BufferAttribute(new Float32Array(max * 4), 4);
  position.setUsage(THREE.DynamicDrawUsage);
  tint.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("tint", tint);

  let blob: THREE.BufferAttribute | undefined;
  if (withBlob) {
    blob = new THREE.BufferAttribute(new Float32Array(max * 2), 2);
    blob.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("blob", blob);
  }
  // The bounding sphere is never recomputed; frustum culling is off instead,
  // because these move every frame and the mesh is always on screen anyway.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return { geometry, position, tint, blob, max };
}

type Writer = { buffers: Buffers; n: number };

function resetWriter(buffers: Buffers): Writer {
  return { buffers, n: 0 };
}

function commit(buffers: Buffers, writer: Writer) {
  buffers.geometry.setDrawRange(0, writer.n);
  buffers.position.needsUpdate = true;
  buffers.tint.needsUpdate = true;
  if (buffers.blob) buffers.blob.needsUpdate = true;
}

function vertex(
  w: Writer,
  x: number,
  y: number,
  z: number,
  colour: RGB,
  alpha: number,
  bx = 0,
  by = 0,
) {
  const { buffers } = w;
  if (w.n >= buffers.max) return;
  const i = w.n;
  buffers.position.setXYZ(i, x, y, z);
  buffers.tint.setXYZW(i, colour[0], colour[1], colour[2], alpha);
  buffers.blob?.setXY(i, bx, by);
  w.n += 1;
}

/* ---------------------------------------------------------------------------
 * Drawing, in the screen units §8.5 is written in (x forward, y down)
 * ------------------------------------------------------------------------- */

type Pen = {
  w: { solid: Writer; glow: Writer };
  origin: [number, number, number];
  /** World units per local unit, where local units are §8.5's screen units. */
  unit: number;
  /**
   * Local units per screen pixel.
   *
   * Needed because two things in §8.5 are given in *pixels* rather than in
   * the object's own units — the nav lights, which are 1.1 px and must not
   * grow with the object, and the hairlines. Dividing by `unit` instead gives
   * local units per *world* unit, which is a couple of hundred times too big
   * and draws a nav light the size of a quarter of the screen.
   */
  perPixel: number;
  /** The object's own rotation on screen, radians clockwise. */
  angle: number;
  lit: number;
};

/** A local (x, y) in screen units to a world point. Screen y is down. */
function place(pen: Pen, x: number, y: number): [number, number, number] {
  const c = Math.cos(pen.angle);
  const s = Math.sin(pen.angle);
  const rx = x * c - y * s;
  const ry = x * s + y * c;
  return [pen.origin[0] + rx * pen.unit, pen.origin[1] - ry * pen.unit, pen.origin[2]];
}

/** A convex polygon, as a triangle fan. */
function fill(pen: Pen, points: readonly (readonly [number, number])[], colour: RGB, alpha = 1) {
  const c: RGB = [colour[0] * pen.lit, colour[1] * pen.lit, colour[2] * pen.lit];
  for (let i = 1; i < points.length - 1; i++) {
    for (const index of [0, i, i + 1]) {
      const [x, y, z] = place(pen, points[index][0], points[index][1]);
      vertex(pen.w.solid, x, y, z, c, alpha);
    }
  }
}

/** An axis-aligned rectangle in the object's own frame. */
function rect(
  pen: Pen,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: RGB,
  alpha = 1,
) {
  fill(
    pen,
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    colour,
    alpha,
  );
}

/** A soft round glow of radius `r` screen units, centred at (x, y). */
function blob(pen: Pen, x: number, y: number, r: number, colour: RGB, alpha: number) {
  // The far leg sits deeper in the haze, and so does its halo (§8.6).
  const a = alpha * pen.lit;
  if (a < 0.004) return;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const c: RGB = [colour[0], colour[1], colour[2]];
  for (let i = 1; i < 3; i++) {
    for (const index of [0, i, i + 1]) {
      const [bx, by] = corners[index];
      // Glows do not rotate with the object: they are light, not structure.
      const wx = pen.origin[0] + (x + bx * r) * pen.unit;
      const wy = pen.origin[1] - (y + by * r) * pen.unit;
      vertex(pen.w.glow, wx, wy, pen.origin[2], c, a, bx, by);
    }
  }
}

/** §8.5's sparkle: a soft core with a thin cross through it. */
function sparkle(pen: Pen, x: number, y: number, r: number, alpha: number) {
  if (alpha < 0.03) return;
  blob(pen, x, y, r * 2.2, [1, 0.957, 0.882], 0.6 * alpha);
  const bar: RGB = [1, 0.973, 0.922];
  const save = pen.angle;
  pen.angle = 0;
  rect(pen, x - r * 2, y - 0.4, r * 4, 0.8, bar, 0.8 * alpha);
  rect(pen, x - 0.4, y - r * 2, 0.8, r * 4, bar, 0.8 * alpha);
  pen.angle = save;
}

const COLOURS = {
  body: [0.118, 0.137, 0.196] as RGB, // #1e2332
  edge: [0.863, 0.894, 0.941] as RGB, // #dce4f0
  panel: [0.149, 0.243, 0.408] as RGB, // #263e68
  panelLine: [0.0, 0.682, 0.937] as RGB, // #00aeef
  boom: [0.686, 0.769, 0.847] as RGB, // #afc4d8
  truss: [0.804, 0.839, 0.902] as RGB, // #cdd6e6
  panelEdge: [0.624, 0.706, 0.788] as RGB, // #9fb4c9
  module: [0.851, 0.871, 0.902] as RGB, // #d9dee6
  radiator: [1, 1, 1] as RGB,
  navRed: [1, 0.431, 0.431] as RGB, // #ff6e6e
  navGreen: [0.431, 1, 0.667] as RGB, // #6effaa
  navOff: [0.471, 0.51, 0.588] as RGB, // #78829a
  rockLit: [0.941, 0.894, 0.808] as RGB, // #f0e4ce
  rockMid: [0.518, 0.51, 0.549] as RGB, // #84828c
  rockDark: [0.173, 0.184, 0.227] as RGB, // #2c2f3a
  moonLit: [0.941, 0.918, 0.871] as RGB, // #f0eade
  moonMid: [0.588, 0.58, 0.588] as RGB, // #969496
  moonDark: [0.141, 0.149, 0.188] as RGB, // #242630
  crater: [0.235, 0.243, 0.282] as RGB,
  haloCraft: [0.745, 0.871, 1] as RGB,
  haloRock: [0.843, 0.824, 0.882] as RGB,
} as const;

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function drawOrbiter(args: {
  o: Orbiter;
  t: number;
  lit: number;
  sunAngle: number;
  unit: number;
  perPixel: number;
  origin: [number, number, number];
  outline: [number, number][] | null;
  dawn: number;
  reducedMotion: boolean;
  write: { solid: Writer; glow: Writer };
}) {
  const { o, t, lit, sunAngle, unit, perPixel, origin, outline, dawn, reducedMotion, write } = args;
  const pen: Pen = { w: write, origin, unit, perPixel, angle: 0, lit };

  if (o.type === "cubesat") {
    pen.angle = o.sp + (reducedMotion ? 0 : t * o.spin);
    const b = 3;
    const pw = 5.5;
    const ph = 3.2;

    blob(pen, 0, 0, 9, COLOURS.haloCraft, 0.07);
    for (const side of [-1, 1] as const) {
      const x0 = side < 0 ? -b - 1.2 - pw : b + 1.2;
      rect(pen, x0, -ph / 2, pw, ph, COLOURS.panel, 0.96);
      rect(pen, x0 + pw / 2 - 0.15, -ph / 2, 0.3, ph, COLOURS.panelLine, 0.45);
      rect(pen, Math.min(side * b, side * (b + 1.2)), -0.3, 1.2, 0.6, COLOURS.boom, 0.95);
    }
    rect(pen, -b, -b, 2 * b, 2 * b, COLOURS.body, 1);
    // The edges, as four hairlines round the body.
    rect(pen, -b, -b, 2 * b, 0.5, COLOURS.edge, 0.95);
    rect(pen, -b, b - 0.5, 2 * b, 0.5, COLOURS.edge, 0.95);
    rect(pen, -b, -b, 0.5, 2 * b, COLOURS.edge, 0.95);
    rect(pen, b - 0.5, -b, 0.5, 2 * b, COLOURS.edge, 0.95);

    /*
     * The nav light. 1.1 *pixels*, not 1.1 screen units — §2 is explicit that
     * these stay tiny and never glow, because a red or green light that blooms
     * would be a warm mark, and warm marks mean "from the receiver".
     */
    const on = (t + o.sp) % 2.2 < 0.22;
    const colour = on ? (o.sp > Math.PI ? COLOURS.navRed : COLOURS.navGreen) : COLOURS.navOff;
    const px = 1.1 * pen.perPixel;
    rect(pen, b - px, -b, px * 2, px * 2, colour, on ? 0.95 : 0.4);

    // The panel glint: a flash when a panel turns its face to the sun.
    const glint = Math.pow(Math.max(0, Math.sin(2 * pen.angle - sunAngle)), 40) * (0.4 + 0.6 * dawn);
    const save = pen.angle;
    pen.angle = 0;
    sparkle(pen, 0, 0, 2.2, glint);
    pen.angle = save;
    return;
  }

  if (o.type === "station") {
    pen.angle = -0.35 + (reducedMotion ? 0 : Math.sin(t * 0.03 + o.sp) * 0.06);
    blob(pen, 0, 0, 22, COLOURS.haloCraft, 0.07);
    rect(pen, -15, -0.55, 30, 1.1, COLOURS.truss, 0.9);
    for (const x of [-13, -8, 8, 13]) {
      for (const sy of [-1, 1] as const) {
        const y = sy < 0 ? -10 : 1.2;
        rect(pen, x - 1.2, y, 2.4, 8.8, COLOURS.panel, 0.95);
        rect(pen, x - 1.2, y, 2.4, 0.4, COLOURS.panelEdge, 0.8);
        rect(pen, x - 1.2, y + 8.4, 2.4, 0.4, COLOURS.panelEdge, 0.8);
      }
    }
    rect(pen, -4.5, -1.6, 9, 3.2, COLOURS.module, 0.95);
    rect(pen, -1.2, -4, 2.4, 8, COLOURS.module, 0.95);
    rect(pen, 2.5, 2.2, 3, 1.4, COLOURS.radiator, 0.8);

    const blink = (t + o.sp) % 3 < 0.2;
    if (blink) {
      const px = 1.1 * pen.perPixel;
      rect(pen, 15 - px, -px, px * 2, px * 2, COLOURS.navRed, 0.95);
    }
    const glint = Math.pow(Math.max(0, Math.sin(t * 0.21 + o.sp)), 60) * (0.5 + 0.5 * dawn);
    sparkle(pen, -6, -4, 3, glint);
    return;
  }

  if (o.type === "rock" && outline) {
    pen.angle = o.sp + (reducedMotion ? 0 : t * o.spin * 0.6);
    const radius = 2.2 + 2.8 * o.rs * o.rs;
    blob(pen, 0, 0, radius * 2.6, COLOURS.haloRock, 0.07);

    /*
     * The shading is per vertex rather than per face: how lit a point on the
     * rock is depends on where it sits across the sun's line, so the fan is
     * written by hand instead of going through `fill`.
     */
    const sx = Math.cos(sunAngle - pen.angle);
    const sy = Math.sin(sunAngle - pen.angle);
    const shade = (x: number, y: number): RGB => {
      const along = (x * sx + y * sy) / (radius || 1);
      const u = Math.min(1, Math.max(0, 0.5 - along * 0.5));
      const base =
        u < 0.45
          ? mixRGB(COLOURS.rockLit, COLOURS.rockMid, u / 0.45)
          : mixRGB(COLOURS.rockMid, COLOURS.rockDark, (u - 0.45) / 0.55);
      return [base[0] * lit, base[1] * lit, base[2] * lit];
    };

    for (let i = 1; i < outline.length - 1; i++) {
      for (const index of [0, i, i + 1]) {
        const [x, y] = outline[index];
        const [wx, wy, wz] = place(pen, x, y);
        vertex(write.solid, wx, wy, wz, shade(x, y), 0.96);
      }
    }

    sparkle(pen, 0, 0, 1.4, Math.pow(Math.max(0, Math.sin(t * 0.9 + o.sp * 3)), 80) * 0.7);
    return;
  }

  if (o.type === "moonlet") {
    const radius = 7;
    const sx = Math.cos(sunAngle);
    const sy = Math.sin(sunAngle);
    // A disc, shaded from the sun's side, as a fan of twenty.
    const steps = 20;
    const centreColour = mixRGB(COLOURS.moonLit, COLOURS.moonMid, 0.25);
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 1) / steps) * Math.PI * 2;
      const edge = (a: number): { xy: [number, number]; c: RGB } => {
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        const along = (x * sx + y * sy) / radius;
        const u = Math.min(1, Math.max(0, 0.5 - along * 0.5));
        const base =
          u < 0.55
            ? mixRGB(COLOURS.moonLit, COLOURS.moonMid, u / 0.55)
            : mixRGB(COLOURS.moonMid, COLOURS.moonDark, (u - 0.55) / 0.45);
        return { xy: [x, y], c: [base[0] * lit, base[1] * lit, base[2] * lit] };
      };
      const a = edge(a0);
      const b = edge(a1);
      const [cx, cy, cz] = place(pen, 0, 0);
      vertex(write.solid, cx, cy, cz, [
        centreColour[0] * lit,
        centreColour[1] * lit,
        centreColour[2] * lit,
      ], 0.98);
      for (const point of [a, b]) {
        const [x, y, z] = place(pen, point.xy[0], point.xy[1]);
        vertex(write.solid, x, y, z, point.c, 0.98);
      }
    }
    for (const [cx, cy, cr] of [
      [-2, -1.5, 1.4],
      [1.8, 2, 1],
      [2.5, -2.4, 0.8],
    ] as const) {
      const ring: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ring.push([cx + Math.cos(a) * cr, cy + Math.sin(a) * cr]);
      }
      fill(pen, ring, COLOURS.crater, 0.35);
    }
    blob(pen, 0, 0, radius * 2.2, [0.863, 0.863, 0.922], 0.08);
    return;
  }

}
