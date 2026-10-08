import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { editorDenied, safeSlug } from "@/lib/editorGuard";

/**
 * Adding a picture to a card (spec v0.2 §15.7).
 *
 * One destination for every picture: `private/cards/<slug>/`, served only
 * through the gated media route (§14.3). Memory photographs always went
 * there; cube faces used to go to `public/cards/<slug>/`, where anyone who
 * knew or guessed the URL could fetch them without the card's password. A
 * picture on the cube is as personal as the words beside it.
 *
 * Nothing is ever overwritten. A sender who uploads two different photographs
 * that happen to be called `IMG_0042.jpg` should end up with two photographs,
 * not one — silently replacing the first would lose it with no way back.
 */

const TYPES: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/avif": ".avif",
};

/** Above this, verify only notes it — but the editor can say so at upload time. */
const WARN_BYTES = 350 * 1024;
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = await editorDenied();
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const slug = safeSlug(form.get("slug"));
  const file = form.get("file");
  if (!slug || !(file instanceof File)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  /*
   * Always private: faces and memories alike go to `private/cards/<slug>/`
   * and are served only through the gated media route. Faces used to go to
   * `public/`, where anyone with the URL could fetch them without the
   * password.
   */

  const extension = TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const folder = join(process.cwd(), "private", "cards", slug);
  mkdirSync(folder, { recursive: true });

  const name = uniqueName(folder, sanitise(file.name, extension));
  writeFileSync(join(folder, name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    ok: true,
    // The path in the repository; `toClientCard` turns it into the gated URL.
    src: `private/cards/${slug}/${name}`,
    bytes: file.size,
    large: file.size > WARN_BYTES,
  });
}

/**
 * A filename from a phone can be anything at all, and this one becomes a path
 * segment. Everything but letters, digits, dots and dashes goes.
 */
function sanitise(name: string, extension: string): string {
  const base = name
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 48);
  return `${base || "photo"}${extension}`;
}

function uniqueName(folder: string, name: string): string {
  if (!existsSync(join(folder, name))) return name;
  const dot = name.lastIndexOf(".");
  const base = name.slice(0, dot);
  const extension = name.slice(dot);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}${extension}`;
    if (!existsSync(join(folder, candidate))) return candidate;
  }
  return `${base}-${Date.now()}${extension}`;
}
