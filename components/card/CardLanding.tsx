"use client";

type Props = {
  title: string;
  subtitle?: string;
  /**
   * One quiet line under the subtitle (spec v0.2 §7): when the letter was
   * written, or — once something has come back — that it has. The second
   * replaces the first, because on that day it is the more important fact and
   * two lines would be a paragraph.
   */
  note?: string;
  ready: boolean;
  /** True once the camera has started diving in; the screen fades away. */
  leaving: boolean;
  onOpen: () => void;
};

export function CardLanding({ title, subtitle, note, ready, leaving, onOpen }: Props) {
  return (
    <div className="screen screen--landing" data-leaving={leaving} aria-hidden={leaving}>
      <div className="landing">
        <p className="landing__brand">KARTA_SPACE</p>
        <h1 className="landing__title" lang="ja">{title}</h1>
        {subtitle ? <p className="landing__subtitle" lang="ja">{subtitle}</p> : null}
        {note ? <p className="landing__note" lang="ja">{note}</p> : null}
        <button className="button" onClick={onOpen} disabled={!ready || leaving} lang="ja">
          {ready ? "カードを開く" : "カードを準備しています…"}
        </button>
        <p className="landing__hint" lang="ja">
          スクロール／スワイプで次の面へ進みます。
        </p>
      </div>
    </div>
  );
}
