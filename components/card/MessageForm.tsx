"use client";

import { useEffect, useState } from "react";
import { countCharacters, NAME_MAX } from "@/lib/submission";

/**
 * The form both the reply and the comet are written in (spec v0.2 §10.2,
 * §11.3).
 *
 * Two fields. A name, because a message should arrive from someone, and the
 * message itself — and nothing else, ever. The receiver has no account and
 * gives no contact details, so this form is the entire identity they offer,
 * and it is offered to one person rather than to a service.
 *
 * It owns its own network call and reports only success upwards, because the
 * reducer must not learn about a launch until the server has actually accepted
 * one: the animation is a confirmation, not a guess.
 */

const NAME_KEY = "ks_name";

type Props = {
  endpoint: string;
  messageMax: number;
  submitLabel: string;
  sendingLabel: string;
  namePlaceholder?: string;
  messagePlaceholder?: string;
  /** Called only on a 200. */
  onSent: (token?: string) => void;
};

type State = "idle" | "sending" | "failed" | "rate-limited";

export function MessageForm({
  endpoint,
  messageMax,
  submitLabel,
  sendingLabel,
  namePlaceholder = "お名前",
  messagePlaceholder = "メッセージ",
  onSent,
}: Props) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>("idle");

  // Remembered so someone who replies and then releases a comet does not type
  // their own name twice.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NAME_KEY);
      if (stored) setName(stored);
    } catch {
      /* private browsing, or storage blocked */
    }
  }, []);

  const messageLength = countCharacters(message);
  const nameLength = countCharacters(name);
  const valid =
    nameLength > 0 && nameLength <= NAME_MAX && messageLength > 0 && messageLength <= messageMax;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || state === "sending") return;
    setState("sending");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, website }),
      });

      if (response.ok) {
        try {
          window.localStorage.setItem(NAME_KEY, name);
        } catch {
          /* ignore */
        }
        const data = (await response.json().catch(() => ({}))) as { token?: string };
        onSent(data.token);
        return;
      }

      setState(response.status === 429 ? "rate-limited" : "failed");
    } catch {
      setState("failed");
    }
    // On failure the fields keep their contents. Losing a message someone has
    // just written, because a network blipped, would be unforgivable.
  }

  return (
    <form className="message-form" onSubmit={submit}>
      <label className="message-form__field">
        <span className="message-form__label" lang="ja">
          {namePlaceholder}
        </span>
        <input
          className="message-form__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={NAME_MAX * 2}
          autoComplete="nickname"
          required
        />
      </label>

      <label className="message-form__field">
        <span className="message-form__label" lang="ja">
          {messagePlaceholder}
        </span>
        <textarea
          className="message-form__input message-form__textarea"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          required
        />
        <span
          className="message-form__count"
          data-over={messageLength > messageMax}
          aria-live="polite"
        >
          {messageLength} / {messageMax}
        </span>
      </label>

      {/*
        The honeypot. Hidden from people, left alone by people, and filled in
        by the things this is here to stop. `aria-hidden` and tabIndex keep it
        away from screen readers and the keyboard too.
      */}
      <div className="message-form__trap" aria-hidden="true">
        <label>
          website
          <input
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <button className="button" type="submit" disabled={!valid || state === "sending"} lang="ja">
        {state === "sending" ? sendingLabel : submitLabel}
      </button>

      {state === "failed" || state === "rate-limited" ? (
        <p className="message-form__error" role="alert" lang="ja">
          {state === "rate-limited"
            ? "少し時間をおいて、もう一度お試しください。"
            : "うまく届きませんでした。もう一度お試しください。"}
        </p>
      ) : null}
    </form>
  );
}
