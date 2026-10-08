"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { hubCometAt, hubPose, hubProject, worldPerPixel } from "./framing";
import {
  comaFragmentShader,
  comaVertexShader,
  tailFragmentShader,
  tailVertexShader,
} from "./shaders/comet";
import {
  DISPLAY_FAR,
  DISPLAY_NEAR,
  SEGMENT_AHEAD,
  comaPixels,
  comaSize,
  displayOrbitPoint,
  displayedProgress,
  orbitPoint,
  tailPixels,
} from "@/lib/cometOrbit";
import { useDawn } from "./DawnProvider";

/**
 * A comet (spec v0.2 §11.2).
 *
 * The whole idea of v0.2's time capsule rests on this being a **real orbit**
 * rather than a progress bar with a picture on it. Kepler motion spends most
 * of the wait far out and faint, and then swings home fast in the last tenth:
 * so for months the comet is a speck you have to look for, and in the final
 * weeks it is visibly, unmistakably coming back. Nobody has to read a number
 * to feel that the day is near.
 *
 * Both tails point away from the **sun**, which is where real tails point and
 * which revision 7.1 §10 finally makes possible: before r7 there was no sun
 * in the scene to point away from, so they pointed away from the planet
 * instead. Now that the sun is coming up behind the limb, a tail aimed at the
 * planet would be visibly, specifically wrong — it is the one object in the
 * sky whose orientation a reader can check against the light.
 *
 * The ion tail is straight and narrow; the dust tail is wider and lags behind
 * along the orbit, because the dust is heavier.
 */

/**
 * The nucleus grows as it comes home — a little, and on purpose.
 *
 * A fixed-size nucleus is staged at a nearly fixed depth, so it is the same
 * number of pixels all year and contributes nothing to the countdown. Half as
 * big again at perihelion is enough for the approach to read as an approach
 * without the object changing character.
 */
const NUCLEUS_SCALE = (distance: number) =>
  1 + 0.5 * Math.max(0, (DISPLAY_FAR - distance) / (DISPLAY_FAR - DISPLAY_NEAR));

/** How far out a comet has to be before it starts pulsing to be found. */
const FAR_DISTANCE = 2.6;
const PULSE_PERIOD_S = 6;

const TAIL_SEGMENTS = 24;

/**
 * How far the comet is from the lens, asked rather than assumed.
 *
 * This was a constant — 3.4 — and it was wrong by a factor of four: `hubComet`
 * stages the comet at whatever depth the composition needs, which works out at
 * 14.1 units on a phone and 10.6 on a desktop. Everything sized "in pixels"
 * through it was therefore a quarter of the size it asked for, which is why
 * the minimum tail that was supposed to guarantee 24px was drawing 6.
 *
 * It is constant per viewport, so one sample answers it.
 */
function cometDepth(width: number, height: number): number {
  return hubPose(width, height).position[2] - hubCometAt(0.5, width, height)[2];
}

export type CometTone = "sender" | "receiver";

/** Points in the dotted lead. Enough that the marching reads as smooth. */
const LEAD_POINTS = 24;

const TONES: Record<CometTone, { nucleus: string; ion: string; dust: string }> = {
  // The sender's comet is ion-blue, like everything the card itself is made
  // of; the receiver's is warm, because it is theirs (principle 11).
  sender: { nucleus: "#c9f0ff", ion: "#7fd4f5", dust: "#e8e9eb" },
  receiver: { nucleus: "#ffeccc", ion: "#ffd8a0", dust: "#f3d7a4" },
};

type Props = {
  /** Raw progress 0..1 from the comet's dates. */
  progress: number;
  tone: CometTone;
  reducedMotion: boolean;
  /** Show the dotted orbit — only while this comet's panel is open (§11.2). */
  showOrbit?: boolean;
  onSelect?: () => void;
};

