"use client";

import { useEffect, useState } from "react";
import { MessageForm } from "./MessageForm";
import { CloseIcon, CopyIcon, LockIcon } from "./Icons";
import { formatFuzzyDate } from "@/lib/fuzzyDate";
import { formatReturn } from "@/lib/returnLabel";
import { COMET_MAX } from "@/lib/submission";
import type { ClientCard } from "@/lib/clientCard";

/**
 * The comet sheet (spec v0.2 rev 5, §8.6; mockups M13, M14c).
 *
 * It opens on the chart, at the end of the comet moment, and says one of four
 * things depending on where the comet is in its life:
 *
 * - **arrival** — it is back, and the sender's words are readable at last;
 * - **invite** — it is on its way and has room for the receiver's words;
 * - **aboard** — their words are already on it, and here is where it has got to;
 * - **kept** — it came back, the promise was kept, and this is the keepsake.
 *
 * There is no countdown in days unless the promise itself is day-precise. The
 * chart behind this sheet already shows how far away the comet is, and a
 * number would only invite the reader to stop looking at it.
 *
 * The promise and its date are not in the sheet. They are a caption on the
 * chart (`chart-head`), because they belong to the ellipse rather than to the
 * thing being asked — and because a sheet that opened by restating the
 * promise made every state of it start with the same two lines.
 */

type Props = {
  card: ClientCard;
  /** Their words are on it: this session, or an earlier visit in this browser. */
  aboard: boolean;
  /**
   * The link to watch the comet, if they boarded it in *this* session.
   *
   * Owned by `CardExperience`, because this sheet is unmounted while the
   * boarding animation plays. Its presence is also what distinguishes the two
   * aboard states: the moment it happened (M13d), and every visit after
   * (M14c), when the link is gone and only the email still has it.
   */
  justBoardedLink: string | null;
  /**
   * The invite has been shown before, on an earlier deployment, and they did
   * not write (mockup M13e). The second ask is shorter: they have read the
   * long version once, and repeating it is how an invitation turns into
   * nagging.
   */
  askedBefore: boolean;
  /** Called once, when the invite is actually put in front of them. */
  onAsked: () => void;
  onBoarded: (token?: string) => void;
  onLeave: () => void;
};

/**
 * The invite is two steps, as the mockups have it (M13a, then M13b). Asking
 * and answering are different sizes of decision: the first is "would you?",
 * which is one line and two buttons, and the second is a form. Opening
 * straight into the form answers the first question on the reader's behalf.
 */
type Step = "asked" | "writing";

