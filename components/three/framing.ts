/** Camera framing maths, kept out of the component so it can be checked. */
import {
  DISPLAY_FAR,
  DISPLAY_NEAR,
  displayOrbitPoint,
  displayedProgress,
} from "../../lib/cometOrbit.ts";
import { DEPLOYED_SPAN, hullPoints } from "../../lib/satelliteGeometry.ts";
import { trailControlPoints, trailPoint, trailTangent } from "../../lib/trailCurve.ts";
import { SAT_SCALE, displayDirection } from "../../lib/deployment.ts";

export const FOV = 45;

/** How far behind the reading position the camera waits before/after the card. */
export const ZOOM_DISTANCE = 10;

/** Dolly durations, in ms. */
export const ZOOM_IN_MS = 1400;
export const ZOOM_OUT_MS = 1000;
export const ZOOM_REDUCED_MS = 300;
/** Slower than the others: passing through a wall should feel deliberate. */
export const ZOOM_INSIDE_MS = 1600;

/**
 * Where the camera sits when it goes inside the cube. Far enough off-centre to
 * have a look direction at all, close enough to the front wall that the far
 * wall — and the line written on it — is comfortably in frame.
 */
export const INSIDE_DISTANCE = 0.62;
/** The secret line hangs just inside the far wall. */
export const SECRET_PLANE_Z = -0.94;

/* ---------------------------------------------------------------------------
 * The orbit composition (spec v0.2 §8.3)
 * ------------------------------------------------------------------------- */

/*
 * The orbit hub's composition (spec v0.2 rev 6, §3.1) — the sender's sketch.
 *
 * The planet is a small arc in the bottom-right corner. The satellite is large
 * and centred, on a diagonal. The trail comes in at the top-left and the comet
 * passes by at the top-right.
 *
 * The world itself is unchanged: the planet is where it is and the satellite
 * is on its orbit. What `hubPose` does is *place the camera* so that those
 * things land where the sketch puts them on screen — which is why the targets
 * below are fractions of the viewport rather than world coordinates.
 */

/** 「あなたの星」, mostly off the bottom-right corner. */
export const PLANET_RADIUS = 2.2;
export const PLANET_CENTRE: Vec3 = [3.5, -3.9, -2.2];

/** The satellite's orbit around it. Drawn only in the chart (rev 6, R20). */
export const ORBIT_CENTRE: Vec3 = PLANET_CENTRE;
export const ORBIT_SEMI_MAJOR = 4.4;
export const ORBIT_SEMI_MINOR = 3.35;
export const ORBIT_TILT = (34 * Math.PI) / 180;

/**
 * Where the satellite sits in the hub, in world space.
 *
 * In revision 6 it does **not** travel round the ring on screen: it holds this
 * place and keeps station (§3.2). The orbit is still real — the chart shows it
 * — but the hub is a view from alongside, not from a fixed point in space, so
 * the satellite stays put and the sky turns behind it.
 */
export const HUB_SATELLITE: Vec3 = [0, 0, 0];

/** The satellite's display attitude: the wing axis at −50° on screen. */
export const WING_AXIS_DEG = -50;

/**
 * What the orbit camera looks at. Not the planet's centre but a point above
 * it, which is what puts the planet low in the frame and leaves the sky — the
 * satellite, the comets, the trail — the upper two-thirds it needs.
 */
/** The camera looks a little above the planet, so it sits low in the frame. */
export const ORBIT_TARGET: Vec3 = [1.1, -1.0, -1.3];

/**
 * Margin beyond the composition. §17 requires 8%; designing to 12% leaves the
 * check somewhere to fail from if the numbers are ever tuned.
 */
const ORBIT_MARGIN = 1.12;

export type Vec3 = [number, number, number];
export type Pose = { position: Vec3; lookAt: Vec3 };

/** A point on the satellite's ellipse at orbit phase `theta` (radians). */
export function orbitPosition(theta: number): Vec3 {
  const x = ORBIT_SEMI_MAJOR * Math.cos(theta);
  const flat = ORBIT_SEMI_MINOR * Math.sin(theta);
  return [
    ORBIT_CENTRE[0] + x,
    ORBIT_CENTRE[1] + flat * Math.cos(ORBIT_TILT),
    ORBIT_CENTRE[2] + flat * Math.sin(ORBIT_TILT),
  ];
}

