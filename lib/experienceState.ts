/**
 * The card experience as a pure state machine, so the flow can be verified
 * without a browser (see scripts/verify-rotation.mts).
 *
 * v0.2 adds everything past the closing screen — the cube unfolding into a
 * satellite, the orbit it becomes the hub of, and the trail of memories behind
 * it (spec v0.2 §6). None of that changes a v0.1 card: with `hasOrbit` false
 * the new events are no-ops and the old transitions are untouched.
 */

export type ExperienceState =
  | "landing" // title screen, camera waiting far back
  | "entering" // camera dollying in from the landing screen
  | "returning" // camera dollying back in from the closing screen
  | "reading" // face square-on, text revealed
  | "transitioning" // cube rotating to the next face
  | "leaving" // camera dollying out towards the closing screen
  | "completed" // closing screen
  | "descending" // camera passing through a wall, into the cube
  | "inside" // the secret line, read from inside the cube
  | "ascending" // camera coming back out to the closing screen
  /* ---- v0.2 ---- */
  | "deploying" // the cube unfolds into a satellite and rises into orbit
  | "orbit" // the hub: satellite, the comet, the trail behind
  | "undeploying" // the reverse, back to the closing screen
  | "departing" // the comet comes round the planet and heads out (§8.4)
  | "charting" // the camera closes on the comet, holds, pulls back to the chart
  | "nudging" // at rest on the chart, the comet sheet open (§8.6)
  | "boarding" // the receiver's words run up the orbit line to the comet
  | "homing" // the camera returns from the chart pose to the orbit pose
  | "rewinding" // camera leaves orbit and joins the trail at the newest memory
  | "remembering" // one memory, framed and legible
  | "drifting" // camera travels along the trail to the next memory
  | "resurfacing" // camera leaves the trail for the orbit pose
  | "launching"; // the reply rocket rises and becomes a star

/** Where the camera is, which is no longer a yes/no now the cube has an inside. */
export type CameraPhase = "far" | "near" | "inside" | "orbit" | "chart" | "trail";

/** Which orbit sheet is open, if any. Only one is ever open at a time. */
export type OrbitPanel = null | "crossroads" | "reply";

/**
 * What the card and this browser between them say about the comet, read once
 * on mount (§6.1). The reducer never touches storage — it is handed the
 * answers so it can stay pure and testable.
 */
export type CometFlags = {
  exists: boolean;
  returned: boolean;
  /** The receiver may put words on it, and has not this cycle. */
  capsuleOpen: boolean;
  /** The departure has already been watched this cycle. */
  departed: boolean;
};

export const LAST_FACE = 5;

export type Experience = {
  state: ExperienceState;
  activeFace: number;
  /** 0 is the newest memory: the trail is read backwards in time. */
  activeMemory: number;
  panel: OrbitPanel;
  /** A reply was launched in this session. */
  launched: boolean;
  /** How the current comet moment began: automatically, or by a tap (§8.3). */
  chartVia: "deploy" | "tap" | null;
  comet: CometFlags;
  /* Fixed for the card's lifetime, set by initialExperience. */
  memoryCount: number;
  hasOrbit: boolean;
  /** A reply is available, or there are memories: the crossroads has a point. */
  hasCrossroads: boolean;
};

export type ExperienceEvent =
  | { type: "open" }
  | { type: "move"; direction: 1 | -1 }
  | { type: "rotationEnd" }
  | { type: "zoomEnd" }
  | { type: "replay" }
  /** Toggles the inside of the cube: from the closing screen in, from inside out. */
  | { type: "reveal" }
  /* ---- v0.2 ---- */
  /** The button equivalent of move(+1) at the closing screen. */
  | { type: "deploy" }
  /** The button equivalent of move(-1) in orbit. */
  | { type: "dock" }
  | { type: "deployEnd" }
  | { type: "departEnd" }
  /** Tap the comet, or 彗星 in the bottom bar. */
  | { type: "openChart" }
  /** Dispatched only once the server has accepted the words (§14.5). */
  | { type: "board" }
  | { type: "boardEnd" }
  /** ✕, Escape, tapping outside the sheet, or any of its dismiss buttons. */
  | { type: "leaveChart" }
  /** From orbit, join the trail; from the trail, leave it. */
  | { type: "lookBack" }
  | { type: "openPanel"; panel: Exclude<OrbitPanel, null> }
  | { type: "closePanel" }
  /** Dispatched only once the server has accepted the reply (§10). */
  | { type: "launch" }
  | { type: "launchEnd" };

