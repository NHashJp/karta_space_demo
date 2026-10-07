"use client";

import { useState } from "react";
import { emptyTextFace, type SectionProps } from "../shared";
import { BODY_MAX, BODY_MIN, LINE_FACE_MAX, imageFolder } from "@/lib/cardRules";
import type { CardFace, CardFaces } from "@/types/card";

/**
 * The six faces (spec v0.2 §15.4).
 *
 * The arc hint is the most useful thing on this screen and the least
 * technical: most people asked to write six short things freeze, and 挨拶 →
 * 思い出 → 感謝 → 言えなかったこと → 願い → ひとこと unfreezes them. It is a
 * suggestion from someone who has written one before, never enforced.
 */
export function FacesSection({
  card,
  edit,
  images,
}: SectionProps & { images: string[] }) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function setFace(index: number, face: CardFace) {
    const faces = card.faces.map((existing, i) =>
      i === index ? face : existing,
    ) as unknown as CardFaces;
    edit({ faces });
  }

  /*
   * Upload straight onto a face (§15.7).
   *
   * There was no way to do this: the section offered a dropdown of files
   * already in `public/cards/<slug>/` and a box to type a path into, so
   * putting a picture on a face meant leaving the editor, copying a file into
   * the right folder by hand, and coming back. Memories have had a file input
   * all along; faces simply never got one.
   *
   * `to: "public"` is the difference between the two. A face is part of the
   * card and is fetched as a texture; a memory photograph is private and goes
   * through the gated media route.
   */
  async function upload(index: number, face: CardFace, file: File) {
    setUploading(index);
    setNotice(null);

    const form = new FormData();
    form.set("slug", card.slug);
    form.set("to", "public");
    form.set("file", file);

    try {
      const response = await fetch("/api/editor/upload", { method: "POST", body: form });
      const payload = (await response.json().catch(() => ({}))) as {
        src?: string;
        large?: boolean;
        error?: string;
      };
      setUploading(null);

      if (!response.ok || !payload.src) {
        setNotice(
          payload.error === "unsupported_type"
            ? "Only WebP, JPEG, PNG and AVIF images."
            : payload.error === "too_large"
              ? "That file is over 8 MB."
              : payload.error === "editor_locked"
                ? "The editor was locked. Reload and unlock it."
                : "Could not save that file.",
        );
        return;
      }

      setFace(index, {
        type: "image",
        src: payload.src,
        alt: face.type === "image" ? face.alt : "",
        fit: face.type === "image" ? face.fit : "cover",
      });
      // A face fills the frame, so an oversized texture costs every visitor.
      if (payload.large) setNotice("Saved — over 350 KB, so worth compressing.");
    } catch {
      setUploading(null);
      setNotice("Could not save that file.");
    }
  }

  return (
    <div className="editor__section">
      {notice ? (
        <p className="editor__problem" role="status">
          {notice}
        </p>
      ) : null}

      {card.faces.map((face, index) => {
        const isLine = face.type === "text" && face.style === "line";
        const chars = face.type === "text" ? face.body.length : 0;
        const min = isLine ? 1 : BODY_MIN;
        const max = isLine ? LINE_FACE_MAX : BODY_MAX;

        /*
         * The list of files comes from the server and is fixed until the page
         * reloads, so a picture uploaded a moment ago is not in it — and a
         * `<select>` whose value is not among its options renders blank. The
         * face's own `src` is therefore always offered, whether or not the
         * listing has caught up with it.
         */
        const choices =
          face.type === "image" && face.src && !images.includes(face.src)
            ? [face.src, ...images]
            : images;

        return (
          <div className="face" key={index}>
            <div className="face__head">
              <strong>
                {String(index + 1).padStart(2, "0")}
              </strong>

              <div className="face__types">
                <button
                  className="face__type"
                  aria-pressed={face.type === "text" && !isLine}
                  onClick={() =>
                    setFace(index, {
                      type: "text",
                      body: face.type === "text" ? face.body : "",
                    })
                  }
                >
                  Paragraph
                </button>
                <button
                  className="face__type"
                  aria-pressed={isLine}
                  onClick={() =>
                    setFace(index, {
                      type: "text",
                      style: "line",
                      body: face.type === "text" ? face.body : "",
                    })
                  }
                >
                  Line
                </button>
                <button
                  className="face__type"
                  aria-pressed={face.type === "image"}
                  onClick={() =>
                    setFace(index, {
                      type: "image",
                      src: face.type === "image" ? face.src : (images[0] ?? ""),
                      alt: face.type === "image" ? face.alt : "",
                      fit: "cover",
                    })
                  }
                >
                  Image
                </button>
              </div>
            </div>

            {face.type === "text" ? (
              <>
                <textarea
                  value={face.body}
                  rows={isLine ? 2 : 5}
                  onChange={(event) =>
                    setFace(index, { ...face, body: event.target.value })
                  }
                  lang="ja"
                />
                <span
                  className="editor__hint"
                  data-warn={chars > 0 && (chars < min || chars > max)}
                >
                  {chars} / {min}–{max} characters
                  {isLine ? " · set large and centred, a beat rather than a paragraph" : ""}
                </span>
              </>
            ) : (
              <div className="editor__row">
                <label className="field">
                  <span>Image</span>
                  {choices.length > 0 ? (
                    <select
                      value={face.src}
                      onChange={(event) => setFace(index, { ...face, src: event.target.value })}
                    >
                      <option value="">(choose)</option>
                      {choices.map((src) => (
                        <option key={src} value={src}>
                          {src.replace(imageFolder(card.slug), "")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={face.src}
                      onChange={(event) => setFace(index, { ...face, src: event.target.value })}
                      placeholder={`${imageFolder(card.slug)}image.png`}
                      spellCheck={false}
                    />
                  )}
                  <span className="editor__hint">
                    Cube-face images live in public{imageFolder(card.slug)}
                  </span>
                </label>

                <label className="field">
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/webp,image/jpeg,image/png,image/avif"
                    disabled={uploading === index}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(index, face, file);
                      // Let the same file be chosen again after a failure.
                      event.target.value = "";
                    }}
                  />
                  <span className="editor__hint">
                    {uploading === index ? "Saving…" : `Saved into public${imageFolder(card.slug)}`}
                  </span>
                </label>

                <label className="field">
                  <span>Alt text</span>
                  <input
                    value={face.alt}
                    onChange={(event) => setFace(index, { ...face, alt: event.target.value })}
                    lang="ja"
                  />
                  <span className="editor__hint">
                    Read aloud in place of the image, so describe what it shows.
                  </span>
                </label>
              </div>
            )}
          </div>
        );
      })}

      <button
        className="button button--ghost"
        onClick={() =>
          edit({ faces: Array.from({ length: 6 }, emptyTextFace) as unknown as CardFaces })
        }
      >
        Clear all six
      </button>
    </div>
  );
}
