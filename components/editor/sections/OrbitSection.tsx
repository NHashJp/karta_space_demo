"use client";

import { CometOrbitMini } from "@/components/card/CometOrbitMini";
import { mailConfigured, type SectionProps } from "../shared";
import {
  COMET_MESSAGE_MAX,
  SATELLITE_LABEL_MAX,
  SATELLITE_MESSAGE_MAX,
} from "@/lib/cardRules";
import { progress as cometProgress } from "@/lib/cometOrbit";
import { civilDate } from "@/lib/orbitClock";
import { DEFAULT_FROM, DEFAULT_REPLY_PROMPT } from "@/lib/clientCard";

/**
 * Everything past the closing screen (spec v0.2 §15.4).
 *
 * Each feature says what it needs and **why it is unavailable** when it is,
 * rather than being silently missing. A sender who ticks "let them write back"
 * and sees nothing happen has no way to discover that `RESEND_API_KEY` is the
 * reason — so the checkbox stays disabled and says so.
 */
export function OrbitSection({ card, edit, env }: SectionProps) {
  const mail = mailConfigured(env);
  const today = civilDate(new Date(), card.timeZone ?? "Asia/Tokyo");
  const from = card.from || DEFAULT_FROM;

  const satellite = card.satellite;
  const comet = card.comet;
  const cometReturns = comet?.returnsOn ?? satellite?.date;
  const cometReleased = comet?.releasedOn ?? monthStart(card.writtenAt);

  return (
    <div className="editor__section">
      {/* ---- the satellite ------------------------------------------------ */}
      <div className="face">
        <div className="face__head">
          <strong>Satellite &middot; 衛星</strong>
          <button
            className="face__type"
            aria-pressed={Boolean(satellite)}
            onClick={() =>
              edit({
                satellite: satellite
                  ? undefined
                  : { label: "", message: "", date: "", repeat: "yearly" },
              })
            }
          >
            {satellite ? "Remove" : "Add"}
          </button>
        </div>

        {satellite ? (
          <>
            <div className="editor__row">
              <label className="field">
                <span>
                  Label &middot; {satellite.label.length}/{SATELLITE_LABEL_MAX}
                </span>
                <input
                  value={satellite.label}
                  onChange={(event) =>
                    edit({ satellite: { ...satellite, label: event.target.value } })
                  }
                  placeholder="次のクリスマス"
                  lang="ja"
                />
              </label>

              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={satellite.date}
                  onChange={(event) =>
                    edit({ satellite: { ...satellite, date: event.target.value } })
                  }
                />
              </label>
            </div>

            <label className="field">
              <span>
                Promise &middot; {satellite.message.length}/{SATELLITE_MESSAGE_MAX}
              </span>
              <input
                value={satellite.message}
                onChange={(event) =>
                  edit({ satellite: { ...satellite, message: event.target.value } })
                }
                placeholder="次のクリスマスに、また会おう。"
                lang="ja"
              />
            </label>

            <label className="editor__toggle">
              <input
                type="checkbox"
                checked={satellite.repeat === "yearly"}
                onChange={(event) =>
                  edit({
                    satellite: {
                      ...satellite,
                      repeat: event.target.checked ? "yearly" : "none",
                    },
                  })
                }
              />
              Comes back every year
            </label>

            <p className="editor__hint" lang="ja">
              The panel will read: その日が来たら、{from}から連絡します。
            </p>
            <p className="editor__hint">
              {env.CRON_SECRET && mail
                ? "You will be emailed on the day. The receiver never is — you reach out."
                : "Reminder email needs CRON_SECRET and the mail variables. " +
                  "Without them the card still shows the date and the countdown."}
            </p>
          </>
        ) : null}
      </div>

      {/* ---- the comets --------------------------------------------------- */}
      <div className="face">
        <div className="face__head">
          <strong>Comets &middot; 彗星</strong>
          <button
            className="face__type"
            aria-pressed={Boolean(comet)}
            onClick={() => edit({ comet: comet ? undefined : {} })}
          >
            {comet ? "Remove" : "Add"}
          </button>
        </div>

        {comet ? (
          <>
            <label className="field">
              <span>
                Your sealed message &middot; {(comet.message ?? "").length}/
                {COMET_MESSAGE_MAX}
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
                Not sent to the browser at all until it comes back — not hidden,
                absent. You can leave this empty and only offer them a comet.
              </span>
            </label>

            <div className="editor__row">
              <label className="field">
                <span>Comes back</span>
                <input
                  type="date"
                  value={comet.returnsOn ?? ""}
                  onChange={(event) =>
                    edit({ comet: { ...comet, returnsOn: event.target.value || undefined } })
                  }
                  placeholder={satellite?.date}
                />
                <span className="editor__hint">
                  {comet.returnsOn ? "" : `Defaults to the satellite's date (${satellite?.date ?? "none set"}).`}
                </span>
              </label>

              <label className="field">
                <span>Set off</span>
                <input
                  type="date"
                  value={comet.releasedOn ?? ""}
                  onChange={(event) =>
                    edit({ comet: { ...comet, releasedOn: event.target.value || undefined } })
                  }
                />
                <span className="editor__hint">
                  {comet.releasedOn ? "" : "Defaults to the month the letter was written."}
                </span>
              </label>
            </div>

            {/* Where it is today, so the sender can see the metaphor working. */}
            {cometReturns && cometReleased ? (
              <div className="editor__preview-orbit">
                <CometOrbitMini
                  progress={cometProgress(cometReleased, cometReturns, today)}
                />
                <span className="editor__hint">
                  Where your comet is today. Use the preview&rsquo;s Date control
                  to see it come home.
                </span>
              </div>
            ) : null}

            <label className="editor__toggle">
              <input
                type="checkbox"
                disabled={!mail || !env.COMET_SECRET}
                checked={Boolean(comet.receiverCanRelease)}
                onChange={(event) =>
                  edit({ comet: { ...comet, receiverCanRelease: event.target.checked || undefined } })
                }
              />
              Let them release a comet back to you
            </label>
            {!mail || !env.COMET_SECRET ? (
              <p className="editor__hint">
                Needs {!mail ? "the mail variables" : ""}
                {!mail && !env.COMET_SECRET ? " and " : ""}
                {!env.COMET_SECRET ? "COMET_SECRET" : ""}. See Setup.
              </p>
            ) : null}
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
              onChange={(event) =>
                edit({ reply: { prompt: event.target.value || undefined } })
              }
              placeholder={DEFAULT_REPLY_PROMPT}
              lang="ja"
            />
          </label>
        ) : null}

        <p className="editor__hint">
          {mail
            ? "Their reply goes straight to your inbox. Nothing is stored here."
            : "Needs RESEND_API_KEY, MAIL_FROM and NOTIFY_TO. See Setup."}
        </p>
      </div>
    </div>
  );
}

/** "2026-03" -> "2026-03-01": when the letter's month began. */
function monthStart(writtenAt: string | undefined): string | undefined {
  const match = writtenAt ? /^(\d{4})(?:-(\d{2}))?/.exec(writtenAt) : null;
  return match ? `${match[1]}-${match[2] ?? "01"}-01` : undefined;
}