export type ExperienceContext = {
  memoryCount: number;
  hasOrbit: boolean;
  hasCrossroads: boolean;
  comet: CometFlags;
};

export function initialExperience(ctx: ExperienceContext = EMPTY): Experience {
  return {
    state: "landing",
    activeFace: 0,
    activeMemory: 0,
    panel: null,
    launched: false,
    chartVia: null,
    comet: ctx.comet,
    memoryCount: ctx.memoryCount,
    hasOrbit: ctx.hasOrbit,
    hasCrossroads: ctx.hasCrossroads,
  };
}

export const NO_COMET_FLAGS: CometFlags = {
  exists: false,
  returned: false,
  capsuleOpen: false,
  departed: false,
};

/** A card with nothing past the closing screen: v0.1 behaviour, exactly. */
const EMPTY: ExperienceContext = {
  memoryCount: 0,
  hasOrbit: false,
  hasCrossroads: false,
  comet: NO_COMET_FLAGS,
};

export function reduceExperience(current: Experience, event: ExperienceEvent): Experience {
  const { state, activeFace, activeMemory, panel, memoryCount, hasOrbit } = current;
  const lastMemory = memoryCount - 1;

  switch (event.type) {
    case "open":
      return state === "landing" ? { ...current, state: "entering", activeFace: 0 } : current;

    case "move": {
      // The reader may be typing into a panel, so a gesture means nothing until
      // the panel is closed.
      if (panel !== null) return current;

      // Any deliberate gesture inside the cube brings you back out.
      if (state === "inside") return { ...current, state: "ascending" };

      // The closing screen now has two ways out: back into the card, or on
      // into orbit if the card has one.
      if (state === "completed") {
        if (event.direction === -1) return { ...current, state: "returning" };
        return hasOrbit ? { ...current, state: "deploying" } : current;
      }

      if (state === "orbit") {
        if (event.direction === -1) return { ...current, state: "undeploying" };
        return memoryCount > 0 ? { ...current, state: "rewinding", activeMemory: 0 } : current;
      }

      // The whole of `nudging` is a sheet, so it swallows gestures too.
      if (state === "nudging") return current;

      // The trail runs newest to oldest. Off either end is not a dead stop but
      // a way back to orbit, so the reader is never stranded at the far end of
      // someone else's memories.
      if (state === "remembering") {
        if (event.direction === 1) {
          if (activeMemory >= lastMemory) return { ...current, state: "resurfacing" };
          return { ...current, state: "drifting", activeMemory: activeMemory + 1 };
        }
        if (activeMemory === 0) return { ...current, state: "resurfacing" };
        return { ...current, state: "drifting", activeMemory: activeMemory - 1 };
      }

      if (state !== "reading") return current;

      if (event.direction === 1) {
        if (activeFace === LAST_FACE) return { ...current, state: "leaving" };
        return { ...current, state: "transitioning", activeFace: activeFace + 1 };
      }
      if (activeFace === 0) return current;
      return { ...current, state: "transitioning", activeFace: activeFace - 1 };
    }

    case "deploy":
      if (state !== "completed" || !hasOrbit) return current;
      return { ...current, state: "deploying" };

    case "dock":
      if (state !== "orbit" || panel !== null) return current;
      return { ...current, state: "undeploying" };

    case "deployEnd":
      if (state === "deploying") return afterDeploy(current);
      // Undeploying returns to the closing screen the reader left, same face.
      if (state === "undeploying") return { ...current, state: "completed", panel: null };
      return current;

    case "departEnd":
      if (state !== "departing") return current;
      // The departure is watched once per cycle, then the chart draws.
      return { ...current, state: "charting", comet: { ...current.comet, departed: true } };

    case "openChart":
      if (state !== "orbit" || !current.comet.exists) return current;
      if (panel !== null && panel !== "crossroads") return current;
      // A tap is the reader's own choice, so leaving it returns to the plain
      // hub rather than offering the crossroads again.
      return { ...current, state: "charting", chartVia: "tap", panel: null };

    case "board":
      if (state !== "nudging" || !current.comet.capsuleOpen) return current;
      return { ...current, state: "boarding" };

    case "boardEnd":
      if (state !== "boarding") return current;
      return {
        ...current,
        state: "nudging",
        comet: { ...current.comet, capsuleOpen: false },
      };

    case "leaveChart": {
      if (state !== "nudging") return current;
      // The crossroads follows an *automatic* comet moment only: it asks
      // "where next?" about a journey the card started, not one the reader
      // chose by tapping the comet.
      const next =
        current.chartVia === "deploy" && current.hasCrossroads
          ? ("crossroads" as const)
          : null;
      return { ...current, state: "homing", panel: next, chartVia: null };
    }

    case "lookBack":
      if (state === "orbit") {
        // The crossroads is one of the two places this is offered from, so it
        // does not block the way it a reply sheet does.
        if ((panel !== null && panel !== "crossroads") || memoryCount === 0) return current;
        return { ...current, state: "rewinding", activeMemory: 0, panel: null };
      }
      if (state === "remembering") return { ...current, state: "resurfacing" };
      return current;

    case "openPanel":
      if (state !== "orbit") return current;
      // The rocket goes once. Offering the form again would invite a second
      // reply that the sender would receive as a duplicate.
      if (event.panel === "reply" && current.launched) return current;
      return { ...current, panel: event.panel };

    case "closePanel":
      return panel === null ? current : { ...current, panel: null };

    case "launch":
      if (state !== "orbit" || panel !== "reply") return current;
      return { ...current, state: "launching" };

    case "launchEnd":
      if (state !== "launching") return current;
      return { ...current, state: "orbit", panel: null, launched: true };


    case "rotationEnd":
      return state === "transitioning" ? { ...current, state: "reading" } : current;

    case "zoomEnd":
      if (state === "entering" || state === "returning") return { ...current, state: "reading" };
      if (state === "leaving") return { ...current, state: "completed" };
      if (state === "descending") return { ...current, state: "inside" };
      if (state === "ascending") return { ...current, state: "completed" };
      if (state === "rewinding" || state === "drifting") {
        return { ...current, state: "remembering" };
      }
      if (state === "resurfacing") return { ...current, state: "orbit" };
      if (state === "charting") return { ...current, state: "nudging" };
      if (state === "homing") return { ...current, state: "orbit" };
      return current;

    case "replay":
      return state === "completed"
        ? { ...current, state: "returning", activeFace: 0, panel: null }
        : current;

    case "reveal":
      if (state === "completed") return { ...current, state: "descending" };
      if (state === "inside") return { ...current, state: "ascending" };
      return current;
  }
}

