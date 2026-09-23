"use client";

import { FACE_ARC, emptyTextFace, type SectionProps } from "../shared";
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
  function setFace(index: number, face: CardFace) {
    const faces = card.faces.map((existing, i) =>
      i === index ? face : existing,
    ) as unknown as CardFaces;
    edit({ faces });
  }

  return (
    <div className="editor__section">
      {card.faces.map((face, index) => {
        const isLine = face.type === "text" && face.style === "line";
        const chars = face.type === "text" ? face.body.length : 0;
        const min = isLine ? 1 : BODY_MIN;
        const max = isLine ? LINE_FACE_MAX : BODY_MAX;

        return (
          <div className="face" key={index}>
            <div className="face__head">
              <strong>
                {String(index + 1).padStart(2, "0")}
                <span className="editor__hint face__arc" lang="ja">
                  {FACE_ARC[index]}
                </span>
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
                  {images.length > 0 ? (
                    <select
                      value={face.src}
                      onChange={(event) => setFace(index, { ...face, src: event.target.value })}
                    >
                      <option value="">(choose)</option>
                      {images.map((src) => (
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
