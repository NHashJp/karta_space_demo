"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  BIG,
  POOL,
  QUIET_AFTER_S,
  WIDTH,
  brightness,
  headAt,
  shootingStars,
  type ShootingStar,
} from "@/lib/shootingStars";
import { shootingStarFragmentShader, shootingStarVertexShader } from "./shaders/shootingStar";
import { FOV } from "./framing";

/**
 * Shooting stars, far out in the sky, every fourteen seconds or so.
 *
 * The timetable and every path are in `lib/shootingStars.ts`; this places
 * them. Paths are in frame units — half-heights, with x running to the
 * aspect — and this is where they become world positions, using the camera's
 * own frustum at the star's depth. That is the whole reason they are in frame
 * units: it means one set of numbers looks right in portrait and in
 * landscape, instead of a path tuned on a laptop that misses a phone screen
 * entirely.
 *
 * **Everything happens in camera space**, which buys two things at once. The
 * star keeps its place in the frame as the camera drifts, the way something
 * forty units away should; and a quad lying in the camera's x-y plane already
 * faces the lens, so it needs a roll about the view axis and nothing else.
 */

/** Enough for a long sitting; nobody reaches the end. */
const SCHEDULE = 600;

const COOL = new THREE.Color("#dceaff");
const WARM = new THREE.Color("#ffe8c4");
const HEAD = new THREE.Color("#ffffff");

const TAN_HALF_FOV = Math.tan(((FOV * Math.PI) / 180) / 2);
/** The quad is built +Y leading, so this is the axis the roll is about. */
const FORWARD = new THREE.Vector3(0, 0, 1);
/** Reused, so a star crossing the sky allocates nothing per frame. */
const spin = new THREE.Quaternion();

export function ShootingStars({
  seed,
  reducedMotion,
  /**
   * The returned day's meteor shower is playing. While it is, the sky holds
   * still — five slow warm streaks *once* is the whole point of that day, and
   * an ordinary shooting star crossing it would make it look like weather.
   */
  showering = false,
  meanGap,
}: {
  seed: number;
  reducedMotion: boolean;
  showering?: boolean;
  /** Seconds between stars on average; the ordinary sky's if not given. */
  meanGap?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const started = useRef<number | null>(null);
  const flying = useRef<(ShootingStar | null)[]>(Array.from({ length: POOL }, () => null));
  const cursor = useRef(0);

  const aspect = useThree((state) => state.viewport.aspect);

  /*
   * Rebuilt when the frame changes shape, because the paths are expressed in
   * terms of that shape. A rotation restarts the sky, which is the right
   * trade: the alternative is paths that were aimed at a frame that no longer
   * exists.
   */
  const schedule = useMemo(
    () => shootingStars(seed, SCHEDULE, aspect, meanGap),
    [seed, aspect, meanGap],
  );

  /*
   * When the hold ends. Set on the first frame the shower is seen, rather
   * than being baked into the timetable — the shower starts when the
   * satellite reaches orbit, which may be minutes after the card was opened,
   * so a delay measured from the start of the session protects nothing.
   */
  const holdUntil = useRef(-1);

  const uniforms = useMemo(
    () =>
      Array.from({ length: POOL }, () => ({
        uHead: { value: HEAD.clone() },
        uTail: { value: COOL.clone() },
        uOpacity: { value: 0 },
        uGlow: { value: 1 },
      })),
    [],
  );

  useFrame(({ clock, camera }) => {
    const parent = group.current;
    if (!parent) return;
    if (started.current === null) started.current = clock.elapsedTime;
    const now = clock.elapsedTime - started.current;

    if (showering && holdUntil.current < 0) holdUntil.current = now + QUIET_AFTER_S;
    const holding = now < holdUntil.current;

    for (let slot = 0; slot < POOL; slot++) {
      const star = flying.current[slot];
      if (star && now > star.startAt + star.duration) flying.current[slot] = null;
    }

    while (cursor.current < schedule.length && schedule[cursor.current].startAt <= now) {
      const star = schedule[cursor.current];
      cursor.current++;
      // Due while the shower has the sky: let it go by rather than queue it.
      if (holding) continue;
      /*
       * Already over. A backgrounded tab stops the clock, and the first frame
       * back carries the whole gap at once — which can step over a flight
       * that lasts a second. Dropping it is right: a shooting star starting
       * halfway across is a line appearing in the middle of the sky.
       */
      if (now > star.startAt + star.duration) continue;

      const free = flying.current.indexOf(null);
      if (free === -1) continue;
      flying.current[free] = star;
      uniforms[free].uTail.value.copy(COOL).lerp(WARM, star.tint);
    }

    for (let slot = 0; slot < POOL; slot++) {
      const star = flying.current[slot];
      const mesh = parent.children[slot] as THREE.Mesh;
      const shader = uniforms[slot];
      if (!star) {
        mesh.visible = false;
        shader.uOpacity.value = 0;
        continue;
      }

      const local = now - star.startAt;
      const progress = local / star.duration;
      const glow = brightness(progress);
      if (glow <= 0.001) {
        mesh.visible = false;
        shader.uOpacity.value = 0;
        continue;
      }

      // Frame units to world units, at this star's depth.
      const halfHeight = TAN_HALF_FOV * star.depth;
      const [fx, fy] = headAt(star, local);
      const length = star.length * halfHeight;

      /*
       * The quad is centred on itself, so it is placed half a streak behind
       * the head — the head is the thing that is *at* the computed position,
       * and the tail is what it has already flown through.
       */
      const x = (fx - (star.direction[0] * star.length) / 2) * halfHeight;
      const y = (fy - (star.direction[1] * star.length) / 2) * halfHeight;

      mesh.visible = true;
      /*
       * World, not local. The position goes through `matrixWorld`, so the
       * orientation has to come from the same place or the two disagree the
       * moment the camera is ever parented to anything. Updated first,
       * because the rig moves the camera in its own frame callback and a
       * stale matrix shows up as the sky lagging a frame behind on the trail.
       */
      camera.updateMatrixWorld();
      mesh.position.set(x, y, -star.depth).applyMatrix4(camera.matrixWorld);
      mesh.scale.set(WIDTH * halfHeight * (star.big ? BIG.width : 1), length, 1);

      // Face the lens, then roll so +Y runs along the flight.
      const roll = Math.atan2(star.direction[1], star.direction[0]) - Math.PI / 2;
      camera.getWorldQuaternion(mesh.quaternion);
      mesh.quaternion.multiply(spin.setFromAxisAngle(FORWARD, roll));

      shader.uOpacity.value = glow;
      shader.uGlow.value = star.big ? BIG.glow : 1;
    }
  });

  /*
   * Reduced motion gets none, for the same reason the meteor shower does not
   * appear: a streak across the sky is the one thing here with no still
   * equivalent, and nothing in the card depends on having seen one.
   */
  if (reducedMotion) return null;

  return (
    <group ref={group}>
      {Array.from({ length: POOL }, (_, slot) => (
        <mesh key={slot} visible={false} frustumCulled={false} renderOrder={-4}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            uniforms={uniforms[slot]}
            vertexShader={shootingStarVertexShader}
            fragmentShader={shootingStarFragmentShader}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
