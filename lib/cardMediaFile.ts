import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { diskPath, type Relocation } from "./cardMedia.ts";

/**
 * The file half of `lib/cardMedia.ts`: putting the pictures where the rewritten
 * paths now say they are.
 *
 * Copy, never move. The card it came from may still be in the config and
 * still using it — that is exactly the case when someone starts a new card by
 * copying the sample — and taking the file would break the one that was
 * working to fix the one that was not. Disk is cheap; a photograph nobody
 * kept a second copy of is not.
 *
 * Development only, like everything else the editor touches.
 */

export type Copied = { from: string; to: string; done: boolean; why?: string };

export function carryMedia(moves: Relocation[], root = process.cwd()): Copied[] {
  return moves.map((move) => {
    const from = join(root, diskPath(move.from, move.where));
    // Every picture lands in the card's private folder (see `Relocation`).
    const to = join(root, diskPath(move.to, "private"));

    if (!existsSync(from)) {
      // The path was already wrong before this, or the file has been deleted.
      // `cardRules` reports it; there is nothing here to carry.
      return { from: move.from, to: move.to, done: false, why: "no such file" };
    }
    if (existsSync(to)) {
      // Already carried, on an earlier save. Nothing is overwritten: the file
      // that is there is the one the card is now pointing at, and replacing it
      // could silently swap one photograph for another.
      return { from: move.from, to: move.to, done: true, why: "already there" };
    }

    try {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
      return { from: move.from, to: move.to, done: true };
    } catch (cause) {
      return { from: move.from, to: move.to, done: false, why: String(cause) };
    }
  });
}
