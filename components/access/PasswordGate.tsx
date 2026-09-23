"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PasswordGate({ slug, hint }: { slug: string; hint?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, password }),
    });

    if (response.ok) {
      router.refresh();
      return;
    }
    setPending(false);
    setError(
      response.status === 429
        ? "試行回数が多すぎます。しばらくしてからお試しください。"
        : "パスワードが正しくありません。",
    );
  }

  return (
    <div className="screen">
      <form className="gate" onSubmit={submit}>
        <p className="landing__brand">KARTA_SPACE</p>
        <h1 className="gate__title" lang="ja">
          このカードはパスワードで保護されています
        </h1>
        <label className="gate__label" htmlFor="password" lang="ja">
          パスワードを入力してください
        </label>
        {/* The sender's own hint, if they set one (spec v0.2 §7, §21). */}
        {hint ? (
          <p className="gate__hint" lang="ja">
            ヒント: {hint}
          </p>
        ) : null}
        <input
          id="password"
          className="gate__input"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="button" type="submit" disabled={pending || !password} lang="ja">
          {pending ? "確認しています…" : "開く"}
        </button>
        {error ? <p className="gate__error" role="alert" lang="ja">{error}</p> : null}
      </form>
    </div>
  );
}
