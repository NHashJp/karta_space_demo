"use client";

import { useRouter } from "next/navigation";
import { PasswordForm } from "./PasswordForm";

/**
 * The card's own gate (spec v0.2 §7, §14.9).
 *
 * The field, the reveal and the submit live in `PasswordForm`, which the
 * editor's gate uses too. What is here is only what is particular to a card:
 * its slug, and the sender's hint.
 */
export function PasswordGate({ slug, hint }: { slug: string; hint?: string }) {
  const router = useRouter();

  return (
    <div className="screen">
      <PasswordForm
        endpoint="/api/access"
        body={{ slug }}
        label="パスワードを入力してください"
        submitLabel="開く"
        pendingLabel="確認しています…"
        wrongMessage="パスワードが正しくありません。"
        onUnlocked={() => router.refresh()}
      >
        <p className="landing__brand">KARTA_SPACE</p>
        <h1 className="gate__title" lang="ja">
          このカードはパスワードで保護されています
        </h1>
        {/* The sender's own hint, if they set one (spec v0.2 §7, §21). */}
        {hint ? (
          <p className="gate__hint" lang="ja">
            ヒント: {hint}
          </p>
        ) : null}
      </PasswordForm>
    </div>
  );
}
