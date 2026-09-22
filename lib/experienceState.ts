/**
 * The card experience as a pure state machine, so the flow can be verified
 * without a browser (see scripts/verify-rotation.mts).
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
  | "ascending"; // camera coming back out to the closing screen

/** Where the camera is, which is no longer a yes/no now the cube has an inside. */
export type CameraPhase = "far" | "near" | "inside";

export const LAST_FACE = 5;

export type Experience = { state: ExperienceState; activeFace: number };

export type ExperienceEvent =
  | { type: "open" }
  | { type: "move"; direction: 1 | -1 }
  | { type: "rotationEnd" }
  | { type: "zoomEnd" }
  | { type: "replay" }
  /** Toggles the inside of the cube: from the closing screen in, from inside out. */
  | { type: "reveal" };

export const initialExperience: Experience = { state: "landing", activeFace: 0 };

export function reduceExperience(current: Experience, event: ExperienceEvent): Experience {
  const { state, activeFace } = current;

  switch (event.type) {
    case "open":
      return state === "landing" ? { state: "entering", activeFace: 0 } : current;

    case "move": {
      // Any deliberate gesture inside the cube brings you back out.
      if (state === "inside") return { ...current, state: "ascending" };
      // Backing out of the closing screen dives into the final face again.
      if (state === "completed") {
        return event.direction === -1 ? { ...current, state: "returning" } : current;
      }
      if (state !== "reading") return current;

      if (event.direction === 1) {
        if (activeFace === LAST_FACE) return { ...current, state: "leaving" };
        return { state: "transitioning", activeFace: activeFace + 1 };
      }
      if (activeFace === 0) return current;
      return { state: "transitioning", activeFace: activeFace - 1 };
    }

    case "rotationEnd":
      return state === "transitioning" ? { ...current, state: "reading" } : current;

    case "zoomEnd":
      if (state === "entering" || state === "returning") return { ...current, state: "reading" };
      if (state === "leaving") return { ...current, state: "completed" };
      if (state === "descending") return { ...current, state: "inside" };
      if (state === "ascending") return { ...current, state: "completed" };
      return current;

    case "replay":
      return state === "completed" ? { state: "returning", activeFace: 0 } : current;

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
  // "ascending" is already on its way back out, so it targets the far position.
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

/** The cube's inner shell exists only while the camera is on its way in or out. */
export function isWithinCube(state: ExperienceState): boolean {
  return state === "descending" || state === "inside" || state === "ascending";
}

/**
 * The closing screen dims the scene so the drawn message stays legible.
 * Diving inside lifts the dimming again — the cube brightens as you enter it.
 */
export function dimsScene(state: ExperienceState): boolean {
  return (
    state === "leaving" ||
    state === "completed" ||
    state === "returning" ||
    state === "ascending"
  );
}

/** Navigation input is ignored unless the experience is at rest. */
export function acceptsInput(state: ExperienceState): boolean {
  return state === "reading" || state === "completed" || state === "inside";
}