export function CometSheet({
  card,
  aboard,
  justBoardedLink,
  askedBefore,
  onAsked,
  onBoarded,
  onLeave,
}: Props) {
  const comet = card.comet;
  const [step, setStep] = useState<Step>("asked");
  const [copied, setCopied] = useState(false);
  const link = justBoardedLink;

  /*
   * Marked when the invite is actually put in front of them, not merely when
   * the sheet opens: an arrival, or a promise with no room on it, has asked
   * nothing, and should not spend the one long explanation the reader gets.
   *
   * Above the `!comet` return, because hooks cannot sit behind one.
   */
  const asking = Boolean(comet?.capsule) && comet?.status === "away" && !aboard;
  useEffect(() => {
    if (asking) onAsked();
  }, [asking, onAsked]);

  if (!comet) return null;

  const when = formatReturn(comet.label);
  const returned = comet.status === "returned";
  const kept = comet.status === "kept";
  const opens = (returned || kept) && comet.message;
  /* The sender sealed something on it, and it is not open yet. */
  const sealed = Boolean(comet.promise) && !opens;
  const inviting = Boolean(comet.capsule) && !aboard;

  const label = opens
    ? `${card.from}の言葉`
    : aboard
      ? "あなたの言葉"
      : inviting
        ? "言葉をのせる"
        : "約束の彗星";

  /*
   * `次のクリスマスに、みおのもとへ届きます。` — the same sentence everywhere it
   * is true. It takes the promise's own short label rather than `when`, which
   * carries the date and the countdown as well and reads as a timestamp
   * wedged into the middle of a sentence.
   */
  const delivery = `${comet.label.label}に、${card.from}のもとへ届きます。`;

  const copyLink = link ? (
    // Offered, never done automatically. The link *is* the message, and
    // putting a copy of it on someone's clipboard without being asked is not
    // our call.
    <div>
      <button
        className="button button--quiet"
        onClick={() => {
          void navigator.clipboard?.writeText(link).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
        lang="ja"
      >
        <CopyIcon />
        {copied ? "コピーしました" : "彗星の行方を見るリンクをコピー"}
      </button>
    </div>
  ) : null;

  return (
    <div
      className="sheet-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onLeave();
      }}
    >
      {/* The chart's own caption, above the sheet and outside it (M12c). */}
      <header className="chart-head" lang="ja">
        <p className="chart-head__label">約束の彗星</p>
        {comet.promise ? <p className="chart-head__promise">{comet.promise}</p> : null}
        <p className="chart-head__when">{when}</p>
      </header>

      <section className="sheet" role="dialog" aria-modal="true" aria-label="彗星" lang="ja">
        <header className="sheet__head">
          <h2 className="sheet__label">{label}</h2>
          <button className="panel__close" onClick={onLeave} aria-label="閉じる">
            <CloseIcon />
          </button>
        </header>

        {/* ---- the comet is back: the words open (mockup M9a) ------------- */}
        {opens ? (
          <>
            {/*
              What happened, and when it started — the date it left is what
              makes the arrival mean anything. Warm, because this is the one
              moment the card has been counting towards.
            */}
            <div className="sheet__arrival">
              <p className="sheet__headline sheet__headline--warm">
                約束の彗星が、戻ってきました。
              </p>
              <p className="sheet__body">
                {formatFuzzyDate(comet.leftOn.slice(0, 7))}に旅立った彗星です
              </p>
            </div>
            <p className="comet__message">{comet.message}</p>
            {aboard ? (
              <p className="sheet__also">
                あなたの言葉も、{card.from}に届いています。
              </p>
            ) : null}
            <div className="sheet__actions">
              <button className="button button--ghost button--wide" onClick={onLeave} lang="ja">
                軌道へもどる
              </button>
            </div>
          </>
        ) : null}

        {kept && !comet.message ? (
          <>
            <p className="sheet__body">この彗星は、約束を果たしました。</p>
            <div className="sheet__actions">
              <button className="button button--ghost button--wide" onClick={onLeave} lang="ja">
                軌道へもどる
              </button>
            </div>
          </>
        ) : null}

        {/* ---- it is still on its way, and has room ---------------------- */}
        {inviting && step === "asked" ? (
          <>
            {/*
              The seal, said out loud before anyone commits to it. Someone
              about to write something they cannot take back deserves to know
              that is what they are doing.
            */}
            {sealed ? (
              <p className="sheet__sealed">
                <LockIcon />
                {card.from}の言葉がのっています。また会う日に、ひらきます。
              </p>
            ) : null}
            <p className="sheet__headline">
              {askedBefore
                ? "彗星は、まだあなたの言葉を待っています。"
                : "この彗星に、あなたの言葉ものせませんか。"}
            </p>
            {/*
              The long explanation is first-time only. Someone seeing this for
              the second time already knows where the words go and that they
              cannot be read until the day; saying it again is not clearer,
              only heavier.
            */}
            {askedBefore ? null : (
              <p className="sheet__body">
                {delivery}それまでは、{card.from}にも読めません。
              </p>
            )}
            <div className="sheet__actions">
              <button className="button button--ghost button--wide" onClick={onLeave} lang="ja">
                今はやめておく
              </button>
              <button
                className="button button--wide"
                onClick={() => setStep("writing")}
                lang="ja"
              >
                言葉をのせる
              </button>
            </div>
          </>
        ) : null}

        {inviting && step === "writing" ? (
          <MessageForm
            endpoint={`/c/${card.slug}/comet`}
            messageMax={COMET_MAX}
            submitLabel="彗星にのせる"
            sendingLabel="のせています…"
            note={delivery}
            backLabel="もどる"
            onBack={() => setStep("asked")}
            onSent={(token) => onBoarded(token)}
          />
        ) : null}

        {/* ---- their words are aboard ------------------------------------ */}
        {aboard && !opens ? (
          <>
            {/*
              Warm, and in the past tense, the moment it has just happened
              (M13d); plainer once it is simply true of the comet (M14c).
            */}
            <p className={`sheet__headline${link ? " sheet__headline--warm" : ""}`}>
              {link ? "言葉をのせました。" : "あなたの言葉も、のっています。"}
            </p>
            <p className="sheet__body">{delivery}</p>
            {sealed && !link ? (
              <p className="sheet__sealed">
                <LockIcon />
                {card.from}の言葉がのっています。また会う日に、ひらきます。
              </p>
            ) : null}
            {copyLink}
            <div className="sheet__actions">
              <button className="button button--wide" onClick={onLeave} lang="ja">
                {link ? "つづける" : "軌道へもどる"}
              </button>
            </div>
          </>
        ) : null}

        {/*
          Nothing to write — the sender turned the invite off, or this
          deployment has no way to deliver words — and nothing to read yet
          (mockup M13f). The comet is still a promise, so the sheet says what
          the promise is rather than presenting a bare button.
        */}
        {!inviting && !aboard && !opens && !(kept && !comet.message) ? (
          <>
            {sealed ? (
              <p className="sheet__sealed">
                <LockIcon />
                {card.from}の言葉がのっています。また会う日に、ひらきます。
              </p>
            ) : null}
            <p className="sheet__headline">{comet.label.label}に、ここへ戻ってきます。</p>
            <div className="sheet__actions">
              <button className="button button--wide" onClick={onLeave} lang="ja">
                つづける
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
