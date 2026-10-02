import type { CardConfig } from "./../types/card";

/**
 * Photographs follow their card when its slug changes.
 *
 * Every picture a card owns is filed under the card's own slug — cube faces in
 * `public/cards/<slug>/`, memory photographs in `private/cards/<slug>/` — and
 * both of those paths are written into the config as text. So the slug is not
 * just a name: it is half of every media path on the card.
 *
 * Which means renaming a card, or starting one by copying another, quietly
 * breaks all of them. The editor's slug field only ever rewrote the slug, so a
 * card copied from the sample kept pointing at the sample's folder, and the
 * two kinds of path then failed *differently*:
 *
 * - **Cube faces still worked**, because `/public` is served flat and the file
 *   really was at that URL. Nothing looked wrong.
 * - **Memory photographs did not**, because they are not served flat. They go
 *   through `/c/<slug>/media/`, which resolves inside that card's own folder
 *   and refuses anything outside it — correctly, or one card's reader could
 *   walk into another card's private pictures. So the URL became
 *   `/c/new-slug/media/private/cards/old-slug/memory-01.png`, the route
 *   resolved it under `private/cards/new-slug/`, found nothing, and returned
 *   404. The trail drew its frames with no photographs in them, and said
 *   nothing, because a memory that cannot load must never block the journey.
 *
 * The fix is here rather than in the route because the route is right: media
 * is namespaced by card and must stay that way. What was wrong is that a
 * rename did not carry the pictures with it.
 *
 * Pure, so the path arithmetic can be checked without touching a disk. The
 * copying that goes with it is in `lib/cardMediaFile.ts`.
 */

export type Relocation = {
  /** The path as the config has it now. */
  from: string;
  /** The same file, under this card's own folder. */
  to: string;
  where: "public" | "private";
};

/** `/cards/<slug>/<file>` — a cube face, addressed by its URL. */
const FACE = /^\/cards\/([^/]+)\/(.+)$/;
/** `private/cards/<slug>/<file>` — a memory, addressed by its path in the repo. */
const MEMORY = /^private\/cards\/([^/]+)\/(.+)$/;

/**
 * The pictures on this card that are filed under some other card's slug.
 *
 * Only that case. A path of any other shape — an external URL, a bare
 * filename, something hand-written — is left alone and reported by
 * `cardRules` as before: this moves pictures between card folders, and it
 * should not be in the business of guessing what anything else meant.
 */
export function strayMedia(card: CardConfig): Relocation[] {
  const moves: Relocation[] = [];

  card.faces?.forEach((face) => {
    if (face.type !== "image") return;
    const match = FACE.exec(face.src?.trim() ?? "");
    if (!match || match[1] === card.slug) return;
    moves.push({
      from: face.src.trim(),
      to: `/cards/${card.slug}/${match[2]}`,
      where: "public",
    });
  });

  card.memories?.forEach((memory) => {
    const src = memory.image?.src?.trim();
    if (!src) return;
    // Tolerate a leading slash: `mediaUrl` strips them, so a config that has
    // picked one up still resolves, and should still be relocated.
    const match = MEMORY.exec(src.replace(/^\/+/, ""));
    if (!match || match[1] === card.slug) return;
    moves.push({
      from: src,
      to: `private/cards/${card.slug}/${match[2]}`,
      where: "private",
    });
  });

  return moves;
}

/**
 * The card with every stray picture repointed at its own folder.
 *
 * Returns the moves as well, because the caller has to copy the files before
 * the new paths mean anything. A card with nothing stray is returned
 * unchanged — the same object, so a save that changes nothing writes nothing
 * new.
 */
export function rehomeCard(card: CardConfig): { card: CardConfig; moved: Relocation[] } {
  const moved = strayMedia(card);
  if (moved.length === 0) return { card, moved };

  const to = new Map(moved.map((move) => [move.from, move.to]));

  return {
    card: {
      ...card,
      faces: card.faces?.map((face) =>
        face.type === "image" && to.has(face.src.trim())
          ? { ...face, src: to.get(face.src.trim())! }
          : face,
      ) as CardConfig["faces"],
      memories: card.memories?.map((memory) => {
        const src = memory.image?.src?.trim();
        return src && to.has(src)
          ? { ...memory, image: { ...memory.image!, src: to.get(src)! } }
          : memory;
      }),
    },
    moved,
  };
}

/** Every card, rehomed. */
export function rehomeCards(cards: CardConfig[]): {
  cards: CardConfig[];
  moved: Relocation[];
} {
  const moved: Relocation[] = [];
  const out = cards.map((card) => {
    const result = rehomeCard(card);
    moved.push(...result.moved);
    return result.card;
  });
  return { cards: out, moved };
}

/** Where a config path lives on disk, relative to the project root. */
export function diskPath(path: string, where: "public" | "private"): string {
  const clean = path.replace(/^\/+/, "");
  return where === "public" ? `public/${clean}` : clean;
}
