"use client";

import { createContext, useContext } from "react";
import { strings, type Lang, type Strings } from "@/lib/i18n";

/**
 * The card's language, for everything drawn around it (`lib/i18n.ts`).
 *
 * Provided once, by the card, so a button deep inside a sheet does not have to
 * be handed the language through every component between it and the card.
 * Without a provider it is Japanese, which is what every card was before.
 */
const LangContext = createContext<Lang>("ja");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useStrings(): Strings {
  return strings(useContext(LangContext));
}
