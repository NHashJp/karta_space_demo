"use client";

import { useState } from "react";
import type { SectionProps } from "../shared";
import { HINT_MAX } from "@/lib/cardRules";

/**
 * Turning a card into something you can send (spec v0.2 §15.6).
 *
 * This tab exists because the last mile is where a card is actually lost. The
 * writing is done, and then there is a slug to settle, a password to issue, a
 * deploy to remember and a link that either works or silently 404s — and
 * nothing in v0.1 helped with any of it.
 *
 * It cannot deploy (§20), so it does the next most useful thing: it says
 * exactly what to run, and then **checks**.
 */

export type LiveStatus =
  | { status: "live"; version?: string }
  | { status: "stale"; version?: string; expected?: string }
  | { status: "missing" }
  | { status: "unreachable"; reason?: string };

export function ShareSection({
  card,
  edit,
  env,
  dirty,
  baseUrl,
  password,
  envPassword,
  onPassword,
}: SectionProps & {
  dirty: boolean;
  baseUrl: string;
  /** The plaintext, if this computer has it in .karta/secrets.local.json. */
  password: string | null;
  /** CARD_PASSWORD_<SLUG> is set, and overrides anything issued here. */
  envPassword: boolean;
  onPassword: (next: { plain: string | null; hash: string | undefined }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const url = baseUrl ? `${baseUrl}/c/${card.slug}` : `/c/${card.slug}`;
  const hasHash = Boolean(card.access?.passwordHash);

  const message = [
    `「${card.title || card.slug}」を送ります。`,
    url,
    password ? `パスワード: ${password}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  function copy(what: string, text: string) {
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(what),
      () => setCopied(null),
    );
  }

  async function post(body: object) {
    setBusy(true);
    const response = await fetch("/api/editor/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    return (await response.json().catch(() => ({}))) as {
      slug?: string;
      password?: string;
      hash?: string;
    };
  }

  return (
    <div className="editor__section">
      {/* ---- 1. the link -------------------------------------------------- */}
      <div className="face">
        <strong>1 &middot; Link</strong>

        <label className="field">
          <span>Slug</span>
          <input
            value={card.slug}
            onChange={(event) => edit({ slug: event.target.value })}
            spellCheck={false}
          />
        </label>

        <div className="face__types">
          <button
            className="face__type"
            disabled={busy}
            onClick={async () => {
              // A slug someone chooses is a slug someone else can guess; the
              // random part is what actually protects a link-only card.
              if (live?.status === "live" &&
                  !confirm("The old link stops working when you deploy. Change it?")) {
                return;
              }
              const prefix = card.slug.replace(/-[a-z0-9]{8,}$/, "");
              const result = await post({ slugPrefix: prefix });
              if (result.slug) edit({ slug: result.slug });
            }}
          >
            New link
          </button>
          <button className="face__type" onClick={() => copy("link", url)}>
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
        </div>

        <code className="editor__url">{url}</code>
        {!baseUrl ? (
          <span className="editor__hint" data-warn="true">
            PUBLIC_BASE_URL is not set, so this is only a path. See Setup.
          </span>
        ) : null}
      </div>

      {/* ---- 2. the password ---------------------------------------------- */}
      <div className="face">
        <strong>2 &middot; Password</strong>

        {envPassword ? (
          <p className="editor__hint" data-warn="true">
            This card&rsquo;s password comes from the environment
            (CARD_PASSWORD_{card.slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")})
            and overrides anything set here.
          </p>
        ) : (
          <>
            <div className="face__types">
              <button
                className="face__type"
                aria-pressed={!hasHash}
                disabled={busy}
                onClick={() => onPassword({ plain: null, hash: undefined })}
              >
                No password
              </button>
              <button
                className="face__type"
                disabled={busy}
                onClick={async () => {
                  const result = await post({ generate: true });
                  if (result.password && result.hash) {
                    onPassword({ plain: result.password, hash: result.hash });
                  }
                }}
              >
                {hasHash ? "New password" : "Generate"}
              </button>
            </div>

            {hasHash ? (
              password ? (
                <>
                  <code className="editor__password">{password}</code>
                  <div className="face__types">
                    <button className="face__type" onClick={() => copy("password", password)}>
                      {copied === "password" ? "Copied" : "Copy password"}
                    </button>
                  </div>
                </>
              ) : (
                // The plaintext lives only in .karta/, which is not committed.
                <p className="editor__hint">
                  A password is set, but it isn&rsquo;t stored on this computer.
                  Issue a new one to see it.
                </p>
              )
            ) : (
              <p className="editor__hint">
                Anyone with the link can open this card.
              </p>
            )}

            <label className="field">
              <span>Or set your own</span>
              <input
                type="text"
                placeholder="かまくら"
                spellCheck={false}
                onBlur={async (event) => {
                  const value = event.target.value.trim();
                  if (!value) return;
                  const result = await post({ password: value });
                  if (result.hash) onPassword({ plain: value, hash: result.hash });
                  event.target.value = "";
                }}
                lang="ja"
              />
              <span className="editor__hint">
                Spaces, hyphens, capitals and katakana/hiragana differences are
                all ignored, so かまくら, カマクラ and ｶﾏｸﾗ are one password.
                Under 8 characters is guessable if the repository is public.
              </span>
            </label>

            <label className="field">
              <span>
                Hint &middot; {(card.access?.hint ?? "").length}/{HINT_MAX}
              </span>
              <input
                value={card.access?.hint ?? ""}
                onChange={(event) =>
                  edit({
                    access: { ...card.access, hint: event.target.value || undefined },
                  })
                }
                placeholder="はじめて会った駅の名前（ひらがな）"
                lang="ja"
              />
              <span className="editor__hint">
                Shown on the gate to anyone with the link, so write one that
                means something to one person rather than one that narrows the
                answer for everyone.
              </span>
            </label>
          </>
        )}
      </div>

      {/* ---- 3. the message ----------------------------------------------- */}
      <div className="face">
        <strong>3 &middot; Message to send</strong>
        <pre className="editor__message" lang="ja">
          {message}
        </pre>
        <div className="face__types">
          <button className="face__type" onClick={() => copy("message", message)}>
            {copied === "message" ? "Copied" : "Copy message"}
          </button>
        </div>
        <span className="editor__hint">
          Tip: send the link and the password separately — the link by message,
          the password in person.
        </span>
      </div>

      {/* ---- 4. publishing ------------------------------------------------ */}
      <div className="face">
        <strong>4 &middot; Publish</strong>

        <p className="editor__step">
          <span data-done={!dirty}>{dirty ? "○" : "✓"}</span> Saved
          {dirty ? " — you have unsaved changes" : ""}
        </p>

        <p className="editor__step">
          <span>○</span> Pushed and deployed
        </p>
        <pre className="editor__message">
          {`git add config private/cards && git commit -m ${JSON.stringify(
            `Card: ${card.title || card.slug}`,
          )} && git push`}
        </pre>

        <div className="face__types">
          <button
            className="face__type"
            disabled={busy || !env.PUBLIC_BASE_URL}
            onClick={async () => {
              setBusy(true);
              const response = await fetch(
                `/api/editor/live?slug=${encodeURIComponent(card.slug)}`,
              );
              setLive((await response.json().catch(() => null)) as LiveStatus | null);
              setBusy(false);
            }}
          >
            Check now
          </button>
        </div>

        {live ? (
          <p className="editor__step" data-state={live.status}>
            {live.status === "live"
              ? "Live ✓ — the link and password are ready to send."
              : live.status === "stale"
                ? "Live, but older than your last save. Push again."
                : live.status === "missing"
                  ? "Not live yet — the deploy hasn't picked this card up."
                  : `Couldn't reach ${baseUrl || "PUBLIC_BASE_URL"}.`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