/**
 * Where a deployment lands (spec v0.2 rev 5, §8.3).
 *
 * This is the one branch in the whole machine that decides itself rather than
 * being told, and it is what makes the comet feel like an event rather than a
 * menu item: the first deployment of a cycle *goes to the comet*, and only
 * once its words are aboard do later deployments settle into the hub.
 */
function afterDeploy(current: Experience): Experience {
  const { comet } = current;

  if (!comet.exists) return { ...current, state: "orbit" };

  // Not yet watched leave, and not back yet: watch it go.
  if (!comet.departed && !comet.returned) {
    return { ...current, state: "departing", chartVia: "deploy" };
  }
  // Back today, or still waiting for words: go and look at it.
  if (comet.returned || comet.capsuleOpen) {
    return { ...current, state: "charting", chartVia: "deploy" };
  }
  return { ...current, state: "orbit" };
}

/** Camera sits close to the cube — or, past the wall, within it. */
export function isZoomedIn(state: ExperienceState): boolean {
  return cameraPhase(state) !== "far";
}

export function cameraPhase(state: ExperienceState): CameraPhase {
  if (state === "descending" || state === "inside") return "inside";
  if (
    state === "entering" ||
    state === "returning" ||
    state === "reading" ||
    state === "transitioning"
  ) {
    return "near";
  }
  if (
    state === "deploying" ||
    state === "orbit" ||
    state === "departing" ||
    state === "launching" ||
    state === "resurfacing" ||
    state === "homing"
  ) {
    return "orbit";
  }
  // `charting` plays a close-up and then pulls back to the chart pose, so the
  // pose it is *heading for* is the chart's.
  if (state === "charting" || state === "nudging" || state === "boarding") return "chart";
  if (state === "rewinding" || state === "remembering" || state === "drifting") return "trail";
  // "ascending" and "undeploying" are already on their way back out, so they
  // target the far position.
  return "far";
}