/**
 * How close the cube's orbit ever comes to the planet's surface.
 *
 * Checked rather than eyeballed: the two used to share a centre, and the
 * result was a satellite that crossed the planet's disc. A positive clearance
 * here is what guarantees it cannot happen again.
 */
export function orbitClearance(): number {
  let closest = Infinity;
  for (let i = 0; i < 720; i++) {
    const [x, y, z] = orbitPosition((i * Math.PI) / 360);
    closest = Math.min(
      closest,
      Math.hypot(x - PLANET_CENTRE[0], y - PLANET_CENTRE[1], z - PLANET_CENTRE[2]),
    );
  }
  return closest - PLANET_RADIUS;
}

/**
 * The half-extents, around `ORBIT_TARGET`, that the orbit view must contain:
 * the whole ellipse, and as much of the planet as is above the frame's floor.
 */
/**
 * What the orbit view has to hold: **the cube's whole ellipse**, and nothing
 * else.
 *
 * The planet is deliberately not in here. Framing it as well pushed the camera
 * from 15 units back to 41 on a phone, which made the cube — the subject — a
 * speck. Instead the planet is placed so that this frame crops it: its upper-
 * left arc rises into the lower-right corner, which is where it was asked to
 * be and how a planet you are near actually looks.
 */
/**
 * What the hub frame has to hold: the satellite's whole deployed hull.
 *
 * The planet is deliberately not in here. It is scenery, and cropping it into
 * the corner is the composition — framing it as well would push the camera
 * back until the subject was a speck, which is what revision 5 did.
 */
export function orbitSamples(): Vec3[] {
  return satelliteHull().map(([x, y, z]) => [
    HUB_SATELLITE[0] + x,
    HUB_SATELLITE[1] + y,
    HUB_SATELLITE[2] + z,
  ]);
}

/**
 * The deployed satellite's hull, at satellite scale, in its display attitude.
 *
 * It applies `displayDirection` — the same three angles `MessageCube` turns
 * the cube by — rather than an angle of its own. An earlier version rotated
 * about Y by −50°, which left the wings horizontal on screen while every check
 * happily reported them at −50°, because the checks were measuring a construct
 * instead of this.
 */
export function satelliteHull(): Vec3[] {
  return hullPoints(1, 1).map((point) => {
    const [x, y, z] = displayDirection(point);
    return [x * SAT_SCALE, y * SAT_SCALE, z * SAT_SCALE] as Vec3;
  });
}

/**
 * Where the camera sits in the orbit view, for this viewport.
 *
 * Same idea as `cameraDistance`: portrait is governed by width and landscape
 * by height, and the distance is whichever of the two is further. A phone's
 * 0.46 aspect ratio makes width the binding constraint by a long way, which is
 * why the orbit view sits further back on a phone than it looks like it should.
 */
/* ---------------------------------------------------------------------------
 * The hub, staged from its screen targets (rev 6 §3.1)
 * ------------------------------------------------------------------------- */

/** Tip to tip, in world units, at satellite scale. */
const SPAN_WORLD = DEPLOYED_SPAN * SAT_SCALE;

type HubTargets = {
  /** Body centre, as fractions of the viewport from the left and the top. */
  centre: [number, number];
  /** Tip to tip along the wing axis, as a fraction of the width. */
  tip: number;
  planet: { centre: [number, number]; radius: number };
};

/**
 * §3.1's two reference columns. Portrait and landscape are genuinely different
 * compositions rather than one scaled: on a phone the satellite fills four
 * fifths of the width, on a desktop barely a third.
 */
const PORTRAIT: HubTargets = {
  centre: [0.44, 0.55],
  tip: 0.81,
  planet: { centre: [1.21, 1.22], radius: 1.07 },
};
const LANDSCAPE: HubTargets = {
  centre: [0.47, 0.5],
  tip: 0.36,
  planet: { centre: [1.11, 1.44], radius: 0.55 },
};

export function hubTargets(aspect: number): HubTargets {
  return aspect < 1 ? PORTRAIT : LANDSCAPE;
}

