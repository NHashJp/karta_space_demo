"use client";

import { CometOrbitMini } from "@/components/card/CometOrbitMini";
import { mailConfigured, type SectionProps } from "../shared";
import {
  COMET_LABEL_MAX,
  COMET_MESSAGE_MAX,
  COMET_PROMISE_MAX,
  RETURN_PRECISIONS,
} from "@/lib/cardRules";
import { progress as cometProgress } from "@/lib/cometOrbit";
import { formatReturn, returnLabel } from "@/lib/returnLabel";
import { civilDate } from "@/lib/orbitClock";
import { DEFAULT_FROM, DEFAULT_REPLY_PROMPT } from "@/lib/clientCard";
import type { ReturnPrecision } from "@/types/card";

/**
 * The promise, and what rides with it (spec v0.2 rev 5, §15.4).
 *
 * One object now, where revision 4 had a satellite and a comet saying the same
 * thing in two places. Each feature says what it needs and **why it is
 * unavailable** when it is, rather than being silently missing: a sender who
 * ticks "let them write back" and sees nothing happen has no way to discover
 * that `RESEND_API_KEY` is the reason.
 */
export function OrbitSection({ card, edit, env }: SectionProps) {
  const mail = mailConfigured(env);
  const timeZone = card.timeZone ?? "Asia/Tokyo";
  const today = civilDate(new Date(), timeZone);
  const from = card.from || DEFAULT_FROM;
  const comet = card.comet;

  return (
    <div className="editor__section">
      <div className="face">
        <div className="face__head">
          <strong>Promise comet &middot; 約束の彗星</strong>
          <button
            className="face__type"
            aria-pressed={Boolean(comet)}
            onClick={() =>
              edit({
                comet: comet
                  ? undefined
                  : { returnsOn: "", leftOn: today, show: "day", yearly: false },
              })
            }
          >
            {comet ? "Remove" : "Add"}
          </button>
        </div>

        {comet ? (
          <>
            <div className="editor__row">
              <label className="field">
                <span>Comes back</span>
                <input
                  type="date"
                  value={comet.returnsOn}
                  onChange={(event) => edit({ comet: { ...comet, returnsOn: event.target.value } })}
                />
                <span className="editor__hint">
                  The day you mean to meet. Its position in the sky is the
                  countdown, so this is the one date that matters.
                </span>
              </label>

              <label className="field">
                <span>You parted</span>
                <input
                  type="date"
                  value={comet.leftOn}
                  onChange={(event) => edit({ comet: { ...comet, leftOn: event.target.value } })}
                />
                <span className="editor__hint">
                  When the comet passed the planet. Usually today.
                </span>
              </label>
            </div>

            <label className="field">
              <span>How the return is shown</span>
              <select
                value={comet.show ?? "day"}
                onChange={(event) =>
                  edit({ comet: { ...comet, show: event.target.value as ReturnPrecision } })
                }
              >
                {RETURN_PRECISIONS.map((precision) => (
                  <option key={precision} value={precision}>
                    {precision}
                  </option>
                ))}
              </select>
              {/*
                The reason this exists: an exact date is often a lie. "We'll
                meet at Christmas" is a real promise; a specific day neither
                person has agreed is not.
              */}
              <span className="editor__hint">
                {comet.returnsOn
                  ? `The card will say: ${formatReturn(
                      returnLabel(comet.returnsOn, comet.show, new Date(), timeZone),
                    )}`
                  : "Coarser than “day” never prints the exact date in the card."}
              </span>
            </label>

            <label className="field">
              <span>
                The promise &middot; {(comet.promise ?? "").length}/{COMET_PROMISE_MAX}
              </span>
              <input
                value={comet.promise ?? ""}
                onChange={(event) =>
                  edit({ comet: { ...comet, promise: event.target.value || undefined } })
                }
                placeholder="次のクリスマスに、また会おう。"
                lang="ja"
              />
            </label>

            <label className="field">
              <span>
                A name for the day &middot; {(comet.label ?? "").length}/{COMET_LABEL_MAX}
              </span>
              <input
                value={comet.label ?? ""}
                onChange={(event) =>
                  edit({ comet: { ...comet, label: event.target.value || undefined } })
                }
                placeholder="次のクリスマス"
                lang="ja"
              />
              <span className="editor__hint">
                Used in your reminder email, not shown to the receiver.
              </span>
            </label>

            <label className="field">
              <span>
                Your sealed words &middot; {(comet.message ?? "").length}/{COMET_MESSAGE_MAX}
              </span>
              <textarea
                value={comet.message ?? ""}
                rows={4}
                onChange={(event) =>
                  edit({ comet: { ...comet, message: event.target.value || undefined } })
                }
                lang="ja"
              />
              <span className="editor__hint">
                Not sent to the browser at all until the comet comes back — not
                hidden, absent. Optional: the comet still carries the promise.
              </span>
            </label>

            {/* Where it is today, so the metaphor is visible while editing. */}
            {comet.returnsOn && comet.leftOn ? (
              <div className="editor__preview-orbit">
                <CometOrbitMini progress={cometProgress(comet.leftOn, comet.returnsOn, today)} />
                <span className="editor__hint">
                  Where the comet is today. Use the preview&rsquo;s Date control
                  to watch it come home.
                </span>
              </div>
            ) : null}

            <label className="editor__toggle">
              <input
                type="checkbox"
                checked={Boolean(comet.yearly)}
                onChange={(event) =>
                  edit({ comet: { ...comet, yearly: event.target.checked || undefined } })
                }
              />
              Leaves again and comes back every year
            </label>

            <label className="editor__toggle">
              <input
                type="checkbox"
                disabled={!mail || !env.COMET_SECRET}
                checked={comet.invite !== false}
                onChange={(event) =>
                  edit({ comet: { ...comet, invite: event.target.checked ? undefined : false } })
                }
              />
              Invite them to put their own words on it
            </label>
            {!mail || !env.COMET_SECRET ? (
              <p className="editor__hint">
                Needs {!mail ? "the mail variables" : ""}
                {!mail && !env.COMET_SECRET ? " and " : ""}
                {!env.COMET_SECRET ? "COMET_SECRET" : ""}. Without them the
                comet still flies, just without the invite. See Setup.
              </p>
            ) : null}

            <p className="editor__hint">
              {env.CRON_SECRET && mail
                ? "You will be emailed on the day. The receiver never is — you reach out."
                : "The reminder email needs CRON_SECRET and the mail variables."}
            </p>
          </>
        ) : null}
      </div>

      {/* ---- the reply ---------------------------------------------------- */}
      <div className="face">
        <div className="face__head">
          <strong>Reply &middot; 返事</strong>
          <button
            className="face__type"
            disabled={!mail}
            aria-pressed={Boolean(card.reply)}
            onClick={() => edit({ reply: card.reply ? undefined : {} })}
          >
            {card.reply ? "Remove" : "Add"}
          </button>
        </div>

        {card.reply ? (
          <label className="field">
            <span>Prompt</span>
            <input
              value={card.reply.prompt ?? ""}
              onChange={(event) => edit({ reply: { prompt: event.target.value || undefined } })}
              placeholder={DEFAULT_REPLY_PROMPT}
              lang="ja"
            />
          </label>
        ) : null}

        <p className="editor__hint">
          {mail
            ? `Their reply goes straight to your inbox, signed off to ${from}. Nothing is stored here.`
            : "Needs RESEND_API_KEY, MAIL_FROM and NOTIFY_TO. See Setup."}
        </p>
      </div>
    </div>
  );
}
