import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCardBySlug } from "@/lib/cards";
import { canView, passwordRequired } from "@/lib/access";
import { toClientCard } from "@/lib/clientCard";
import { resolveNow } from "@/lib/devTime";
import { cardVersion } from "@/lib/cardVersion";
import { mailReady, cometReady } from "@/lib/notify";
import { PasswordGate } from "@/components/access/PasswordGate";
import { CardExperience } from "@/components/card/CardExperience";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Per request, never at build time: the satellite's countdown and a comet's
 * seal are both decided by comparing dates to *now*, and a prerendered page
 * would freeze that at deploy time (spec v0.2 §14.1).
 */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CardPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const card = getCardBySlug(slug);

  // An unknown slug is a real 404, not a page that renders a message: the
  // editor's live check reads the status code (spec v0.2 §14.1, §15.6).
  if (!card) notFound();

  const version = cardVersion(card);

  if (passwordRequired(card.slug) && !(await canView(card.slug))) {
    return (
      <>
        <meta name="karta-version" content={version} />
        <PasswordGate slug={card.slug} hint={card.access?.hint} />
      </>
    );
  }

  const now = resolveNow((await searchParams).now);
  const clientCard = toClientCard(card, now, {
    mailReady: mailReady(card.slug),
    cometReady: cometReady(),
  });

  return (
    <>
      <meta name="karta-version" content={version} />
      <CardExperience card={clientCard} />
    </>
  );
}
