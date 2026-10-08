import Link from "next/link";
import { listCards } from "@/lib/cards";
import { strings } from "@/lib/i18n";

export const dynamic = "force-static";

/**
 * The root deliberately lists nothing in production: a slug is the only thing
 * standing between a stranger and a card, so it must not be enumerable. In
 * development the same page is the card index, which is how you reach a newly
 * added card without copying its slug by hand.
 */
export default function Home() {
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="screen">
        <div className="notice">
          <p className="landing__brand">KARTA_SPACE</p>
          {/* No card here to take a language from, so it says it in both. */}
          <p lang="ja">{strings("ja").index.enter}</p>
          <p lang="en">{strings("en").index.enter}</p>
        </div>
      </div>
    );
  }

  const cards = listCards();

  return (
    <div className="screen">
      <div className="notice">
        <p className="landing__brand">KARTA_SPACE</p>
        <p lang="ja">{strings("ja").index.devList(cards.length)}</p>
        <p lang="en">{strings("en").index.devList(cards.length)}</p>
        <nav className="index">
          {cards.map((card) => (
            <Link key={card.slug} className="index__link" href={`/c/${card.slug}`}>
              <span lang={card.lang ?? "ja"}>{card.title}</span>
              <code>/c/{card.slug}</code>
            </Link>
          ))}
        </nav>
        <p className="editor__hint">
          <Link href="/editor">Edit the messages →</Link>
        </p>
      </div>
    </div>
  );
}
