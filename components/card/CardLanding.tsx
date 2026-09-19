"use client";

type Props = {
  title: string;
  subtitle?: string;
  ready: boolean;
  /** True once the camera has started diving in; the screen fades away. */
  leaving: boolean;
  onOpen: () => void;
};

export function CardLanding({ title, subtitle, ready, leaving, onOpen }: Props) {
  return (
    <div className="screen screen--landing" data-leaving={leaving} aria-hidden={leaving}>
      <div className="landing">
        <p className="landing__brand">KARTA_SPACE</p>
        <h1 className="landing__title" lang="ja">{title}</h1>
        {subtitle ? <p className="landing__subtitle" lang="ja">{subtitle}</p> : null}
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
