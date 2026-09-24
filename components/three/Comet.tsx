"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FOV, hubComet, hubPlanet } from "./framing";
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
  displayOrbitPoint,
  displayedProgress,
  tailLength,
} from "@/lib/cometOrbit";

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
 * Both tails point away from the planet, as real tails point away from the
 * sun. The ion tail is straight and narrow; the dust tail is wider and lags
 * behind along the orbit, because the dust is heavier.
 */

/** How far out a comet has to be before it starts pulsing to be found. */
const FAR_DISTANCE = 2.6;
const PULSE_PERIOD_S = 6;

const TAIL_SEGMENTS = 24;

/** How far behind the satellite the comet is staged, for the pixel maths. */
const COMET_VIEW_DEPTH = 3.4;

/** 0 when the comet is home, 1 when it is as far away as it goes. */
function reach(f: number): number {
  return (displayOrbitPoint(f).distance - DISPLAY_NEAR) / (DISPLAY_FAR - DISPLAY_NEAR);
}

/** The shortest tail worth drawing, in world units at the comet's depth. */
function minimumTail(width: number, height: number): number {
  const pixels = width < height ? 24 : 36;
  const tanH = Math.tan(Math.atan(Math.tan((FOV * Math.PI) / 360) * (width / height)));
  // Width in world units at that depth, times the fraction of it we want.
  return (pixels / width) * 2 * tanH * COMET_VIEW_DEPTH;
}

export type CometTone = "sender" | "receiver";

const TONES: Record<CometTone, { nucleus: string; ion: string; dust: string }> = {
  // The sender's comet is ion-blue, like everything the card itself is made
  // of; the receiver's is warm, because it is theirs (principle 11).
  sender: { nucleus: "#c9f0ff", ion: "#7fd4f5", dust: "#e8e9eb" },
  receiver: { nucleus: "#ffeccc", ion: "#ffd8a0", dust: "#f3d7a4" },
};

type Props = {
  /** Raw progress 0..1 from the comet's dates. */
  progress: number;
  slug: string;
  releasedOn: string;
  tone: CometTone;
  reducedMotion: boolean;
  /** Show the dotted orbit — only while this comet's panel is open (§11.2). */
  showOrbit?: boolean;
  onSelect?: () => void;
};

export function Comet({
  progress,
  slug,
  releasedOn,
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

  const { position, distance } = useMemo(() => {
    const f = displayedProgress(progress);
    const point = displayOrbitPoint(f);
    return {
      position: new THREE.Vector3(...hubComet(reach(f), size.width, size.height)),
      distance: point.distance,
    };
  }, [progress, size.width, size.height]);

  /**
   * The short dotted segment ahead of it (rev 6 §4.1).
   *
   * The full ellipse belongs to the chart. Here a hint of where it is going is
   * enough — and it is what makes the comet read as *passing by* rather than
   * as a bright dot parked in the corner.
   */
  const orbitLine = useMemo(() => {
    const f = displayedProgress(progress);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const ahead = Math.min(f + (SEGMENT_AHEAD * i) / 24, 1);
      points.push(new THREE.Vector3(...hubComet(reach(ahead), size.width, size.height)));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
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

  /** Away from the planet: where both tails point. */
  const away = useMemo(() => {
    const direction = position
      .clone()
      .sub(new THREE.Vector3(...hubPlanet(size.width, size.height)));
    return direction.lengthSq() > 1e-9 ? direction.normalize() : new THREE.Vector3(0, 1, 0);
  }, [position, size.width, size.height]);

  /*
   * A minimum on-screen tail (rev 6 §5). Far out, the distance formula gives
   * almost nothing, and a comet without a tail is just a star — the tail is
   * how you know which of the lights up there is the one coming back.
   */
  const tail = Math.max(tailLength(distance), minimumTail(size.width, size.height));
  // Bigger than the nucleus by enough to be findable at orbit distance.
  const comaRadius = THREE.MathUtils.clamp(0.9 / distance, 0.26, 0.85);

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
      material.uniforms.uOpacity.value = (0.5 + 0.6 * near) * pulse;
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
          <sphereGeometry args={[Math.max(comaRadius * 2, 0.8), 8, 8]} />
        </mesh>

        <mesh ref={nucleus}>
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
            <Tail
              direction={away}
              length={tail}
              width={0.09}
              curve={0}
              color={colours.ion}
              opacity={0.42}
            />
            <Tail
              ref={dust}
              direction={away}
              length={tail * 0.8}
              width={0.26}
              // The dust lags behind along the orbit, so it curves; the ion
              // tail does not.
              curve={0.35}
              color={colours.dust}
              opacity={0.3}
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
