"use client";

type Props = {
  closing: string;
  onReplay: () => void;
};

export function CompletionState({ closing, onReplay }: Props) {
  return (
    <div className="screen screen--completion">
      <div className="completion">
        <p className="completion__message" lang="ja">{closing}</p>
        <button className="button button--ghost" onClick={onReplay} lang="ja">
          もう一度見る
        </button>
      </div>
    </div>
  );
}
