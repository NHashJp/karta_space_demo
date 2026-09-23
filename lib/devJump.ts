import type { ExperienceEvent } from "./experienceState.ts";

/**
 * `?at=<target>`: start the experience somewhere other than the beginning
 * (spec v0.2 §6.6).
 *
 * This exists for the editor's live preview, where waiting through the whole
 * journey to check one line of the satellite panel would make editing
 * unusable. The reducer is deliberately *not* changed to allow jumps: this
 * module only computes the events a reader would have sent, and
 * `CardExperience` replays them with reduced-motion durations. So the preview
 * can only reach states a reader can reach, and there is no second way into
 * any state to keep correct.
 *
 * Development only. In production `resolveJump` returns null whatever the
 * query string says, for the same reason `?now=` is ignored there: a query
 * parameter that walks past the closing screen — or unseals a comet — would be
 * no seal at all.
 */

export const JUMP_TARGETS = [
  "landing",
  "face-1",
  "face-2",
  "face-3",
  "face-4",
  "face-5",
  "face-6",
  "closing",
  "inside",
  "orbit",
  "trail",
  "satellite",
  "comet",
  "reply",
] as const;

export type JumpTarget = (typeof JUMP_TARGETS)[number];

export function isJumpTarget(value: unknown): value is JumpTarget {
  return typeof value === "string" && (JUMP_TARGETS as readonly string[]).includes(value);
}

/** Open the card and arrive on face 1. */
const TO_READING: ExperienceEvent[] = [{ type: "open" }, { type: "zoomEnd" }];

/** From face 1, turn to the given face (1-based). */
function toFace(face: number): ExperienceEvent[] {
  const out: ExperienceEvent[] = [...TO_READING];
  for (let i = 1; i < face; i++) {
    out.push({ type: "move", direction: 1 }, { type: "rotationEnd" });
  }
  return out;
}

/** All the way through the six faces and out to the closing screen. */
const TO_CLOSING: ExperienceEvent[] = [
  ...toFace(6),
  { type: "move", direction: 1 },
  { type: "zoomEnd" },
];

const TO_ORBIT: ExperienceEvent[] = [
  ...TO_CLOSING,
  { type: "deploy" },
  { type: "deployEnd" },
];

/**
 * The events that take a reader from the landing screen to `target`, or null
 * if there is no such target (or we are in production).
 *
 * A target that the card cannot reach — the trail on a card with no memories,
 * a panel on a card with no orbit — simply stops early at the last state the
 * card does have, which is what the editor's preview should show anyway.
 */
export function jumpEvents(target: string | undefined): ExperienceEvent[] | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!isJumpTarget(target)) return null;

  switch (target) {
    case "landing":
      return [];
    case "face-1":
    case "face-2":
    case "face-3":
    case "face-4":
    case "face-5":
    case "face-6":
      return toFace(Number(target.slice(5)));
    case "closing":
      return TO_CLOSING;
    case "inside":
      return [...TO_CLOSING, { type: "reveal" }, { type: "zoomEnd" }];
    case "orbit":
      return TO_ORBIT;
    case "trail":
      return [...TO_ORBIT, { type: "lookBack" }, { type: "zoomEnd" }];
    case "satellite":
      return [...TO_ORBIT, { type: "openPanel", panel: "satellite" }];
    case "comet":
      return [...TO_ORBIT, { type: "openPanel", panel: "comet" }];
    case "reply":
      return [...TO_ORBIT, { type: "openPanel", panel: "reply" }];
  }
}

/** The first of `values`, whether the query gave one or many. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
