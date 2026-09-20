import type { Metadata } from "next";
import { listCards } from "@/lib/cards";
import { imagesBySlug } from "@/lib/cardsFile";
import { passwordEnvKey } from "@/lib/access";
import { CardsEditor } from "@/components/editor/CardsEditor";

export const metadata: Metadata = {
  title: "KARTA_SPACE editor",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * A rough authoring UI for `config/cards.config.ts`, available in `npm run dev`
 * only: it writes to the repository, and publishing is a deploy either way.
 */
export default function EditorPage() {
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

  const cards = listCards();

  // Whether each card's password is actually set, without ever sending the
  // password itself to the browser.
  const passwords = cards.map((card) => {
    const key = passwordEnvKey(card.slug);
    return {
      slug: card.slug,
      key,
      ownPassword: Boolean(process.env[key]),
      sharedFallback: Boolean(process.env.CARD_PASSWORD),
    };
  });

  return <CardsEditor initialCards={cards} images={imagesBySlug()} passwords={passwords} />;
}
