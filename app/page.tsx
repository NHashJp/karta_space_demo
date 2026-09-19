import { redirect } from "next/navigation";
import { cardConfig } from "@/config/card.config";

/**
 * Demo convenience only: the root sends you straight to the one card.
 * Remove this if the slug is meant to stay unguessable.
 */
export default function Home() {
  redirect(`/c/${cardConfig.slug}`);
}
