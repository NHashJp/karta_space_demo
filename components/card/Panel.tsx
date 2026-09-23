"use client";

import { useEffect, useRef } from "react";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * The glass panel every orbit panel is built in (spec v0.2 §8.4, §10.2, §11.3).
 *
 * It owns the three ways out that the spec asks for — the ✕, Escape, and
 * tapping the space around it — so each panel has one fewer thing to get
 * right, and none of them can forget one. The reducer ignores `move` while a
 * panel is open, so these really are the only ways out.
 */
export function Panel({ title, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus moves into the panel so the keyboard follows the eye, and Escape
  // reaches the handler above even when the pointer never moved.
  useEffect(() => {
    panel.current?.focus();
  }, []);

  return (
    <div
      className="panel-layer"
      // Tapping the empty space around the panel closes it; tapping the panel
      // itself must not, so the check is on the target rather than the bubble.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
      >
        <div className="panel__head">
          <h2 className="panel__title" lang="ja">
            {title}
          </h2>
          <button className="panel__close" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
