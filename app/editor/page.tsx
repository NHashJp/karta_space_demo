import type { Metadata } from "next";
import { listCards } from "@/lib/cards";
import { imagesBySlug } from "@/lib/cardsFile";
import { readSecrets } from "@/lib/secretsFile";
import { passwordEnvKey } from "@/lib/access";
import { hasEditorAccess } from "@/lib/editorAccess";
import { EditorGate } from "@/components/access/EditorGate";
import { EditorShell } from "@/components/editor/EditorShell";
import type { EnvFlags } from "@/components/editor/shared";

export const metadata: Metadata = {
  title: "KARTA_SPACE editor",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * The authoring UI for `config/cards.config.ts`, available in `npm run dev`
 * only: it writes to the repository, and publishing is a deploy either way.
 *
 * Note what crosses to the browser and what does not. The environment is sent
 * as **booleans** — which features are possible — and never as values. The
 * plaintext passwords do cross, because the Share tab's whole job is to show
 * one, but they come from `.karta/` on this machine rather than from anything
 * committed.
 */
export default async function EditorPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="screen">
        <div className="notice">
          <p className="landing__brand">KARTA_SPACE</p>
          <p>The editor runs in development only. Edit cards locally, then deploy.</p>
        </div>
      </div>
    );
  }

  /*
   * The second lock (§15.1). Checked before `listCards()` so a locked editor
   * reads nothing and renders nothing of the cards — the gate must not be a
   * curtain drawn over a page that was built anyway.
   */
  if (!(await hasEditorAccess())) return <EditorGate />;

  const cards = listCards();

  const env: EnvFlags = {
    PUBLIC_BASE_URL: Boolean(process.env.PUBLIC_BASE_URL),
    ACCESS_SECRET: Boolean(process.env.ACCESS_SECRET),
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    MAIL_FROM: Boolean(process.env.MAIL_FROM),
    NOTIFY_TO: Boolean(process.env.NOTIFY_TO),
    COMET_SECRET: Boolean(process.env.COMET_SECRET),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
    notifyTo: process.env.NOTIFY_TO,
    mailFrom: process.env.MAIL_FROM,
  };

  // An environment password wins over anything the Share tab could issue, so
  // the tab says so rather than letting someone set one that does nothing.
  const envPasswords = cards
    .filter((card) => Boolean(process.env[passwordEnvKey(card.slug)]))
    .map((card) => card.slug);

  return (
    <EditorShell
      initialCards={cards}
      images={imagesBySlug()}
      env={env}
      baseUrl={(process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "")}
      secrets={readSecrets()}
      envPasswords={envPasswords}
    />
  );
}
