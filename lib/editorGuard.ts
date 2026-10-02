import { NextResponse } from "next/server";
import { hasEditorAccess } from "./editorAccess.ts";

/**
 * Every editor route refuses in production (spec v0.2 §15.1, §15.7).
 *
 * Two separate reasons, either one sufficient:
 *
 * - a deployed filesystem is read-only, so a save could not work anyway;
 * - an unauthenticated write endpoint on a public deployment would let anyone
 *   rewrite every card on it, upload files into the repository, and read back
 *   whether any given slug exists.
 *
 * It lives in one place so a new editor route cannot be added without it —
 * forgetting this guard on one route is exactly the kind of mistake that is
 * invisible in development, which is the only place it is ever tested.
 */
export const editorEnabled = process.env.NODE_ENV !== "production";

export function refused() {
  return NextResponse.json({ error: "editor_disabled" }, { status: 403 });
}

export function locked() {
  return NextResponse.json({ error: "editor_locked" }, { status: 401 });
}

/**
 * The one line every editor route begins with: disabled in production, and
 * locked behind `EDITOR_PASSWORD` when one is set.
 *
 * Returns the refusal to send, or null to carry on. A function rather than a
 * boolean because the two failures are different — a route that is off is a
 * 403 and a route that is waiting for a password is a 401, and the editor's
 * own fetches need to tell them apart to know whether to show the gate.
 */
export async function editorDenied(): Promise<NextResponse | null> {
  if (!editorEnabled) return refused();
  if (!(await hasEditorAccess())) return locked();
  return null;
}

/** Slugs are used to build paths, so they are checked before anything else. */
export function safeSlug(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(value) ? value : null;
}
