/**
 * Putting a picture into a card's private folder, for the faces and the
 * memories alike — one path, so the two never disagree about what is allowed.
 */

const SERVED = ["image/webp", "image/jpeg", "image/png", "image/avif"];

/**
 * What the file picker offers. HEIC is listed even though the server does not
 * take it: it is what an iPhone and the Mac's Photos hand over, and leaving it
 * out greys those pictures out in the picker with no word as to why.
 */
export const UPLOAD_ACCEPT = [...SERVED, "image/heic", "image/heif", ".heic", ".heif"].join(",");

/** Longest edge of a converted picture; well past anything the cube shows. */
const CONVERTED_EDGE = 2400;

/** The editor's own view of a picture in `private/cards/` (see `/api/editor/image`). */
export function thumbUrl(src: string): string {
  return `/api/editor/image?src=${encodeURIComponent(src)}`;
}

export type Uploaded = { src: string; bytes: number; large: boolean; converted: boolean };

export async function uploadImage(slug: string, original: File): Promise<Uploaded | { error: string }> {
  let file = original;
  let converted = false;

  if (!SERVED.includes(file.type)) {
    const jpeg = await toJpeg(file);
    if (!jpeg) {
      return {
        error: isHeic(file)
          ? "This browser cannot read HEIC photos. Open the editor in Safari, or export the photo as JPEG first."
          : "Only WebP, JPEG, PNG and AVIF images.",
      };
    }
    file = jpeg;
    converted = true;
  }

  const form = new FormData();
  form.set("slug", slug);
  form.set("file", file);

  try {
    const response = await fetch("/api/editor/upload", { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as {
      src?: string;
      bytes?: number;
      large?: boolean;
      error?: string;
    };
    if (response.ok && payload.src) {
      return { src: payload.src, bytes: payload.bytes ?? file.size, large: Boolean(payload.large), converted };
    }
    return {
      error:
        payload.error === "unsupported_type"
          ? "Only WebP, JPEG, PNG and AVIF images."
          : payload.error === "too_large"
            ? "That file is over 8 MB."
            : payload.error === "editor_locked"
              ? "The editor was locked. Reload and unlock it."
              : "Could not save that file.",
    };
  } catch {
    return { error: "Could not save that file." };
  }
}

function isHeic(file: File): boolean {
  return /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/**
 * Decode whatever the browser can read (Safari reads HEIC) and re-encode it
 * as JPEG. Null when the browser cannot decode it either.
 */
async function toJpeg(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, CONVERTED_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.88));
    if (!blob) return null;
    const name = file.name.replace(/\.[^.]*$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return null;
  }
}
