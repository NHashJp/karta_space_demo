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
  | "completed"; // closing screen

export const LAST_FACE = 5;

export type Experience = { state: ExperienceState; activeFace: number };

export type ExperienceEvent =
  | { type: "open" }
  | { type: "move"; direction: 1 | -1 }
  | { type: "rotationEnd" }
  | { type: "zoomEnd" }
  | { type: "replay" };

export const initialExperience: Experience = { state: "landing", activeFace: 0 };

export function reduceExperience(current: Experience, event: ExperienceEvent): Experience {
  const { state, activeFace } = current;

  switch (event.type) {
    case "open":
      return state === "landing" ? { state: "entering", activeFace: 0 } : current;

    case "move": {
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
      return current;

    case "replay":
      return state === "completed" ? { state: "returning", activeFace: 0 } : current;
  }
}

/** Camera sits close to the cube. */
export function isZoomedIn(state: ExperienceState): boolean {
  return (
    state === "entering" ||
    state === "returning" ||
    state === "reading" ||
    state === "transitioning"
  );
}

/** Face text is attached to the cube only while the card is being read. */
export function revealsText(state: ExperienceState): boolean {
  return state === "reading";
}

/** The closing screen dims the scene so the drawn message stays legible. */
export function dimsScene(state: ExperienceState): boolean {
  return state === "leaving" || state === "completed" || state === "returning";
}

/** Navigation input is ignored unless the experience is at rest. */
export function acceptsInput(state: ExperienceState): boolean {
  return state === "reading" || state === "completed";
}
