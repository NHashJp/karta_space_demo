"use client";

/**
 * The sound toggle (spec v0.2 §12.2).
 *
 * Top-right from the landing screen onwards, and never anywhere else. Sound
 * that cannot be turned off in one tap is sound that should not have been
 * started, and a card is something you might open on a train.
 */
export function SoundToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="sound-toggle"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? "音を消す" : "音を出す"}
      lang="ja"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {on ? (
          <>
            <path
              d="M15.4 9.2a4 4 0 0 1 0 5.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M17.8 6.8a7.4 7.4 0 0 1 0 10.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.6"
            />
          </>
        ) : (
          <path
            d="M15.8 9.6l4.6 4.8M20.4 9.6l-4.6 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="sound-toggle__label"></span>
    </button>
  );
}
