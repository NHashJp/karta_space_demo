"use client";

import { Component, type ReactNode } from "react";

/**
 * A photograph that fails to load must not take the scene with it.
 *
 * `useTexture` suspends while loading — which is what the shimmer fallback is
 * for — but on a *failed* load it throws, and a throw inside a Canvas with no
 * boundary unmounts the whole 3D scene. A memory whose file is missing, or
 * whose fetch is refused, would blank the card.
 *
 * Spec §9.4 is explicit that a memory must never block navigation. So this
 * catches the failure and renders the same shimmer the loading state uses: the
 * reader sees a frame with no picture in it, and can walk straight past.
 */
export class SafeTexture extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Worth a line in development — a missing photograph is a card that was
    // configured wrong, and silence would hide that from whoever wrote it.
    if (process.env.NODE_ENV !== "production") {
      console.warn("A memory photograph could not be loaded:", error);
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