/**
 * How much of the width the satellite's label covers — the area you hover to
 * be offered the way into the cube.
 *
 * Half of tip to tip, not all of it. The wings are most of the satellite's
 * span and almost none of what anyone points at; what you aim for is the
 * body, which is between a fifth and a third of the span depending on how the
 * cube is turned. Half covers the body and the inner booms with room to spare.
 *
 * The *reason* it is capped is the comet. The label's box has to take pointer
 * events to be hovered at all, which means it also swallows clicks inside it,
 * and the comet — the one thing in the scene that is clickable, and the thing
 * 「星をタップしてみてください」 is asking the reader to tap — is drawn along a
 * composition path that passes close to the satellite at some aspect ratios.
 * At the full span the two overlap outright on a tablet. Verify checks the
 * clearance across five viewports and the comet's whole orbit.
 */
export const LABEL_SHARE = 0.5;

/** Where the satellite's label sits, and how big it is, as viewport fractions. */
export function hubLabel(aspect: number): { centre: [number, number]; span: number } {
  const target = hubTargets(aspect);
  return { centre: target.centre, span: target.tip * LABEL_SHARE };
}

/**
 * The half-angles as *tangents*, which is what projection arithmetic wants.
 * (The `halfAngles` further down returns radians, for a different job.)
 */
function hubHalfTangents(aspect: number) {
  const halfV = Math.tan(((FOV * Math.PI) / 180) / 2);
  return { halfV, halfH: Math.tan(Math.atan(halfV * aspect)) };
}

/**
 * Where the camera stands in the hub.
 *
 * Solved from the composition rather than chosen: the distance is whatever
 * makes the satellite's tip-to-tip the target fraction of the width, and the
 * offset is whatever puts its body centre on the target point. Revision 5's
 * `orbitPose` framed an *orbit*; the hub no longer shows one (R20), so what it
 * frames now is the satellite itself.
 */
export function hubPose(width: number, height: number): Pose {
  const aspect = width / height;
  const { halfV, halfH } = hubHalfTangents(aspect);
  const target = hubTargets(aspect);

  const distance = hubDistance(aspect);
  const x = HUB_SATELLITE[0] + (0.5 - target.centre[0]) * 2 * halfH * distance;
  const y = HUB_SATELLITE[1] + (target.centre[1] - 0.5) * 2 * halfV * distance;

  return {
    position: [x, y, HUB_SATELLITE[2] + distance],
    lookAt: [x, y, HUB_SATELLITE[2]],
  };
}

/**
 * How far back the camera has to stand for the wings to span `target.tip` of
 * the width, measured the way a reader sees it.
 *
 * Solved rather than divided, because the wing axis does not lie in the image
 * plane: the display attitude turns it back into the screen as well as across
 * it, so the far tip is further away than the near one and the span on screen
 * is about 84% of the span in the world. Dividing by the world span — which is
 * what this used to do — put the camera too far back and drew the satellite a
 * tenth of the frame too small, and the check agreed with it, because the check
 * was making the same flat assumption.
 *
 * Four passes is plenty: the span goes as 1/distance, so each lands within a
 * fraction of a per cent of the one before.
 */
function hubDistance(aspect: number): number {
  const { halfV, halfH } = hubHalfTangents(aspect);
  const target = hubTargets(aspect);
  const half = (DEPLOYED_SPAN / 2) * SAT_SCALE;

  const tips = ([1, -1] as const).map((side) => {
    const [dx, dy, dz] = displayDirection([side, 0, 0]);
    return [
      HUB_SATELLITE[0] + dx * half,
      HUB_SATELLITE[1] + dy * half,
      HUB_SATELLITE[2] + dz * half,
    ] as Vec3;
  });

  let distance = SPAN_WORLD / 2 / (target.tip * halfH);

  for (let pass = 0; pass < 4; pass++) {
    const camera: Vec3 = [
      HUB_SATELLITE[0] + (0.5 - target.centre[0]) * 2 * halfH * distance,
      HUB_SATELLITE[1] + (target.centre[1] - 0.5) * 2 * halfV * distance,
      HUB_SATELLITE[2] + distance,
    ];

    const screen = tips.map((tip) => {
      const depth = camera[2] - tip[2];
      return [
        (tip[0] - camera[0]) / (2 * halfH * depth),
        -(tip[1] - camera[1]) / (2 * halfV * depth),
      ];
    });

    // In width units, so the two orientations are measured the same way.
    const span = Math.hypot(
      screen[0][0] - screen[1][0],
      (screen[0][1] - screen[1][1]) / aspect,
    );
    distance *= span / target.tip;
  }

  return distance;
}

