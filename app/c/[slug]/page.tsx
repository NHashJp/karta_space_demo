import type { Metadata } from "next";
import { getCardBySlug } from "@/lib/card";
import { hasAccess, passwordRequired } from "@/lib/access";
import { PasswordGate } from "@/components/access/PasswordGate";
import { CardExperience } from "@/components/card/CardExperience";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

type Props = { params: Promise<{ slug: string }> };

export default async function CardPage({ params }: Props) {
  const { slug } = await params;
  const card = getCardBySlug(slug);

  if (!card) {
    return (
      <div className="screen">
        <div className="notice">
          <p className="landing__brand">KARTA_SPACE</p>
          <p lang="ja">このカードは見つかりませんでした。</p>
        </div>
      </div>
    );
  }

  // Card content is only sent to the browser once access is granted (spec §21).
  if (passwordRequired() && !(await hasAccess(card.slug))) {
    return <PasswordGate slug={card.slug} />;
  }

  return <CardExperience card={card} />;
}
