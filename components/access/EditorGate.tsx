"use client";

import { useRouter } from "next/navigation";
import { PasswordForm } from "./PasswordForm";

/**
 * The gate in front of the editor (spec v0.2 §15.1).
 *
 * It says plainly what is behind it, because the person reading it is the
 * author and there is nothing to keep from them — and because "editor" is the
 * one word that tells them they are in the right place and simply need the
 * password they set, rather than a card password they are misremembering.
 *
 * No hint. A hint on the card gate exists so a receiver can be reminded of
 * something the two of them know; there is no one on the other side of this
 * one to be reminded by.
 */
export function EditorGate() {
  const router = useRouter();

  return (
    <div className="screen">
      <PasswordForm
        endpoint="/api/editor/access"
        label="編集用パスワードを入力してください"
        submitLabel="編集をはじめる"
        pendingLabel="確認しています…"
        wrongMessage="編集用パスワードが正しくありません。"
        onUnlocked={() => router.refresh()}
      >
        <p className="landing__brand">KARTA_SPACE</p>
        <h1 className="gate__title" lang="ja">
          エディタはパスワードで保護されています
        </h1>
        <p className="gate__hint" lang="ja">
          カードのパスワードではなく、<code>EDITOR_PASSWORD</code> に設定したものです。
        </p>
      </PasswordForm>
    </div>
  );
}