/**
 * Where the planet stands **in the hub**.
 *
 * This is a staged position, and that deserves saying plainly. §3.1 fixes the
 * planet's radius at 2.2 world units *and* asks it to fill a given fraction of
 * the screen in both portrait and landscape — and those two demands cannot both
 * be met by one fixed world position, because the camera distance is already
 * spoken for by the satellite. A planet that satisfied the phone would swallow
 * the desktop.
 *
 * Revision 6 makes that affordable: in the hub the satellite no longer travels
 * a visible orbit (R20), so nothing on screen depends on the two being a fixed
 * distance apart. The orbit is still real and still drawn — in the chart, which
 * uses the true placement. The hub is a view from alongside, composed.
 */
export function hubPlanet(width: number, height: number): Vec3 {
  const aspect = width / height;
  const { halfV, halfH } = hubHalfTangents(aspect);
  const target = hubTargets(aspect);
  const camera = hubPose(width, height).position;

  // Close enough that its limb reads as the target fraction of the width.
  const depth = PLANET_RADIUS / (2 * halfH * target.planet.radius);

  return [
    camera[0] + (target.planet.centre[0] - 0.5) * 2 * halfH * depth,
    camera[1] - (target.planet.centre[1] - 0.5) * 2 * halfV * depth,
    camera[2] - depth,
  ];
}

/* ---------------------------------------------------------------------------
 * The comet, staged in the hub (rev 6 §4.1)
 * ------------------------------------------------------------------------- */

/**
 * Where the comet's path runs on screen: perihelion beside the planet at the
 * bottom-right, aphelion up in the top-right, bowing outward in between.
 */
const COMET_NEAR_SCREEN: [number, number] = [0.9, 0.66];
/**
 * The far end sits where §3.1 puts the sample comet, around (0.82, 0.22): the
 * sample is already most of the way out, so "as far as it goes" is barely
 * beyond where it is today.
 */
const COMET_FAR_SCREEN: [number, number] = [0.81, 0.19];
/** Pushed right of the straight line, so the path reads as an arc. */
const COMET_BOW = 0.07;

/** How far behind the satellite the comet is staged. */
const COMET_DEPTH = 3.4;

/**
 * Where the comet is drawn in the hub, for a radius already compressed by
 * `displayRadius` (0 = home, 1 = as far as it goes).
 *
 * Staged in screen space, like the planet, and for the same reason: the hub is
 * a composition. What has to survive is the *reading* — the comet passes by in
 * the top-right, well clear of the satellite, and comes home beside the planet
 * — and screen space is where those words mean something.
 */
/**
 * Where the comet actually is on screen, for a given day.
 *
 * The one place that answers this. `hubComet` maps a *reach* 0..1 along the
 * composition's bow; turning a date into that reach needs `displayOrbitPoint`
 * as well, and every component that wants to point at the comet needs both.
 *
 * It exists because three of them did the sum separately and two got it
 * wrong: the reply rocket flew off to its own corner of the sky, and the
 * capsule carrying the receiver's words ran up the comet's *true* ellipse —
 * which is not where the comet is drawn — and stopped 7.6 units short of it.
 * Anything aimed at the comet aims with this.
 */
export function cometReach(f: number): number {
  return (displayOrbitPoint(f).distance - DISPLAY_NEAR) / (DISPLAY_FAR - DISPLAY_NEAR);
}

export function cometAt(progress: number, width: number, height: number): Vec3 {
  return hubComet(cometReach(displayedProgress(progress)), width, height);
}

/** How far past the comet the reply settles, in world units (mockup M8c). */
export const REPLY_OVERTAKE = 1.8;

/**
 * Where the reply ends up: just beyond the comet, on the comet's own heading.
 *
 * Shared by the rocket that flies there and the star that stays behind, which
 * had the arc's end formula written out twice — so moving one moved the
 * rocket and left the star in the old place.
 */
export function replyStarAt(
  cometProgress: number,
  width: number,
  height: number,
): Vec3 {
  const comet = cometAt(cometProgress, width, height);
  const meet = orbitPosition(0.9);
  const heading: Vec3 = [comet[0] - meet[0], comet[1] - meet[1], comet[2] - meet[2]];
  const length = Math.hypot(...heading) || 1;
  return [
    comet[0] + (heading[0] / length) * REPLY_OVERTAKE,
    comet[1] + (heading[1] / length) * REPLY_OVERTAKE,
    comet[2] + (heading[2] / length) * REPLY_OVERTAKE,
  ];
}

