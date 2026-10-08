"use client";

import { useRouter } from "next/navigation";
import { PasswordForm } from "./PasswordForm";
import { strings, type Lang } from "@/lib/i18n";

/**
 * The card's own gate (spec v0.2 §7, §14.9).
 *
 * The field, the reveal and the submit live in `PasswordForm`, which the
 * editor's gate uses too. What is here is only what is particular to a card:
 * its slug, and the sender's hint.
 */
export function PasswordGate({
  slug,
  hint,
  lang = "ja",
}: {
  slug: string;
  hint?: string;
  /** The card's language: the gate is the first thing it says. */
  lang?: Lang;
}) {
  const router = useRouter();
  const t = strings(lang).gate;

  return (
    <div className="screen">
      <PasswordForm
        endpoint="/api/access"
        body={{ slug }}
        label={t.label}
        submitLabel={t.submit}
        pendingLabel={t.pending}
        wrongMessage={t.wrong}
        lang={lang}
        onUnlocked={() => router.refresh()}
      >
        <p className="landing__brand">KARTA_SPACE</p>
        <h1 className="gate__title" lang={lang}>
          {t.protected}
        </h1>
        {/* The sender's own hint, if they set one (spec v0.2 §7, §21). */}
        {hint ? (
          <p className="gate__hint" lang={lang}>
            {t.hint(hint)}
          </p>
        ) : null}
      </PasswordForm>
    </div>
  );
}
