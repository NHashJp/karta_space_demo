import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The plaintext passwords, on the sender's own machine only (spec v0.2 §14.9).
 *
 * `config/cards.config.ts` carries a scrypt hash, which is safe to commit and
 * useless for showing anyone their password again. But the Share tab has to be
 * able to say "this card's password is K7QM-2XPA" a week later, so the
 * plaintext lives here — in `.karta/`, which is gitignored.
 *
 * The consequence is stated in the editor rather than hidden: on a different
 * computer the Share tab cannot show the password, and offers to issue a new
 * one instead. That is the honest behaviour for a file that is deliberately
 * not shared.
 */

const FOLDER = join(process.cwd(), ".karta");
const PATH = join(FOLDER, "secrets.local.json");

export type Secrets = Record<string, string>;

export function readSecrets(): Secrets {
  try {
    if (!existsSync(PATH)) return {};
    const parsed = JSON.parse(readFileSync(PATH, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, value]) => typeof value === "string",
      ),
    ) as Secrets;
  } catch {
    // A corrupt file is not worth failing a save over; it holds convenience,
    // not truth. The hashes in the config are what actually gate a card.
    return {};
  }
}

/** Written whole, and pruned to the slugs that still exist. */
export function writeSecrets(secrets: Secrets, keepSlugs: string[]): void {
  const keep = new Set(keepSlugs);
  const pruned = Object.fromEntries(
    Object.entries(secrets).filter(([slug, value]) => keep.has(slug) && value),
  );

  mkdirSync(FOLDER, { recursive: true });
  writeFileSync(PATH, `${JSON.stringify(pruned, null, 2)}\n`, "utf8");
}