export function hubComet(u: number, width: number, height: number): Vec3 {
  const aspect = width / height;
  const { halfV, halfH } = hubHalfTangents(aspect);
  const camera = hubPose(width, height).position;
  const t = Math.min(Math.max(u, 0), 1);

  // A quadratic through near → bow → far, so the path curves the way an orbit
  // seen edge-on does rather than running straight.
  const control: [number, number] = [
    (COMET_NEAR_SCREEN[0] + COMET_FAR_SCREEN[0]) / 2 + COMET_BOW,
    (COMET_NEAR_SCREEN[1] + COMET_FAR_SCREEN[1]) / 2,
  ];
  const x =
    (1 - t) * (1 - t) * COMET_NEAR_SCREEN[0] +
    2 * (1 - t) * t * control[0] +
    t * t * COMET_FAR_SCREEN[0];
  const y =
    (1 - t) * (1 - t) * COMET_NEAR_SCREEN[1] +
    2 * (1 - t) * t * control[1] +
    t * t * COMET_FAR_SCREEN[1];

  const depth = camera[2] - HUB_SATELLITE[2] + COMET_DEPTH;
  return [
    camera[0] + (x - 0.5) * 2 * halfH * depth,
    camera[1] - (y - 0.5) * 2 * halfV * depth,
    camera[2] - depth,
  ];
}

/* ---------------------------------------------------------------------------
 * The trail, staged in the hub (rev 6 §4.5)
 * ------------------------------------------------------------------------- */

/**
 * Where the trail runs on screen: in from the top-left, near end just
 * above-left of the far wing, far end higher and slightly inboard (§3.1).
 */
const TRAIL_SCREEN: Record<
  "portrait" | "landscape",
  { near: [number, number]; far: [number, number] }
> = {
  portrait: { near: [0.3, 0.34], far: [0.38, 0.14] },
  landscape: { near: [0.32, 0.42], far: [0.36, 0.07] },
};

/** How far behind the satellite the near end begins. */
const TRAIL_DEPTH = 2.4;

/**
 * The trail's control points, placed into the hub.
 *
 * The shape comes from `trailControlPoints`, which is seeded per card and
 * knows nothing about the screen. This puts that shape where the composition
 * wants it — and it has to, because the trail used to start at the world
 * origin, which is exactly where revision 6 puts the satellite. They overlapped.
 *
 * The spine is built by projecting **both** screen targets back into the world
 * at their own depths, rather than by picking an angle and hoping. That matters
 * more than it sounds: a line that simply recedes converges on the centre of
 * the frame as it goes, and the centre of the frame is the satellite. Getting
 * the far end to stay up and left means climbing about 28 world units over the
 * length of the curve, which is not an angle anyone would guess.
 *
 * The seeded wander is kept as an offset around that spine, so each card's
 * trail still bends its own way.
 *
 * `CameraRig` travels *this* curve, not the raw one, so what the camera follows
 * and what the ribbon draws stay the same line.
 */
export function stagedTrail(seed: number, width: number, height: number): Vec3[] {
  const aspect = width / height;
  const { halfV, halfH } = hubHalfTangents(aspect);
  const camera = hubPose(width, height).position;
  const target = TRAIL_SCREEN[aspect < 1 ? "portrait" : "landscape"];

  const local = trailControlPoints(seed);
  const [, , nearZ] = local[0];
  const farZ = local[local.length - 1][2];

  /** A screen point at a given depth, back in the world. */
  const place = (screen: [number, number], depth: number): Vec3 => [
    camera[0] + (screen[0] - 0.5) * 2 * halfH * depth,
    camera[1] - (screen[1] - 0.5) * 2 * halfV * depth,
    camera[2] - depth,
  ];

  const base = camera[2] - HUB_SATELLITE[2] + TRAIL_DEPTH;
  const nearAnchor = place(target.near, base);
  const farAnchor = place(target.far, base + (nearZ - farZ));

  return local.map(([x, y, z], index) => {
    // The curve's own z progression, which is quadratic: the far end is much
    // further apart than the near end, so the trail compresses toward the
    // horizon the way a receding line should.
    const t = (nearZ - z) / (nearZ - farZ);

    // The seeded wander, with the built-in rise removed — the spine provides
    // that now.
    const wanderX = x - local[0][0];
    const wanderY = y - local[0][1] - 1.1 * (index / (local.length - 1));

    return [
      nearAnchor[0] + (farAnchor[0] - nearAnchor[0]) * t + wanderX,
      nearAnchor[1] + (farAnchor[1] - nearAnchor[1]) * t + wanderY,
      nearAnchor[2] + (farAnchor[2] - nearAnchor[2]) * t,
    ];
  });
}

