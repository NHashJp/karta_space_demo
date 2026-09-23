import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { editorEnabled, refused, safeSlug } from "@/lib/editorGuard";

/**
 * Adding a photograph to a card (spec v0.2 §15.7).
 *
 * It lands in `private/cards/<slug>/`, not `public/`, because memory
 * photographs are the one genuinely personal part of a card and are served
 * through the gated media route (§14.3).
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
  if (!editorEnabled) return refused();

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const slug = safeSlug(form.get("slug"));
  const file = form.get("file");
  if (!slug || !(file instanceof File)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const folder = join(process.cwd(), "private", "cards", slug);
  mkdirSync(folder, { recursive: true });

  const name = uniqueName(folder, sanitise(file.name, extension));
  writeFileSync(join(folder, name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    ok: true,
    // The path as the config names it, so the editor can drop it straight in.
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
