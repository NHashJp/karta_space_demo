"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Signing the card in your own hand (spec v0.2 §15.5).
 *
 * A trackpad signature does not look like a pen signature, and it does not
 * need to. What it needs to be is *yours* — the one mark on the card that a
 * template could not have produced — and the closing screen then draws it
 * stroke by stroke, so it arrives as writing rather than as an image.
 *
 * Pressure is deliberately ignored. Half the devices this runs on do not
 * report it, and a signature whose weight depends on the hardware would look
 * different to the sender than to the receiver.
 */

const WIDTH = 600;
const HEIGHT = 220;
/** Points closer than this are jitter, not intent. */
const MIN_STEP = 1.6;

type Point = { x: number; y: number };

export function SignaturePad({
  slug,
  onSaved,
  onClose,
}: {
  slug: string;
  onSaved: (src: string) => void;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  /** The stroke being drawn right now, held apart so undo is just a slice. */
  const [live, setLive] = useState<Point[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.current!.width = WIDTH * ratio;
    canvas.current!.height = HEIGHT * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.fillStyle = "#05070c";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.strokeStyle = "#e8e9eb";
    context.lineWidth = 2.6;
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const stroke of live ? [...strokes, live] : strokes) {
      context.beginPath();
      stroke.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
    }
  }, [strokes, live]);

  function pointFrom(event: React.PointerEvent): Point {
    const rect = canvas.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  async function save() {
    if (strokes.length === 0) return;
    setSaving(true);

    const response = await fetch("/api/editor/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, strokes }),
    });
    const payload = (await response.json().catch(() => ({}))) as { svg?: string };
    setSaving(false);

    if (payload.svg) {
      // The drawing itself, kept in the card and saved with it — never a
      // public file (see lib/signature.ts).
      onSaved(payload.svg);
      onClose();
    }
  }

  return (
    <div className="pad-layer" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pad" role="dialog" aria-modal="true" aria-label="Draw your signature">
        <canvas
          ref={canvas}
          className="pad__canvas"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          onPointerDown={(event) => {
            (event.target as HTMLElement).setPointerCapture(event.pointerId);
            setLive([pointFrom(event)]);
          }}
          onPointerMove={(event) => {
            setLive((current) => {
              if (!current) return current;
              const point = pointFrom(event);
              const last = current[current.length - 1];
              // Points closer than a pixel or two are the hand shaking, not
              // the hand writing; dropping them is most of the smoothing.
              if (Math.hypot(point.x - last.x, point.y - last.y) < MIN_STEP) return current;
              return [...current, point];
            });
          }}
          onPointerUp={() => {
            setLive((current) => {
              if (current && current.length >= 2) {
                setStrokes((all) => [...all, current]);
              }
              return null;
            });
          }}
        />

        <div className="pad__controls">
          <button
            className="button button--quiet"
            onClick={() => setStrokes((current) => current.slice(0, -1))}
            disabled={strokes.length === 0}
          >
            Undo stroke
          </button>
          <button
            className="button button--quiet"
            onClick={() => setStrokes([])}
            disabled={strokes.length === 0}
          >
            Clear
          </button>
          <button className="button button--quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="button" onClick={save} disabled={saving || strokes.length === 0}>
            {saving ? "Saving…" : "Save signature"}
          </button>
        </div>

        <p className="editor__hint">
          Drawn stroke by stroke on the closing screen, in the order you write
          it. Kept in the card with its words, and shown only behind its
          password.
        </p>
      </div>
    </div>
  );
}
