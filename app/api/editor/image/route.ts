import { readFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { editorDenied } from "@/lib/editorGuard";

/**
 * A picture for the editor's own thumbnails.
 *
 * The card's media route (`/c/<slug>/media/…`) cannot serve these: it answers
 * only for a card that is already saved, and only to someone holding that
 * card's access cookie, so a picture uploaded a moment ago into an unsaved
 * card showed nowhere until the preview reloaded. This one is behind the
 * editor's guard instead — off in production, locked by `EDITOR_PASSWORD` —
 * and reads only from `private/cards/`.
 */

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
};

const MEDIA_ROOT = resolve(process.cwd(), "private/cards");
const SRC = /^private\/cards\/([a-z0-9][a-z0-9-]{1,63})\/([^/]+)$/;

export async function GET(request: Request) {
  const denied = await editorDenied();
  if (denied) return denied;

  const src = new URL(request.url).searchParams.get("src") ?? "";
  const match = SRC.exec(src);
  if (!match || match[2].includes("..")) return notFound();

  const type = TYPES[match[2].slice(match[2].lastIndexOf(".")).toLowerCase()];
  if (!type) return notFound();

  const folder = join(MEDIA_ROOT, match[1]);
  const file = normalize(join(folder, match[2]));
  if (!file.startsWith(`${folder}${sep}`)) return notFound();

  try {
    const body = await readFile(file);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}

function notFound() {
  return new NextResponse(null, { status: 404 });
}
