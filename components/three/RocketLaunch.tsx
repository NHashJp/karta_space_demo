"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PLANET_CENTRE, PLANET_RADIUS, orbitPosition, replyStarAt } from "./framing";
import { LAUNCH_MS, REDUCED_MS } from "@/lib/timing";

/**
 * The reply, on its way (spec v0.2 §10.3).
 *
 * A point of light lifts off the planet's limb, rises on an arc to the orbit
 * ring, **pauses beside the satellite for a moment** and then goes on out
 * along the comet's path, overtaking it, and settles as a star just beyond it
 * (spec §10.3; mockups M8b, M8c).
 *
 * That pause is the whole animation. Without it this is a thing being fired
 * into space; with it, the reply visibly *meets* the letter that prompted it
 * before going on its way. There is no shake, no flash and no particle burst —
 * the message has already arrived by the time this plays, and the animation's
 * only job is to say so gently.
 *
 * **Where it goes matters as much as the pause.** The card offers two ways to
 * send something and the only difference between them is speed, so the rocket
 * has to be seen going the same way as the comet and getting there first. It
 * used to settle up and to the right of the planet on a heading of its own —
 * 9 units from the comet, and 2 units *towards* the camera, so it read as
 * coming at the reader rather than leaving. Now it is aimed at the comet and
 * carries on past it, which sends it into the depth of the scene, because
 * that is where the comet is.
 */

/** Where in the timeline the meeting happens, and how long it lasts. */
const MEET_AT = 0.62;
const MEET_UNTIL = 0.74;

const TRAIL_POINTS = 28;

type Props = {
  /**
   * Today's progress along the comet's orbit — the same number the comet
   * itself is drawn from, so the rocket is aimed where the comet is.
   */
  cometProgress: number;
  reducedMotion: boolean;
  onDone: () => void;
};

export function RocketLaunch({ cometProgress, reducedMotion, onDone }: Props) {
  const size = useThree((state) => state.size);
  const spark = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const startedAt = useRef<number | null>(null);
  const finished = useRef(false);

  /** Built once, here, rather than as JSX: `<line>` is also SVG's tag. */
  const trail = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    );
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: "#7fd4f5",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
  }, []);

  /** Lift-off point, the satellite's meeting point, and where the star settles. */
  const path = useMemo(() => {
    const planet = new THREE.Vector3(...PLANET_CENTRE);
    // The planet's visible limb, up and slightly right of its centre.
    const from = planet
      .clone()
      .add(new THREE.Vector3(0.55, 0.83, 0.1).normalize().multiplyScalar(PLANET_RADIUS));
    const meet = new THREE.Vector3(...orbitPosition(0.9));

    /*
     * Past the comet, on the comet's own heading: it overtakes rather than
     * catches up, so it ends slightly beyond it (M8c). `replyStarAt` is where
     * the star will sit afterwards, so the arc cannot end anywhere else.
     */
    const to = new THREE.Vector3(...replyStarAt(cometProgress, size.width, size.height));

    return { from, meet, to };
  }, [cometProgress, size.width, size.height]);

  useFrame(({ clock }, delta) => {
    if (finished.current) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;

    const duration = (reducedMotion ? REDUCED_MS : LAUNCH_MS) / 1000;
    const t = Math.min((clock.elapsedTime - startedAt.current) / duration, 1);

    const position = at(path, t);

    if (spark.current) {
      spark.current.position.copy(position);
      const material = spark.current.material as THREE.Material & { opacity: number };
      // Brightest during the meeting, then fading as it settles.
      material.opacity = t < MEET_AT ? 0.7 + t * 0.5 : 1 - Math.max(0, t - MEET_UNTIL) * 0.55;
    }

    // A local light, so the satellite is genuinely lit as the reply passes it
    // (§23.3) rather than the two simply overlapping on screen.
    if (glow.current) {
      glow.current.position.copy(position);
      glow.current.intensity =
        t > MEET_AT && t < MEET_UNTIL ? 2.4 : Math.max(0, 1.2 - Math.abs(t - MEET_AT) * 6);
    }

    // A short exhaust ribbon behind it, which simply stops existing once the
    // spark has become a star: a star does not have a wake.
    {
      const attribute = trail.geometry.getAttribute("position");
      const array = attribute.array as Float32Array;
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const back = at(path, Math.max(0, t - (i / TRAIL_POINTS) * 0.16));
        array[i * 3] = back.x;
        array[i * 3 + 1] = back.y;
        array[i * 3 + 2] = back.z;
      }
      attribute.needsUpdate = true;
      const material = trail.material as THREE.Material & { opacity: number };
      material.opacity = THREE.MathUtils.damp(material.opacity, t > 0.85 ? 0 : 0.4, 5, delta);
    }

    if (t >= 1) {
      finished.current = true;
      onDone();
    }
  });

  return (
    <group>
      <primitive object={trail} />

      <mesh ref={spark}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial
          color="#e8f6ff"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <pointLight ref={glow} intensity={0} distance={3} color="#9fd8ff" />
    </group>
  );
}

/**
 * Where the spark is at `t`.
 *
 * Three legs rather than one curve: rising to the meeting, *holding* there,
 * then drifting out. The hold is why this is not a single interpolation.
 */
function at(
  path: { from: THREE.Vector3; meet: THREE.Vector3; to: THREE.Vector3 },
  t: number,
): THREE.Vector3 {
  if (t <= MEET_AT) {
    const local = ease(t / MEET_AT);
    // A gentle arc rather than a straight line: bulged out from the planet, so
    // it reads as something climbing out of a gravity well.
    const mid = path.from
      .clone()
      .lerp(path.meet, 0.5)
      .add(new THREE.Vector3(-0.8, 0.5, 0.4));
    return quadratic(path.from, mid, path.meet, local);
  }
  if (t <= MEET_UNTIL) return path.meet.clone();

  const local = ease((t - MEET_UNTIL) / (1 - MEET_UNTIL));
  return path.meet.clone().lerp(path.to, local);
}

function quadratic(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number) {
  return a
    .clone()
    .multiplyScalar((1 - t) * (1 - t))
    .addScaledVector(b, 2 * (1 - t) * t)
    .addScaledVector(c, t * t);
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
