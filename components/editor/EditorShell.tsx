"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { allProblems } from "@/lib/cardRules";
import { PreviewPane } from "./PreviewPane";
import { SetupChecklist } from "./SetupChecklist";
import { BasicsSection } from "./sections/BasicsSection";
import { ClosingSection } from "./sections/ClosingSection";
import { FacesSection } from "./sections/FacesSection";
import { LinksSection } from "./sections/LinksSection";
import { MemoriesSection } from "./sections/MemoriesSection";
import { OrbitSection } from "./sections/OrbitSection";
import { ShareSection } from "./sections/ShareSection";
import { SECTIONS, newCard, type EnvFlags, type Section } from "./shared";
import type { CardConfig } from "@/types/card";

/**
 * The editor (spec v0.2 §15).
 *
 * v0.1 was one long form. That was fine for six faces and a closing line, and
 * stopped being fine the moment a card acquired memories, two comets, a
 * satellite and a share flow — so the fields are now in sections and the card
 * is previewed beside them.
 *
 * The shell owns **all** the card state. Sections receive a card and a way to
 * change it and nothing else: no fetching, no local copies. That is what keeps
 * "unsaved changes" a single honest flag rather than seven that can disagree.
 */
export function EditorShell({
  initialCards,
  images,
  env: initialEnv,
  baseUrl,
  secrets: initialSecrets,
  envPasswords,
}: {
  initialCards: CardConfig[];
  images: Record<string, string[]>;
  env: EnvFlags;
  baseUrl: string;
  /** slug -> plaintext, from .karta/secrets.local.json on this computer. */
  secrets: Record<string, string>;
  /** Slugs whose password comes from CARD_PASSWORD_<SLUG> and cannot be set here. */
  envPasswords: string[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [secrets, setSecrets] = useState(initialSecrets);
  const [env, setEnv] = useState(initialEnv);
  const [selected, setSelected] = useState(0);
  const [section, setSection] = useState<Section>("Basics");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const problems = useMemo(() => allProblems(cards), [cards]);
  const card = cards[selected];
  const mine = problems[selected] ?? { errors: [], warnings: [], notes: [] };
  const blocked = problems.some((p) => p.errors.length > 0);

  function edit(patch: Partial<CardConfig>) {
    setCards((current) =>
      current.map((entry, index) => (index === selected ? { ...entry, ...patch } : entry)),
    );
    setDirty(true);
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setStatus(null);

    const response = await fetch("/api/editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cards, secrets }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      cards?: number;
      problems?: string[];
    };
    setSaving(false);

    if (response.ok) {
      setDirty(false);
      setStatus(`Saved ${payload.cards} card(s)`);
      setReloadKey((key) => key + 1);
      router.refresh();
      return;
    }
    setStatus(
      payload.problems?.join(" · ") ??
        (response.status === 403
          ? "The editor is disabled outside development."
          : "Could not write the file."),
    );
  }

  async function refreshEnv() {
    const response = await fetch("/api/editor/env");
    if (response.ok) setEnv((await response.json()) as EnvFlags);
  }

  const shared = { card, edit, env };

  return (
    <div className="editor">
      <header className="editor__bar">
        <div>
          <p className="landing__brand">KARTA_SPACE</p>
          <p className="editor__path">config/cards.config.ts</p>
        </div>
        <div className="editor__barRight">
          <SetupChecklist env={env} onChanged={refreshEnv} />
          {status ? <span className="editor__status">{status}</span> : null}
          {dirty && !status ? <span className="editor__status">Unsaved changes</span> : null}
          <button className="button" onClick={save} disabled={saving || blocked || !dirty}>
            {saving ? "Saving…" : "Save to file"}
          </button>
        </div>
      </header>

      {blocked ? (
        <p className="editor__blocked">
          Saving is blocked until every card&rsquo;s errors are fixed — the file
          would fail the next build.
        </p>
      ) : null}

      <div className="editor__body editor__body--v2">
        <aside className="editor__list">
          {cards.map((entry, index) => (
            <button
              key={index}
              className="editor__listItem"
              aria-current={index === selected}
              onClick={() => setSelected(index)}
            >
              <span lang="ja">{entry.title || "(untitled)"}</span>
              <code>/c/{entry.slug}</code>
              {problems[index].errors.length > 0 ? (
                <span className="editor__badge editor__badge--error">
                  {problems[index].errors.length} error(s)
                </span>
              ) : problems[index].warnings.length > 0 ? (
                <span className="editor__badge">{problems[index].warnings.length} note(s)</span>
              ) : null}
            </button>
          ))}
          <button
            className="button button--ghost"
            onClick={() => {
              setCards((current) => [...current, newCard(current)]);
              setSelected(cards.length);
              setDirty(true);
            }}
          >
            + Add card
          </button>
        </aside>

        {card ? (
          <main className="editor__main">
            <nav className="editor__tabs">
              {SECTIONS.map((name) => (
                <button
                  key={name}
                  className="editor__tab"
                  aria-current={section === name}
                  onClick={() => setSection(name)}
                >
                  {name}
                </button>
              ))}
            </nav>

            {mine.errors.map((problem) => (
              <p key={problem} className="editor__problem editor__problem--error">
                {problem}
              </p>
            ))}
            {mine.warnings.map((problem) => (
              <p key={problem} className="editor__problem">
                {problem}
              </p>
            ))}
            {mine.notes.map((note) => (
              <p key={note} className="editor__hint">
                {note}
              </p>
            ))}

            {section === "Basics" ? <BasicsSection {...shared} /> : null}
            {section === "Faces" ? (
              <FacesSection {...shared} images={images[card.slug] ?? []} />
            ) : null}
            {section === "Closing" ? <ClosingSection {...shared} /> : null}
            {section === "Memories" ? <MemoriesSection {...shared} /> : null}
            {section === "Orbit" ? <OrbitSection {...shared} /> : null}
            {section === "Links" ? <LinksSection {...shared} /> : null}
            {section === "Share" ? (
              <ShareSection
                {...shared}
                dirty={dirty}
                baseUrl={baseUrl}
                password={secrets[card.slug] ?? null}
                envPassword={envPasswords.includes(card.slug)}
                onPassword={({ plain, hash }) => {
                  edit({
                    access: hash
                      ? { ...card.access, passwordHash: hash }
                      : card.access?.hint
                        ? { hint: card.access.hint }
                        : undefined,
                  });
                  // The plaintext is held here and written to .karta/ on save,
                  // never into the config.
                  setSecrets((current) => {
                    const next = { ...current };
                    if (plain) next[card.slug] = plain;
                    else delete next[card.slug];
                    return next;
                  });
                }}
              />
            ) : null}
          </main>
        ) : null}

        {card ? <PreviewPane slug={card.slug} reloadKey={reloadKey} /> : null}
      </div>
    </div>
  );
}
