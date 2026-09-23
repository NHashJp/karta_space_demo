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
  | "orbit" // the hub: satellite, comets, the trail behind
  | "undeploying" // the reverse, back to the closing screen
  | "rewinding" // camera leaves orbit and joins the trail at the newest memory
  | "remembering" // one memory, framed and legible
  | "drifting" // camera travels along the trail to the next memory
  | "resurfacing" // camera leaves the trail for the orbit pose
  | "launching" // the reply rocket rises and becomes a star
  | "releasing"; // the receiver's comet swings out onto its orbit

/** Where the camera is, which is no longer a yes/no now the cube has an inside. */
export type CameraPhase = "far" | "near" | "inside" | "orbit" | "trail";

/** Which orbit panel is open, if any. Only one is ever open at a time. */
export type OrbitPanel = null | "satellite" | "reply" | "comet";

export const LAST_FACE = 5;

export type Experience = {
  state: ExperienceState;
  activeFace: number;
  /** 0 is the newest memory: the trail is read backwards in time. */
  activeMemory: number;
  panel: OrbitPanel;
  /** A reply was launched in this session. */
  launched: boolean;
  /** A comet was released in this session. */
  released: boolean;
  /* Fixed for the card's lifetime, set by initialExperience. */
  memoryCount: number;
  hasOrbit: boolean;
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
  /** From orbit, join the trail; from the trail, leave it. */
  | { type: "lookBack" }
  | { type: "openPanel"; panel: Exclude<OrbitPanel, null> }
  | { type: "closePanel" }
  /** Dispatched only once the server has accepted the reply (§10). */
  | { type: "launch" }
  | { type: "launchEnd" }
  /** Dispatched only once the server has accepted the comet (§11). */
  | { type: "release" }
  | { type: "releaseEnd" };

export type ExperienceContext = { memoryCount: number; hasOrbit: boolean };

export function initialExperience(ctx: ExperienceContext = EMPTY): Experience {
  return {
    state: "landing",
    activeFace: 0,
    activeMemory: 0,
    panel: null,
    launched: false,
    released: false,
    memoryCount: ctx.memoryCount,
    hasOrbit: ctx.hasOrbit,
  };
}

/** A card with nothing past the closing screen: v0.1 behaviour, exactly. */
const EMPTY: ExperienceContext = { memoryCount: 0, hasOrbit: false };

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
      if (state === "deploying") return { ...current, state: "orbit" };
      // Undeploying returns to the closing screen the reader left, same face.
      if (state === "undeploying") return { ...current, state: "completed", panel: null };
      return current;

    case "lookBack":
      if (state === "orbit") {
        if (panel !== null || memoryCount === 0) return current;
        return { ...current, state: "rewinding", activeMemory: 0 };
      }
      if (state === "remembering") return { ...current, state: "resurfacing" };
      return current;

    case "openPanel":
      return state === "orbit" ? { ...current, panel: event.panel } : current;

    case "closePanel":
      return panel === null ? current : { ...current, panel: null };

    case "launch":
      if (state !== "orbit" || panel !== "reply") return current;
      return { ...current, state: "launching" };

    case "launchEnd":
      if (state !== "launching") return current;
      return { ...current, state: "orbit", panel: null, launched: true };

    case "release":
      if (state !== "orbit" || panel !== "comet") return current;
      return { ...current, state: "releasing" };

    case "releaseEnd":
      if (state !== "releasing") return current;
      return { ...current, state: "orbit", panel: null, released: true };

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
    state === "launching" ||
    state === "releasing" ||
    state === "resurfacing"
  ) {
    return "orbit";
  }
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
    state === "rewinding" ||
    state === "remembering" ||
    state === "drifting" ||
    state === "resurfacing" ||
    state === "launching" ||
    state === "releasing"
  );
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

/** Navigation input is ignored unless the experience is at rest. */
export function acceptsInput(state: ExperienceState): boolean {
  return (
    state === "reading" ||
    state === "completed" ||
    state === "inside" ||
    state === "orbit" ||
    state === "remembering"
  );
}