export function Comet({
  progress,
  tone,
  reducedMotion,
  showOrbit = false,
  onSelect,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const nucleus = useRef<THREE.Mesh>(null);
  const coma = useRef<THREE.Mesh>(null);
  const dust = useRef<THREE.Mesh>(null);

  const colours = TONES[tone];
  const size = useThree((state) => state.size);
  const { sun } = useDawn();

  const { position, distance, trueDistance } = useMemo(() => {
    const f = displayedProgress(progress);
    const point = displayOrbitPoint(f);
    return {
      position: new THREE.Vector3(...hubCometAt(f, size.width, size.height)),
      distance: point.distance,
      // The real orbital radius, which is what the tail's length is written
      // against: the displayed one is compressed so the comet stays in frame.
      trueDistance: orbitPoint(f).distance,
    };
  }, [progress, size.width, size.height]);

  /**
   * The short dotted segment ahead of it (rev 6 §4.1).
   *
   * The full ellipse belongs to the chart. Here a hint of where it is going is
   * enough — and it is what makes the comet read as *passing by* rather than
   * as a bright dot parked in the corner.
   */
  const leadPositions = useRef<Float32Array>(new Float32Array((LEAD_POINTS + 1) * 3));

  const orbitLine = useMemo(() => {
    const f = displayedProgress(progress);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= LEAD_POINTS; i++) {
      const ahead = Math.min(f + (SEGMENT_AHEAD * i) / LEAD_POINTS, 1);
      points.push(new THREE.Vector3(...hubCometAt(ahead, size.width, size.height)));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    leadPositions.current = geometry.getAttribute("position").array as Float32Array;
    const material = new THREE.LineDashedMaterial({
      color: colours.ion,
      dashSize: 0.06,
      gapSize: 0.18,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  }, [progress, size.width, size.height, colours.ion]);

  // Rebuilt whenever the progress changes — which the first-launch intro does
  // many times over — so the old one is released rather than left on the GPU.
  useEffect(
    () => () => {
      orbitLine.geometry.dispose();
      (orbitLine.material as THREE.Material).dispose();
    },
    [orbitLine],
  );

  /**
   * Away from the sun: where both tails point (r7 §10).
   *
   * Measured **on screen**, and it has to be. The sun is staged just outside
   * the planet's limb, about 2.7 units from the lens; the comet is staged
   * nine and a half units further back. Subtracting the two world positions
   * therefore gives a vector that is almost entirely depth — a tail pointing
   * straight into the screen, seen end-on, which is to say invisible. What
   * r7 means by "away from the sun" is what the reader sees, so the
   * direction is taken between the two as they land in the frame and then
   * laid in the image plane.
   */
  const away = useMemo(() => {
    const here = hubProject([position.x, position.y, position.z], size.width, size.height);
    const there = hubProject(sun, size.width, size.height);
    // Screen y is down; the world's y is up.
    const direction = new THREE.Vector3(here.x - there.x, -(here.y - there.y), 0);
    return direction.lengthSq() > 1e-9 ? direction.normalize() : new THREE.Vector3(0, 1, 0);
  }, [position, sun, size.width, size.height]);

  /*
   * The tail, in world units at the comet's own depth.
   *
   * Written in pixels and converted here, because the length is a statement
   * about the picture: forty pixels at aphelion, so a comet is never just a
   * star, growing to two hundred and twenty at the meeting point, so the last
   * weeks are unmistakable. The comet is staged at a nearly fixed depth, so
   * this is a constant per viewport and not something that drifts with it.
   */
  const tail = useMemo(() => {
    const depth = cometDepth(size.width, size.height);
    const pixels = tailPixels(trueDistance, size.width < size.height);
    return pixels * worldPerPixel(depth, size.height);
  }, [trueDistance, size.width, size.height]);
  /*
   * The head, in world units at the comet's depth (§14 step 0).
   *
   * `comaSize`'s floor made the head about as wide as §10's tail is long, so
   * the tail was drawn inside it and the comet read as a pale oval. The head
   * is now sized the way the tail is — from the same `near` — and stays about
   * a third of the tail's length at every point on the orbit.
   */
  const comaRadius = useMemo(() => {
    const depth = cometDepth(size.width, size.height);
    return (
      comaPixels(trueDistance, size.width < size.height) * worldPerPixel(depth, size.height)
    );
  }, [trueDistance, size.width, size.height]);

  const comaUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(colours.ion) },
      uCore: { value: new THREE.Color(colours.nucleus) },
      uSize: { value: comaRadius },
      uOpacity: { value: 1 },
    }),
    [colours.ion, colours.nucleus, comaRadius],
  );

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;

    // Far out, a slow pulse: without it a comet at aphelion is one dim pixel
    // among fifteen hundred stars and simply cannot be found.
    const pulse =
      reducedMotion || distance < FAR_DISTANCE
        ? 1
        : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((t / PULSE_PERIOD_S) * Math.PI * 2));

    if (nucleus.current) {
      const material = nucleus.current.material as THREE.Material & { opacity: number };
      material.opacity = pulse;
    }
    if (coma.current) {
      const material = coma.current.material as THREE.ShaderMaterial;
      material.uniforms.uSize.value = comaRadius;
      // Brighter as it comes home. Far out it is a speck you have to hunt for;
      // in the last weeks it should be the brightest thing in the corner.
      const near = THREE.MathUtils.clamp((DISPLAY_FAR - distance) / (DISPLAY_FAR - DISPLAY_NEAR), 0, 1);
      material.uniforms.uOpacity.value = (0.72 + 0.55 * near) * pulse;
    }

    // The dust tail flickers a little; the ion tail does not. Ion tails are
    // straight and steady in reality, and the contrast is what tells them apart.
    if (dust.current && !reducedMotion) {
      const material = dust.current.material as THREE.ShaderMaterial;
      material.uniforms.uOpacity.value = 0.3 + 0.08 * Math.sin(t * 1.7);
    }

    // The segment ahead is always drawn in the hub (§4.1); the chart raises it.
    const material = orbitLine.material as THREE.Material & { opacity: number };
    material.opacity = THREE.MathUtils.damp(material.opacity, showOrbit ? 0.9 : 0.7, 4, delta);

    /*
     * The dashes march along the path (rev 6, mockup M12a's `kDraw`).
     *
     * The comet's real motion is a date, so across a visit it does not move
     * at all — it was a lit speck parked in the corner with a dotted line
     * drawn beside it. `LineDashedMaterial` has no dash offset to animate, so
     * the phase is put into the geometry: the twenty-five points are laid out
     * from a start that creeps forward and wraps, which walks the dashes
     * toward the comet without the segment itself going anywhere.
     */
    if (!reducedMotion) {
      const f = displayedProgress(progress);
      const phase = (t * 0.06) % 1;
      const array = leadPositions.current;
      for (let i = 0; i <= LEAD_POINTS; i++) {
        const along = ((i + phase) / LEAD_POINTS) * SEGMENT_AHEAD;
        const [x, y, z] = hubCometAt(Math.min(f + along, 1), size.width, size.height);
        array[i * 3] = x;
        array[i * 3 + 1] = y;
        array[i * 3 + 2] = z;
      }
      const attribute = orbitLine.geometry.getAttribute("position");
      attribute.needsUpdate = true;
      orbitLine.computeLineDistances();
    }
  });

  return (
    <group ref={group}>
      <primitive object={orbitLine} />

      <group position={position}>
        {/* A 44px hit area whatever the nucleus is doing (§11.2). */}
        <mesh
          visible={false}
          onClick={onSelect ? (event) => (event.stopPropagation(), onSelect()) : undefined}
          onPointerOver={() => onSelect && (document.body.style.cursor = "pointer")}
          onPointerOut={() => onSelect && (document.body.style.cursor = "")}
        >
          {/* §11.2: 44px, whatever the head happens to be doing. */}
          <sphereGeometry args={[Math.max(comaSize(distance), 0.44), 8, 8]} />
        </mesh>

        <mesh ref={nucleus} scale={NUCLEUS_SCALE(distance)}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial
            color={colours.nucleus}
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>

        {/*
          The coma. A billboarded falloff rather than a sphere: a sphere of
          constant colour has a silhouette, and a silhouette is the one thing
          a cloud of gas does not have.
        */}
        <mesh ref={coma} frustumCulled={false}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            uniforms={comaUniforms}
            vertexShader={comaVertexShader}
            fragmentShader={comaFragmentShader}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {tail > 0 ? (
          <>
            {/* No ref: an ion tail is steady in reality, and the contrast
                with the flickering dust tail is what tells them apart. */}
            {/* Straight, narrow and a tenth longer than the dust (§10). */}
            <Tail
              direction={away}
              length={tail * 1.1}
              width={tail * 0.045}
              curve={0}
              color={colours.ion}
              opacity={0.6}
            />
            <Tail
              ref={dust}
              direction={away}
              length={tail}
              /*
               * Widening to 0.2 of its length (§10).
               *
               * Not 0.2/3.5 as the strip's own taper would suggest. The
               * fragment shader throws away the outer half of the strip with
               * `across²` — which is what stops the tails reading as two
               * ribbons of plastic — so the width that is actually *seen* is
               * about two fifths of the geometry's. 0.143 lands the visible
               * wedge on §10's fifth of the length.
               */
              width={tail * 0.143}
              // The dust lags behind along the orbit, so it curves; the ion
              // tail does not.
              curve={0.32}
              color={colours.dust}
              opacity={0.5}
            />
          </>
        ) : null}
      </group>
    </group>
  );
}

