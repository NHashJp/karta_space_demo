"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A gesture aimed at a text field is not a gesture at the card. Without this,
 * Space and the arrow keys inside a reply would navigate the letter instead of
 * typing, and scrolling a long message would turn the cube (spec v0.2 §6.4).
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable=\"false\"])"));
}

const WHEEL_THRESHOLD = 50;
const SWIPE_THRESHOLD = 45;
const GESTURE_QUIET_MS = 260;

/**
 * One deliberate gesture = one face. Wheel deltas are accumulated and then
 * held off until the scroll gesture (including trackpad momentum) goes quiet,
 * so a single flick never skips two faces.
 */
export function useFaceNavigation(
  onMove: (direction: 1 | -1) => void,
  locked: boolean,
  enabled = true,
) {
  const move = useRef(onMove);
  move.current = onMove;

  const accumulated = useRef(0);
  const cooling = useRef(false);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<number | null>(null);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (!enabled) return;

    const restartQuietTimer = () => {
      if (quiet.current) clearTimeout(quiet.current);
      quiet.current = setTimeout(() => {
        cooling.current = false;
        accumulated.current = 0;
      }, GESTURE_QUIET_MS);
    };

    const fire = (direction: 1 | -1) => {
      accumulated.current = 0;
      cooling.current = true;
      move.current(direction);
    };

    const onWheel = (event: WheelEvent) => {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      restartQuietTimer();
      if (lockedRef.current || cooling.current) {
        accumulated.current = 0;
        return;
      }
      accumulated.current += event.deltaY;
      if (Math.abs(accumulated.current) >= WHEEL_THRESHOLD) {
        fire(accumulated.current > 0 ? 1 : -1);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStart.current = isTypingTarget(event.target)
        ? null
        : (event.touches[0]?.clientY ?? null);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (isTypingTarget(event.target)) return;
      // Stops iOS rubber-banding and pull-to-refresh from hijacking the swipe.
      event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (start === null || lockedRef.current) return;
      const end = event.changedTouches[0]?.clientY;
      if (end === undefined) return;
      const delta = start - end;
      if (Math.abs(delta) >= SWIPE_THRESHOLD) fire(delta > 0 ? 1 : -1);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const forward = ["ArrowDown", "PageDown"].includes(event.key)
        || (event.key === " " && !event.shiftKey);
      const backward = ["ArrowUp", "PageUp"].includes(event.key)
        || (event.key === " " && event.shiftKey);
      if (!forward && !backward) return;
      event.preventDefault();
      if (lockedRef.current) return;
      fire(forward ? 1 : -1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (quiet.current) clearTimeout(quiet.current);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}

/** Reads and tracks the user's reduced-motion preference. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

/**
 * True once nothing has happened for `delayMs`, false again on the next
 * thing that does (spec v0.2 rev 6).
 *
 * The orbit view has a control that is only discoverable by hovering the
 * satellite, which is not a gesture a phone has — so on a phone the way into
 * the cube was unreachable, and on a desktop it was reachable only by someone
 * who already suspected it was there. Going quiet is the signal that someone
 * has looked at everything obvious, so that is when the card offers it.
 *
 * Reset by anything a reader does, including the gestures the scene itself
 * consumes: a wheel that turns the camera is still the reader being busy.
 * Listeners are passive and on `window`, so none of this interferes with the
 * navigation above.
 */
export function useIdle(delayMs: number): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: number | undefined;

    const wait = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), delayMs);
    };

    const stir = () => {
      // Only a state change when there is one to make: these fire constantly.
      setIdle((was) => (was ? false : was));
      wait();
    };

    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    for (const event of events) {
      window.addEventListener(event, stir, { passive: true });
    }
    wait();

    return () => {
      window.clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, stir);
    };
  }, [delayMs]);

  return idle;
}
