import { readFile, stat } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { canView } from "@/lib/access";
import { getCardBySlug } from "@/lib/cards";

/**
 * A card's memory photographs (spec v0.2 §14.3).
 *
 * These are the one part of a card that is genuinely personal — photographs of
 * two people, not written text about them — and in v0.1 anything in `/public`
 * was fetchable by anyone who knew the path, password or no password. So they
 * live in `private/cards/<slug>/` instead, outside the served directory, and
 * come through here behind the same `canView` gate as the card itself.
 *
 * The route lives under `/c/[slug]/` because that is where the access cookie
 * is scoped. Anywhere else and the browser would not send it.
 */

export const dynamic = "force-dynamic";

/** Only these, and the list is deliberately short. */
const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
};

/**
 * Resolved once, at module scope. The build's tracer reads the literal and can
 * see which directory this route reaches into; computing it per request left
 * it tracing the whole project instead.
 */
const MEDIA_ROOT = resolve(process.cwd(), "private/cards");

type Params = { params: Promise<{ slug: string; path: string[] }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug, path } = await params;

  if (!getCardBySlug(slug)) return notFound();
  if (!(await canView(slug))) return notFound();

  const relative = path.join("/");

  // Three separate ways out of the folder, all closed before touching the
  // disk: traversal, an absolute path, and a leading slash that `join` would
  // otherwise swallow silently.
  if (relative.includes("..") || relative.startsWith("/") || /^[a-zA-Z]:/.test(relative)) {
    return notFound();
  }

  const extension = relative.slice(relative.lastIndexOf(".")).toLowerCase();
  const type = TYPES[extension];
  if (!type) return notFound();

  // Absolute, so the guard below compares two real paths rather than two
  // strings that happen to look like paths.
  const folder = join(MEDIA_ROOT, slug);
  const file = normalize(join(folder, relative));

  // And a final check on the resolved path, because normalisation is the step
  // that turns a clever relative path into a real one.
  if (!file.startsWith(`${folder}${sep}`)) return notFound();

  try {
    const info = await stat(file);
    if (!info.isFile()) return notFound();
    const body = await readFile(file);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        // Private, because this is behind an access check: a shared cache must
        // not hold a photograph fetched with someone else's cookie.
        "Cache-Control": "private, max-age=86400",
        "Content-Length": String(info.size),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}

/**
 * One response for every refusal. A missing file, a wrong extension and a
 * card the reader cannot see are all "not found" — anything more specific
 * would let someone map the folder from outside.
 */
function notFound() {
  return new NextResponse("Not found", { status: 404 });
}