/**
 * One tail: a tapering strip pointing away from the planet, optionally curving
 * back along the orbit.
 */
function Tail({
  ref,
  direction,
  length,
  width,
  curve,
  color,
  opacity,
}: {
  ref?: React.RefObject<THREE.Mesh | null>;
  direction: THREE.Vector3;
  length: number;
  width: number;
  curve: number;
  color: string;
  opacity: number;
}) {
  /*
   * Only the spine is built here: where the tail runs, how wide it is at each
   * point, and which side of it each vertex is on. The widening itself happens
   * in the vertex shader, in view space, so the strip turns to face the camera
   * — a tail that can be caught edge-on is a tail that can disappear.
   */
  const geometry = useMemo(() => {
    const lag = new THREE.Vector3()
      .crossVectors(direction, new THREE.Vector3(0, 1, 0));
    if (lag.lengthSq() < 1e-8) lag.set(1, 0, 0);
    lag.normalize();

    const positions = new Float32Array((TAIL_SEGMENTS + 1) * 2 * 3);
    const ts = new Float32Array((TAIL_SEGMENTS + 1) * 2);
    const sides = new Float32Array((TAIL_SEGMENTS + 1) * 2);
    const halves = new Float32Array((TAIL_SEGMENTS + 1) * 2);
    const indices: number[] = [];

    for (let i = 0; i <= TAIL_SEGMENTS; i++) {
      const t = i / TAIL_SEGMENTS;
      const along = direction.clone().multiplyScalar(length * t);
      // The lag grows with the square of the distance travelled, which is what
      // a trailing cloud of dust actually does. This one is a real direction
      // in the world, so it stays on the CPU.
      along.addScaledVector(lag, curve * length * t * t);
      // Widening as it goes: the far end of a tail is not an edge.
      const half = width * (0.35 + t * 1.4);

      for (const side of [-1, 1]) {
        const v = i * 2 + (side === -1 ? 0 : 1);
        positions[v * 3] = along.x;
        positions[v * 3 + 1] = along.y;
        positions[v * 3 + 2] = along.z;
        ts[v] = t;
        sides[v] = side;
        halves[v] = half;
      }

      if (i < TAIL_SEGMENTS) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aT", new THREE.BufferAttribute(ts, 1));
    geo.setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
    geo.setAttribute("aHalf", new THREE.BufferAttribute(halves, 1));
    geo.setIndex(indices);
    return geo;
  }, [direction, length, width, curve]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uDirection: { value: direction.clone() },
    }),
    [color, opacity, direction],
  );

  return (
    <mesh ref={ref} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={tailVertexShader}
        fragmentShader={tailFragmentShader}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
