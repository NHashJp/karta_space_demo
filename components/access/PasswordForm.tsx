"use client";

import { strings, type Lang } from "@/lib/i18n";
import { useRef, useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/card/Icons";

/**
 * A password field, its reveal toggle, and the button that submits it.
 *
 * Shared by the card gate and the editor gate. They ask for different things
 * in different words, but the field itself — the forgiving input, the eye, the
 * caret that has to survive a change of `type` — is the same field, and the
 * second copy of that is where the two would quietly stop matching.
 */

type Props = {
  /** Posted to as `{ password }`; anything else the caller needs goes in `body`. */
  endpoint: string;
  body?: Record<string, unknown>;
  label: string;
  submitLabel: string;
  pendingLabel: string;
  /** What to say when the password is simply wrong. */
  wrongMessage: string;
  /** The card's language, for the form's own messages. Default Japanese. */
  lang?: Lang;
  onUnlocked: () => void;
  children?: React.ReactNode;
};

export function PasswordForm({
  endpoint,
  body,
  label,
  submitLabel,
  pendingLabel,
  wrongMessage,
  lang = "ja",
  onUnlocked,
  children,
}: Props) {
  const t = strings(lang).gate;
  const field = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /*
   * Off to begin with, and never remembered.
   *
   * These passwords are shared keys that arrived in a message, usually typed
   * for the first time by someone reading them off another screen, and there
   * is no reset — the only recovery is asking whoever sent it. Being able to
   * check what you typed is worth more than hiding it from a room you are
   * probably alone in. It still starts hidden, because the one case where
   * someone *is* being overlooked should not be the case that needs an extra
   * tap.
   */
  const [revealed, setRevealed] = useState(false);

  function toggleReveal() {
    const input = field.current;
    const caret = input?.selectionStart ?? null;
    setRevealed((shown) => !shown);
    /*
     * Put the caret back where it was. Changing an input's `type` makes the
     * browser drop the selection, so without this a toggle halfway through
     * typing sends the cursor to the end of the field — which is exactly when
     * someone reaches for the button.
     */
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      if (caret !== null) {
        try {
          input.setSelectionRange(caret, caret);
        } catch {
          /* some browsers refuse this on a field that has just changed type */
        }
      }
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, password }),
      });

      if (response.ok) {
        onUnlocked();
        return;
      }
      setPending(false);
      setError(
        response.status === 429
          ? t.tooMany
          : wrongMessage,
      );
    } catch {
      setPending(false);
      setError(t.failed);
    }
  }

  return (
    <form className="gate" onSubmit={submit}>
      {children}

      <label className="gate__label" htmlFor="password" lang={lang}>
        {label}
      </label>

      <div className="gate__field">
        <input
          id="password"
          ref={field}
          className="gate__input"
          type={revealed ? "text" : "password"}
          value={password}
          autoComplete="current-password"
          /* A revealed password is still a password: never correct it. */
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button
          className="gate__reveal"
          type="button"
          onClick={toggleReveal}
          aria-pressed={revealed}
          aria-controls="password"
          aria-label={revealed ? t.hide : t.show}
          title={revealed ? t.hide : t.show}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      <button className="button" type="submit" disabled={pending || !password} lang={lang}>
        {pending ? pendingLabel : submitLabel}
      </button>

      {error ? (
        <p className="gate__error" role="alert" lang={lang}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
