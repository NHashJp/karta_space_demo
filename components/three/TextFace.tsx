"use client";

import { scriptLang, visualLength } from "@/lib/i18n";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useState } from "react";
import type { TextFace as TextFaceData } from "@/types/card";
import { FlatHtml } from "./FlatHtml";
import { PANEL_WORLD, fitFontSize, fitLineFaceSize, textPanelPx } from "./framing";

type Props = {
  face: TextFaceData;
  /** Face-local transform placing this plane on one side of the cube. */
  position: [number, number, number];
  rotation: [number, number, number];
  visible: boolean;
  index: number;
};

/**
 * Japanese paragraph text is real DOM over the cube face (spec §12) — sharper
 * type, proper line breaking, and readable by assistive tech. It is shown only
 * while the face is square-on, so it is laid flat on the screen (`FlatHtml`).
 */
export function TextFace({ face, position, rotation, visible, index }: Props) {
  const size = useThree((state) => state.size);
  const panelPx = textPanelPx(size.width, size.height);
  const isLine = face.style === "line";
  // Type is fitted to the face, so a longer message sets smaller rather than
  // spilling past the cube edge. A `line` face is fitted to land as a beat
  // instead (spec v0.2 §13.2).
  const fontPx = isLine
    ? fitLineFaceSize(panelPx, visualLength(face.body))
    : fitFontSize(panelPx, visualLength(face.body));
  const fitted = useFittedSize(fontPx, visible);

  return (
    <group position={position} rotation={rotation}>
      {/* Translucent panel behind the text, for contrast against the scene. */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[1.94, 1.94]} />
        <meshBasicMaterial color="#0b111c" transparent opacity={0.72} />
      </mesh>
      <FlatHtml worldWidth={PANEL_WORLD} panelPx={panelPx} position={[0, 0, 0.01]}>
        <div
          ref={fitted.attach}
          className="face-text"
          data-style={isLine ? "line" : "paragraph"}
          style={{ width: panelPx, height: panelPx, fontSize: `${fitted.px}px` }}
          data-visible={visible}
          aria-hidden={!visible}
          lang={scriptLang(face.body)}
        >
          <p>{face.body}</p>
          <span className="face-text__index">{String(index + 1).padStart(2, "0")}</span>
        </div>
      </FlatHtml>
    </group>
  );
}

/** Smallest the measured fit will go; below MIN_FONT_PX, but never past the face. */
const FLOOR_PX = 11;
const STEP_PX = 0.25;

/**
 * The size above is arithmetic — a character per em — and real type runs
 * longer: letter-spacing, kinsoku moving a character to the next line, a
 * different fallback font on iOS, and the face number underneath. So the face
 * measures its own DOM and steps down until paragraph and number fit inside
 * the padding. Re-run when the face is about to show and when webfonts land.
 * A callback ref, because drei renders the DOM in a root of its own, after
 * this component's effects have run.
 */
function useFittedSize(fontPx: number, visible: boolean) {
  const [el, attach] = useState<HTMLDivElement | null>(null);
  const [px, setPx] = useState(fontPx);
  const [fonts, setFonts] = useState(0);

  useLayoutEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && setFonts((n) => n + 1));
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!el || el.clientHeight === 0) return;
    const style = getComputedStyle(el);
    const available = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const needed = () => {
      let total = 0;
      for (const child of Array.from(el.children) as HTMLElement[]) {
        total += child.offsetHeight + parseFloat(getComputedStyle(child).marginTop);
      }
      return total;
    };
    let size = fontPx;
    el.style.fontSize = `${size}px`;
    while (size > FLOOR_PX && needed() > available) {
      size -= STEP_PX;
      el.style.fontSize = `${size}px`;
    }
    setPx(size);
  }, [el, fontPx, visible, fonts]);

  return { attach, px };
}
