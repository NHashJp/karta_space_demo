"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";

type Props = {
  title: string;
  /**
   * Where it sits over the scene.
   *
   * `bottom` is the default and what the crossroads uses (mockup M14a): the
   * sky is the subject, so the panel keeps to the floor. A panel with a form
   * in it sits `high` instead (M8a) — the planet's lit limb comes up into the
   * bottom-right corner, and on a phone the keyboard takes the rest.
   */
  place?: "bottom" | "high";
  /**
   * A hairline under the label. The form panels carry one and the choice
   * panels do not: a form really is two things, the asking and the fields,
   * and the rule is what stops the prompt reading as the first field's label.
   */
  divided?: boolean;
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
export function Panel({ title, place = "bottom", divided = false, onClose, children }: Props) {
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
      data-place={place}
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
            <CloseIcon />
          </button>
        </div>
        {divided ? <div className="panel__rule" aria-hidden="true" /> : null}
        {children}
      </div>
    </div>
  );
}