/** Face text is attached to the cube only while the card is being read. */
export function revealsText(state: ExperienceState): boolean {
  return state === "reading";
}

/** The secret line is attached to the inner wall only while you are in there. */
export function revealsSecret(state: ExperienceState): boolean {
  return state === "inside";
}

/**
 * A memory's title, date and caption exist only while that memory is framed —
 * the same rule as face text, for the same reason.
 */
export function revealsMemory(state: ExperienceState): boolean {
  return state === "remembering";
}

/**
 * The cube renders in its satellite form: panels open, smaller, on its orbit.
 * True for everything past the closing screen, including the two animations
 * that cross that boundary.
 */
export function isDeployed(state: ExperienceState): boolean {
  return (
    state === "deploying" ||
    state === "orbit" ||
    state === "undeploying" ||
    state === "departing" ||
    state === "charting" ||
    state === "nudging" ||
    state === "boarding" ||
    state === "homing" ||
    state === "rewinding" ||
    state === "remembering" ||
    state === "drifting" ||
    state === "resurfacing" ||
    state === "launching"
  );
}

/**
 * The comet sheet, and with it the sender's words on the returned day, attach
 * only here — the same rule face text and memory text follow.
 */
export function showsCometSheet(state: ExperienceState): boolean {
  return state === "nudging";
}

/** The cube's inner shell exists only while the camera is on its way in or out. */
export function isWithinCube(state: ExperienceState): boolean {
  return state === "descending" || state === "inside" || state === "ascending";
}

/**
 * The closing screen dims the scene so the drawn message stays legible.
 * Diving inside lifts the dimming again — the cube brightens as you enter it.
 * Orbit and the trail are never dimmed: there the scene *is* the content.
 */
export function dimsScene(state: ExperienceState): boolean {
  return (
    state === "leaving" ||
    state === "completed" ||
    state === "returning" ||
    state === "ascending" ||
    state === "undeploying"
  );
}

/**
 * The camera breathes here (spec v0.2 §23.2): a sub-percent dolly over 26
 * seconds, which is the difference between a place and a photograph of one.
 *
 * Never where something is being read. `reading`, `remembering` and `inside`
 * are all excluded, because text that drifts while your eyes are on it is far
 * worse than a scene that holds still — and `acceptsInput` is *not* the right
 * test for that, since two of those three accept input.
 */
export function breathesAtRest(state: ExperienceState): boolean {
  return state === "landing" || state === "completed" || state === "orbit";
}

/** Navigation input is ignored unless the experience is at rest. */
export function acceptsInput(state: ExperienceState): boolean {
  return (
    state === "reading" ||
    state === "completed" ||
    state === "inside" ||
    state === "orbit" ||
    state === "remembering" ||
    // `nudging` is at rest, but only the sheet and Escape act on it.
    state === "nudging"
  );
}