/** The old name, kept so nothing has to change twice. */
export const orbitPose = hubPose;

/* ---------------------------------------------------------------------------
 * The trail (spec v0.2 §9.2, §9.3)
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Travelling the trail (spec v0.2 §9.3)
 * ------------------------------------------------------------------------- */

/**
 * How far off the curve's own axis the camera flies, as a share of its
 * distance from the memory it is reading.
 *
 * Not zero, and that is the whole point. The camera used to sit *on* the
 * curve, backed straight off along the tangent — which put the ribbon's
 * centreline two tenths of a unit from the lens and pointed the camera down
 * its length. A 0.1-unit ribbon passing that close, additively blended, fills
 * the frame with a white wedge; the memory behind it is a wireframe in fog.
 *
 * Flown to one side and a little above, the ribbon sweeps past the corner of
 * the frame and away to the vanishing point, and the reader can see they are
 * moving along something. Seventeen degrees off axis costs 4% of the panel's
 * width to foreshortening and buys the entire shot.
 */
export const TRAIL_OFFSET_SIDE = 0.26;
export const TRAIL_OFFSET_LIFT = 0.16;

/**
 * Where the camera stands to look at the point `u` along the trail.
 *
 * Shared with verify, which checks the one thing that matters here: that the
 * flight path never passes close enough to the ribbon to blow it out.
 */
export function trailPose(points: Vec3[], u: number, distance: number): Pose {
  const at = trailPoint(points, u);
  const tangent = trailTangent(points, u);

  // A frame around the curve: across it, and up from it.
  const side = unit(cross(tangent, [0, 1, 0]));
  const lift = unit(cross(side, tangent));

  // The direction from the memory back towards the camera, as a unit vector,
  // so the distance to the panel is exactly the framing distance.
  const away = unit([
    -tangent[0] + side[0] * TRAIL_OFFSET_SIDE + lift[0] * TRAIL_OFFSET_LIFT,
    -tangent[1] + side[1] * TRAIL_OFFSET_SIDE + lift[1] * TRAIL_OFFSET_LIFT,
    -tangent[2] + side[2] * TRAIL_OFFSET_SIDE + lift[2] * TRAIL_OFFSET_LIFT,
  ]);

  return {
    position: [
      at[0] + away[0] * distance,
      at[1] + away[1] * distance,
      at[2] + away[2] * distance,
    ],
    lookAt: at,
  };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/** The panel's world size. The cube's face is 2 units; a photograph earns more. */
export const MEMORY_PANEL_WORLD = 2.4;

/** The share of the frame a memory should fill — the same as a cube face's. */
const MEMORY_FILL_PORTRAIT = 0.72; // §17: 65-80% of the width
const MEMORY_FILL_LANDSCAPE = 0.55; // §17: 45-65% of the height

/**
 * How far in front of a memory the camera stops.
 *
 * Responsive for the same reason `cameraDistance` is: a fixed distance makes
 * the panel fill a phone's narrow frame and get lost in a wide one. Portrait
 * is governed by width, landscape by height.
 */
export function memoryViewDistance(width: number, height: number): number {
  const aspect = width / height;
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);

  const portrait = aspect < 1;
  const halfAngle = portrait ? halfH : halfV;
  const fill = portrait ? MEMORY_FILL_PORTRAIT : MEMORY_FILL_LANDSCAPE;

  return MEMORY_PANEL_WORLD / fill / 2 / Math.tan(halfAngle);
}

/**
 * The share of the viewport a memory panel fills, which §17 requires to match
 * a cube face's: 65-80% of the width in portrait, 45-65% of the height in
 * landscape. Returned as fractions so verify can assert both.
 */
