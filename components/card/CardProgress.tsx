"use client";

export function CardProgress({ active, total }: { active: number; total: number }) {
  return (
    <div className="progress" aria-live="polite">
      <span className="progress__count">
        {active + 1} <span className="progress__slash">/</span> {total}
      </span>
      <span className="progress__track" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className="progress__dot" data-on={index <= active} />
        ))}
      </span>
    </div>
  );
}
