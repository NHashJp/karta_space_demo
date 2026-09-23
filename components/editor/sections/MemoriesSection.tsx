"use client";

import { useState } from "react";
import { FuzzyDateInput } from "../FuzzyDateInput";
import type { SectionProps } from "../shared";
import { MEMORY_CAPTION_MAX, MEMORY_MAX, MEMORY_TITLE_MAX } from "@/lib/cardRules";
import { sortMemoriesNewestFirst } from "@/lib/fuzzyDate";
import type { Memory } from "@/types/card";

/**
 * The trail (spec v0.2 §15.4).
 *
 * Shown in **display order** — newest first — rather than in the order they
 * happen to sit in the config, because that is the order the receiver will
 * travel them. Editing a list in one order and having it read back in another
 * is how you end up with a trail that surprises the person who wrote it.
 */
export function MemoriesSection({ card, edit }: SectionProps) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const memories = card.memories ?? [];
  // Sorted for display, but edits are written back to the original indices, so
  // the config keeps whatever order it had.
  const ordered = sortMemoriesNewestFirst(
    memories.map((memory, index) => ({ ...memory, __index: index })),
  ) as (Memory & { __index: number })[];

  function setMemory(index: number, patch: Partial<Memory>) {
    edit({
      memories: memories.map((memory, i) => {
        if (i !== index) return memory;
        const next = { ...memory, ...patch };
        // Undefined values should disappear from the config, not sit in it.
        for (const key of Object.keys(next) as (keyof Memory)[]) {
          if (next[key] === undefined || next[key] === "") delete next[key];
        }
        return next;
      }),
    });
  }

  async function upload(index: number, file: File) {
    setUploading(index);
    setNotice(null);

    const form = new FormData();
    form.set("slug", card.slug);
    form.set("file", file);

    const response = await fetch("/api/editor/upload", { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as {
      src?: string;
      bytes?: number;
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
            : "Could not save that file.",
      );
      return;
    }

    setMemory(index, {
      image: {
        src: payload.src,
        alt: memories[index].image?.alt ?? "",
        fit: memories[index].image?.fit ?? "cover",
      },
    });

    if (payload.large) {
      // A note rather than a refusal: it is their photograph, and the cost is
      // a slower trail rather than a broken one.
      setNotice(
        `Saved, but it is ${Math.round((payload.bytes ?? 0) / 1024)} KB. ` +
          "Under 350 KB keeps the trail quick — try WebP, or 1600px on the long edge.",
      );
    }
  }

  return (
    <div className="editor__section">
      <p className="editor__hint">
        Read newest first, as a journey backwards in time. Up to {MEMORY_MAX}.
        Photographs live in private/cards/{card.slug}/ and are only served to
        someone who can open the card.
      </p>

      {notice ? <p className="editor__problem">{notice}</p> : null}

      {ordered.map((memory) => {
        const index = memory.__index;
        return (
          <div className="face" key={index}>
            <div className="face__head">
              <strong lang="ja">{memory.title || "(untitled)"}</strong>
              <button
                className="face__type"
                onClick={() =>
                  edit({ memories: memories.filter((_, i) => i !== index) })
                }
              >
                Remove
              </button>
            </div>

            <div className="editor__row">
              <label className="field">
                <span>
                  Title &middot; {memory.title.length}/{MEMORY_TITLE_MAX}
                </span>
                <input
                  value={memory.title}
                  onChange={(event) => setMemory(index, { title: event.target.value })}
                  lang="ja"
                />
              </label>

              <div className="field">
                <FuzzyDateInput
                  value={memory.date}
                  approx={memory.approx}
                  season={memory.season}
                  onChange={(next) =>
                    setMemory(index, {
                      date: next.date ?? memory.date,
                      approx: next.approx,
                      season: next.season,
                    })
                  }
                />
              </div>
            </div>

            <label className="field">
              <span>
                Caption &middot; {(memory.caption ?? "").length}/{MEMORY_CAPTION_MAX}
              </span>
              <input
                value={memory.caption ?? ""}
                onChange={(event) => setMemory(index, { caption: event.target.value })}
                lang="ja"
              />
            </label>

            <div className="editor__row">
              <label className="field">
                <span>Photograph</span>
                <input
                  type="file"
                  accept="image/webp,image/jpeg,image/png,image/avif"
                  disabled={uploading === index}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(index, file);
                  }}
                />
                <span className="editor__hint">
                  {uploading === index
                    ? "Saving…"
                    : (memory.image?.src ?? "None — this memory will show as words alone.")}
                </span>
              </label>

              {memory.image ? (
                <label className="field">
                  <span>Alt text</span>
                  <input
                    value={memory.image.alt}
                    onChange={(event) =>
                      setMemory(index, { image: { ...memory.image!, alt: event.target.value } })
                    }
                    lang="ja"
                  />
                </label>
              ) : null}
            </div>
          </div>
        );
      })}

      <button
        className="button button--ghost"
        disabled={memories.length >= MEMORY_MAX}
        onClick={() =>
          edit({
            memories: [
              ...memories,
              { title: "", date: String(new Date().getFullYear()) },
            ],
          })
        }
      >
        + Add memory
      </button>
    </div>
  );
}