export function memoryPanelFraming(width: number, height: number) {
  const aspect = width / height;
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const distance = memoryViewDistance(width, height);

  const visibleHeight = 2 * Math.tan(halfV) * distance;
  const visibleWidth = 2 * Math.tan(halfH) * distance;

  return {
    distance,
    widthFraction: MEMORY_PANEL_WORLD / visibleWidth,
    heightFraction: MEMORY_PANEL_WORLD / visibleHeight,
    /** Screen pixels the panel occupies, for the 40px-per-unit text rule. */
    screenPx: (MEMORY_PANEL_WORLD / visibleWidth) * width,
  };
}

/** Fraction of the viewport's governing axis the front face should occupy. */
const DESKTOP_FILL = 0.55; // of viewport height (spec §15: 45-65%)
const MOBILE_FILL = 0.75; // of viewport width  (spec §15: 65-80%)

const FACE_SIZE = 2; // the cube is 2 units across
const FACE_PLANE_Z = 1; // the front face sits 1 unit nearer than the centre
/** Half-extent the cube sweeps through during a transition; keeps it unclipped. */
const SWEPT_RADIUS = 1.5;

export function cameraDistance(width: number, height: number): number {
  const aspect = width / height;
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);

  // Portrait is governed by width, landscape by height.
  const portrait = aspect < 1;
  const halfAngle = portrait ? halfH : halfV;
  const fill = portrait ? MOBILE_FILL : DESKTOP_FILL;

  // Distance that makes the *front face* — not the cube centre — fill `fill`.
  const visibleAtFace = FACE_SIZE / fill;
  const toFace = visibleAtFace / 2 / Math.tan(halfAngle);

  // Never let a spinning cube clip the edge of the frame.
  const safe = SWEPT_RADIUS / Math.sin(Math.min(halfV, halfH));

  return Math.max(FACE_PLANE_Z + toFace, safe);
}

const PANEL_WORLD = 1.84; // width of the text panel, in cube-face units
const PANEL_MIN_PX = 260;
const PANEL_MAX_PX = 560;

/** How many screen pixels wide the text panel ends up, at this viewport. */
function panelScreenPixels(width: number, height: number): number {
  const halfV = ((FOV * Math.PI) / 180) / 2;
  const toFace = cameraDistance(width, height) - FACE_PLANE_Z;
  const visibleHeight = 2 * Math.tan(halfV) * toFace;
  return (PANEL_WORLD / visibleHeight) * height;
}

/**
 * CSS width to author the text panel at. Matching it to the panel's on-screen
 * size keeps the CSS-to-screen scale near 1:1, so a 17px font renders at ~17px
 * on a phone and a desktop alike. Clamped so very large windows scale the type
 * up instead of stretching lines out.
 */
export function textPanelPx(width: number, height: number): number {
  const ideal = panelScreenPixels(width, height);
  return Math.round(Math.min(Math.max(ideal, PANEL_MIN_PX), PANEL_MAX_PX));
}

/** drei's <Html transform> maps 40 CSS px to 1 world unit at scale 1. */
export function textPanelScale(panelPx: number): number {
  return (40 * PANEL_WORLD) / panelPx;
}

const PANEL_PADDING = 0.085; // fraction of the panel, per side
const LINE_HEIGHT = 1.9;
const MIN_FONT_PX = 12.5;
const MAX_FONT_PX = 20;

function usableWidth(panelPx: number): number {
  return panelPx * (1 - 2 * PANEL_PADDING);
}

/** Lines the text wraps to at a given size, and the height it needs. */
function layout(panelPx: number, chars: number, fontPx: number) {
  const available = usableWidth(panelPx);
  const charsPerLine = Math.max(1, Math.floor(available / fontPx));
  const lines = Math.ceil(Math.max(chars, 1) / charsPerLine);
  return { charsPerLine, lines, height: lines * fontPx * LINE_HEIGHT, available };
}

/**
 * Largest size at which `chars` of Japanese text still fits the square face
 * panel. Japanese glyphs are near em-square, so the closed-form estimate is a
 * good starting point; it is then stepped down until the wrapped line count
 * genuinely fits, since lines round up. Content that only fits below
 * MIN_FONT_PX should be shortened instead (spec §7).
 */
