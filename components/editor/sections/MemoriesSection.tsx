"use client";

import { useState } from "react";
import { FuzzyDateInput } from "../FuzzyDateInput";
import type { SectionProps } from "../shared";
import { UPLOAD_ACCEPT, thumbUrl, uploadImage } from "../uploadImage";
import { RichField } from "../FormatBar";
import { plainText } from "@/lib/richText";
import { MEMORY_CAPTION_MAX, MEMORY_MAX, MEMORY_TITLE_MAX } from "@/lib/cardRules";
import { orderMemories, sortMemoriesNewestFirst } from "@/lib/fuzzyDate";
import type { Memory } from "@/types/card";

/**
 * The trail (spec v0.2 §15.4).
 *
 * Shown in **display order** — by date, or the sender's own order once they
 * have dragged one — rather than in the order they happen to sit in the
 * config, because that is the order the receiver will
 * travel them. Editing a list in one order and having it read back in another
 * is how you end up with a trail that surprises the person who wrote it.
 */
export function MemoriesSection({ card, edit }: SectionProps) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const memories = card.memories ?? [];
  const manual = card.memoryOrder === "manual";
  // In the trail's order, but edits are written back to the original indices,
  // so a date-ordered config keeps whatever order it had.
  const ordered = orderMemories(
    memories.map((memory, index) => ({ ...memory, __index: index })),
    card.memoryOrder,
  ) as (Memory & { __index: number })[];

  /** Positions in `ordered`: the memory being dragged, and the one under it. */
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  /**
   * Move the memory at display position `from` to `to`. The list is written
   * back in exactly the order shown, and the card switches to its own order —
   * the trail now follows the list rather than the dates.
   */
  function arrange(from: number, to: number) {
    if (from === to || to < 0 || to >= ordered.length) return;
    const list = ordered.map(({ __index: _, ...memory }) => memory as Memory);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    edit({ memories: list, memoryOrder: "manual" });
  }

  /** Back to newest first by date — a month alone counts as its 15th. */
  function sortByDate() {
    edit({ memories: sortMemoriesNewestFirst(memories), memoryOrder: undefined });
    setNotice(null);
  }

  function endDrag() {
    setDragging(null);
    setOver(null);
  }

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
    const result = await uploadImage(card.slug, file);
    setUploading(null);

    if ("error" in result) {
      setNotice(result.error);
      return;
    }

    setMemory(index, {
      image: {
        src: result.src,
        alt: memories[index].image?.alt ?? "",
        fit: memories[index].image?.fit ?? "cover",
      },
    });

    if (result.large) {
      // A note rather than a refusal: it is their photograph, and the cost is
      // a slower trail rather than a broken one.
      setNotice(
        `Saved, but it is ${Math.round(result.bytes / 1024)} KB. ` +
          "Under 350 KB keeps the trail quick — try WebP, or 1600px on the long edge.",
      );
    } else if (result.converted) {
      setNotice("Converted to JPEG and saved.");
    }
  }

  return (
    <div className="editor__section">
      <p className="editor__hint">
        Read from the top, as a journey backwards in time. Up to {MEMORY_MAX}.
        Photographs live in private/cards/{card.slug}/ and are only served to
        someone who can open the card.
      </p>

      {notice ? <p className="editor__problem">{notice}</p> : null}

      {memories.length > 1 ? (
        <div className="memories__order">
          <span className="editor__hint">
            {manual
              ? "In your own order — the trail follows this list exactly. Drag by ⠿ or use ↑ ↓."
              : "By date, newest first (a month alone counts as the 15th). Drag by ⠿ or use ↑ ↓ to set your own order."}
          </span>
          <button className="face__type" onClick={sortByDate} disabled={uploading !== null}>
            Sort by date
          </button>
        </div>
      ) : null}

      {ordered.map((memory, position) => {
        const index = memory.__index;
        return (
          <div
            className="face"
            key={index}
            data-dragging={dragging === position}
            data-over={over === position && dragging !== null && dragging !== position}
            onDragOver={(event) => {
              if (dragging === null) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (over !== position) setOver(position);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragging !== null) arrange(dragging, position);
              endDrag();
            }}
          >
            <div className="face__head">
              {/*
                Only the handle drags — the fields stay selectable — but the
                picture under the pointer is the whole memory.
              */}
              <span
                className="memory__handle"
                aria-hidden="true"
                title="Drag to reorder"
                draggable={uploading === null}
                onDragStart={(event) => {
                  setDragging(position);
                  event.dataTransfer.effectAllowed = "move";
                  // Firefox will not start a drag without some data.
                  event.dataTransfer.setData("text/plain", String(position));
                  const card = event.currentTarget.closest(".face");
                  if (card) event.dataTransfer.setDragImage(card, 24, 24);
                }}
                onDragEnd={endDrag}
              >
                ⠿
              </span>
              <strong lang="ja">{memory.title || "(untitled)"}</strong>
              <span className="memory__moves">
                <button
                  className="face__type"
                  aria-label={`Move “${memory.title || "untitled"}” up`}
                  disabled={position === 0 || uploading !== null}
                  onClick={() => arrange(position, position - 1)}
                >
                  ↑
                </button>
                <button
                  className="face__type"
                  aria-label={`Move “${memory.title || "untitled"}” down`}
                  disabled={position === ordered.length - 1 || uploading !== null}
                  onClick={() => arrange(position, position + 1)}
                >
                  ↓
                </button>
              </span>
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

            <div className="field">
              <span>
                Caption &middot; {plainText(memory.caption ?? "").length}/{MEMORY_CAPTION_MAX}
              </span>
              <RichField
                multiline
                rows={2}
                label="Caption"
                value={memory.caption ?? ""}
                onChange={(caption) => setMemory(index, { caption })}
                lang="ja"
              />
            </div>

            <div className="editor__row">
              <label className="field">
                <span>Photograph</span>
                <input
                  type="file"
                  accept={UPLOAD_ACCEPT}
                  disabled={uploading === index}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(index, file);
                    // Let the same file be chosen again after a failure.
                    event.target.value = "";
                  }}
                />
                <span className="editor__hint">
                  {uploading === index
                    ? "Saving…"
                    : (memory.image?.src ?? "None — this memory will show as words alone.")}
                </span>
              </label>

              {memory.image?.src ? (
                <img className="editor__thumb" src={thumbUrl(memory.image.src)} alt="" />
              ) : null}

              {/*
                Detaching takes the photograph off this memory only. The file
                stays in the card's folder — another memory or a face may use
                it, and an upload is not something to lose to a misclick — and
                nothing changes on disk until Save to file.
              */}
              {memory.image ? (
                <button
                  className="face__type"
                  disabled={uploading === index}
                  onClick={() => {
                    setMemory(index, { image: undefined });
                    setNotice(
                      `Photo detached from “${memory.title || "(untitled)"}” — Save to file to keep the change. The file stays in private/cards/${card.slug}/.`,
                    );
                  }}
                >
                  Detach photo
                </button>
              ) : null}

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
