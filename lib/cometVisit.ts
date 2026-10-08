/**
 * What this browser remembers about the comet (spec v0.2 rev 5, §11.5).
 *
 * Without accounts or a database, "has this person already been asked, and did
 * they already write something" has to live somewhere. The only honest place
 * is their own browser: it is their visit, and it belongs to them.
 *
 * The record is scoped to a **cycle** — the `returnsOn` it belongs to — so a
 * yearly comet asks again next year rather than remembering forever that it
 * once asked.
 *
 * Parsing is pure and deliberately tolerant; reading and writing are wrapped,
 * because private browsing and blocked storage throw rather than returning
 * null. Unreadable storage behaves as a first visit every time, and the worst
 * that costs is a departure watched twice and a second invite — which is much
 * better than a card that refuses to work because it cannot remember you.
 */

export type CometVisit = {
  /** The `returnsOn` this record belongs to. */
  cycle: string;
  /** The departure has been watched. */
  departed?: true;
  /** The first-launch intro — the days, the path, the countdown — has played. */
  introduced?: true;
  /** The invite sheet has been shown once. */
  nudged?: true;
  /** Words were put on the comet, on this day. */
  sent?: { on: string };
  /** The arrival has been seen: its fade-in, meteors and cue play once. */
  arrivalSeen?: true;
};

/** What the reducer needs to know, resolved once on mount (§6.1). */
export type CometFlags = {
  exists: boolean;
  returned: boolean;
  capsuleOpen: boolean;
  departed: boolean;
  introduced: boolean;
};

export const NO_COMET: CometFlags = {
  exists: false,
  returned: false,
  capsuleOpen: false,
  departed: false,
  introduced: false,
};

export function visitKey(slug: string): string {
  return `ks_comet_${slug}`;
}

/**
 * A record for `cycle`, whatever the stored value turns out to be.
 *
 * Anything unrecognised — a record from another cycle, a revision-4 value,
 * corrupt JSON, null — becomes a fresh record rather than an error. This is a
 * convenience store, not a source of truth, and the card has to open either way.
 */
export function parseVisit(raw: string | null, cycle: string): CometVisit {
  if (!raw) return { cycle };

  try {
    const parsed = JSON.parse(raw) as Partial<CometVisit> | null;
    if (!parsed || typeof parsed !== "object" || parsed.cycle !== cycle) return { cycle };

    const visit: CometVisit = { cycle };
    if (parsed.departed === true) visit.departed = true;
    if (parsed.introduced === true) visit.introduced = true;
    if (parsed.nudged === true) visit.nudged = true;
    if (parsed.arrivalSeen === true) visit.arrivalSeen = true;
    if (parsed.sent && typeof parsed.sent.on === "string") visit.sent = { on: parsed.sent.on };
    return visit;
  } catch {
    return { cycle };
  }
}

/** The card's own answer about the comet, crossed with what this browser saw. */
export function toFlags(
  comet: { capsule: boolean; status: "away" | "returned" | "kept" } | undefined,
  visit: CometVisit,
): CometFlags {
  if (!comet) return NO_COMET;

  return {
    exists: true,
    returned: comet.status === "returned",
    // Open only while the card still invites words and this browser has not
    // sent any this cycle.
    capsuleOpen: comet.capsule && !visit.sent,
    // A kept comet left long ago; there is no departure left to watch.
    departed: Boolean(visit.departed) || comet.status === "kept",
    // Its own mark rather than `departed`, so a browser that watched the old
    // departure still gets the intro once.
    introduced: Boolean(visit.introduced) || comet.status === "kept",
  };
}

export function readVisit(slug: string, cycle: string): CometVisit {
  try {
    return parseVisit(window.localStorage.getItem(visitKey(slug)), cycle);
  } catch {
    return { cycle };
  }
}

export function writeVisit(slug: string, visit: CometVisit): void {
  try {
    window.localStorage.setItem(visitKey(slug), JSON.stringify(visit));
  } catch {
    /* private browsing, or storage blocked: this visit is simply not remembered */
  }
}

/**
 * `?visit=` for the editor's preview (§6.6): an in-memory record that is never
 * saved, so previewing "a reader who has already written" does not make this
 * browser one.
 */
export function previewVisit(mode: string | undefined, cycle = ""): CometVisit | null {
  if (process.env.NODE_ENV === "production") return null;

  switch (mode) {
    case "first":
      return { cycle };
    case "again":
      return { cycle, departed: true, introduced: true, nudged: true };
    case "sent":
      return { cycle, departed: true, introduced: true, nudged: true, sent: { on: cycle } };
    default:
      return null;
  }
}