/**
 * A `line` face (spec v0.2 §13.2): one short sentence, set large and centred.
 *
 * It is not a smaller problem than a paragraph but a different one. A
 * paragraph is fitted so it does not spill; a line is fitted so it lands as a
 * *beat* — 2.2x the paragraph size, and still on one line whatever the
 * viewport, which is why the range is its own rather than a multiplier on the
 * paragraph range.
 */
const LINE_FACE_SCALE = 2.2;
const LINE_MIN_FONT_PX = 20;
const LINE_MAX_FONT_PX = 56;

export function fitLineFaceSize(panelPx: number, chars: number): number {
  const available = usableWidth(panelPx);
  // Japanese sets roughly one character per em, so the width a line needs is
  // its character count times the font size. Allow two lines for a long one
  // rather than shrinking it below legibility.
  const ideal = Math.min(LINE_MAX_FONT_PX, fitFontSize(panelPx, chars) * LINE_FACE_SCALE);
  const byWidth = (available / Math.max(chars, 1)) * (chars > 12 ? 2 : 1);
  return Math.floor(Math.max(Math.min(ideal, byWidth), LINE_MIN_FONT_PX) * 100) / 100;
}

export function fitFontSize(panelPx: number, chars: number): number {
  const available = usableWidth(panelPx);
  let font = Math.min(
    MAX_FONT_PX,
    Math.sqrt((available * available) / (Math.max(chars, 1) * LINE_HEIGHT)),
  );

  while (font > MIN_FONT_PX && layout(panelPx, chars, font).height > available) {
    font -= 0.25;
  }
  // Floor, never round: rounding up can cost a character per line and so add
  // a whole line, putting the paragraph back over the edge of the face.
  return Math.floor(Math.max(font, MIN_FONT_PX) * 100) / 100;
}

/** Lines the text wraps to, and whether it still overflows the face. */
export function measureFace(panelPx: number, chars: number) {
  const fontPx = fitFontSize(panelPx, chars);
  const { charsPerLine, lines, height, available } = layout(panelPx, chars, fontPx);
  return { fontPx, charsPerLine, lines, overflows: height > available };
}

/* ---------- inside the cube ---------- */

const SECRET_FILL = 0.84; // of the viewport width, inside the cube
const SECRET_MIN_PX = 240;
const SECRET_MAX_PX = 520;
const SECRET_MIN_FONT = 15;
const SECRET_MAX_FONT = 34;

function halfAngles(width: number, height: number) {
  const halfV = ((FOV * Math.PI) / 180) / 2;
  return { halfV, halfH: Math.atan(Math.tan(halfV) * (width / height)) };
}

/** How wide the view is, in world units, at the far wall seen from inside. */
export function insideVisibleWidth(width: number, height: number): number {
  const { halfH } = halfAngles(width, height);
  return 2 * Math.tan(halfH) * (INSIDE_DISTANCE - SECRET_PLANE_Z);
}

/**
 * The secret panel, in the two units that matter: CSS pixels to author it at,
 * and world units to place it at. Inside a cube only ~0.6 world units of view
 * are available on a phone, so the panel is sized from the *inside* distance
 * rather than the reading distance — the same idea as `textPanelPx`, a
 * different camera position.
 */
export function secretPanel(width: number, height: number) {
  const visible = insideVisibleWidth(width, height);
  const panelPx = Math.round(Math.min(Math.max(SECRET_FILL * width, SECRET_MIN_PX), SECRET_MAX_PX));
  // Keep the panel inside the frame even where the clamp above widened it.
  const worldWidth = Math.min((panelPx / width) * visible, visible * SECRET_FILL);
  return { panelPx, worldWidth, scale: (40 * worldWidth) / panelPx };
}

/** One line, so size is simply what fits the panel's width. */
export function fitLinePx(panelPx: number, chars: number): number {
  const usable = panelPx * (1 - 2 * PANEL_PADDING);
  const font = usable / Math.max(chars, 1);
  return Math.floor(Math.min(Math.max(font, SECRET_MIN_FONT), SECRET_MAX_FONT) * 100) / 100;
}

/** Whether that line actually fits the panel at the size it would be set. */
export function secretFits(width: number, height: number, chars: number) {
  const { panelPx } = secretPanel(width, height);
  const fontPx = fitLinePx(panelPx, chars);
  const usable = panelPx * (1 - 2 * PANEL_PADDING);
  return { fontPx, panelPx, overflows: fontPx * Math.max(chars, 1) > usable };
}
