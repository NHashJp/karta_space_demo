"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BODY_MAX, BODY_MIN, SECRET_MAX, allProblems, imageFolder } from "@/lib/cardRules";
import type { CardConfig, CardFace, CardFaces, SocialPlatform } from "@/types/card";

type PasswordInfo = {
  slug: string;
  key: string;
  ownPassword: boolean;
  sharedFallback: boolean;
};

type Props = {
  initialCards: CardConfig[];
  images: Record<string, string[]>;
  passwords: PasswordInfo[];
};

const PLATFORMS: SocialPlatform[] = ["instagram", "github", "linkedin"];
const LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  github: "GitHub",
  linkedin: "LinkedIn",
};

const emptyText = (): CardFace => ({ type: "text", body: "" });

function newCard(existing: CardConfig[]): CardConfig {
  let slug = "new-card";
  for (let n = 2; existing.some((card) => card.slug === slug); n++) slug = `new-card-${n}`;
  return {
    slug,
    title: "",
    subtitle: "",
    closing: "",
    social: [],
    faces: Array.from({ length: 6 }, emptyText) as unknown as CardFaces,
  };
}

export function CardsEditor({ initialCards, images, passwords }: Props) {
  const router = useRouter();
  const [cards, setCards] = useState<CardConfig[]>(initialCards);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const problems = useMemo(() => allProblems(cards), [cards]);
  const card = cards[selected];
  const cardProblems = problems[selected] ?? { errors: [], warnings: [], notes: [] };
  const blocked = problems.some((p) => p.errors.length > 0);

  function edit(patch: Partial<CardConfig>) {
    setCards((current) =>
      current.map((entry, index) => (index === selected ? { ...entry, ...patch } : entry)),
    );
    setDirty(true);
    setStatus(null);
  }

  function editFace(faceIndex: number, face: CardFace) {
    const faces = card.faces.map((existing, index) =>
      index === faceIndex ? face : existing,
    ) as unknown as CardFaces;
    edit({ faces });
  }

  function editSocial(platform: SocialPlatform, href: string) {
    const others = (card.social ?? []).filter((link) => link.platform !== platform);
    const social = href.trim()
      ? [...others, { platform, href, label: LABELS[platform] }]
      : others;
    social.sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform));
    edit({ social });
  }

  function addCard() {
    const created = newCard(cards);
    setCards((current) => [...current, created]);
    setSelected(cards.length);
    setDirty(true);
    setStatus(null);
  }

  function removeCard(index: number) {
    if (!confirm(`Delete "${cards[index].title || cards[index].slug}"? Save to make it final.`)) {
      return;
    }
    setCards((current) => current.filter((_, i) => i !== index));
    setSelected((current) => Math.max(0, current > index ? current - 1 : Math.min(current, cards.length - 2)));
    setDirty(true);
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const response = await fetch("/api/editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cards }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);

    if (response.ok) {
      setDirty(false);
      setStatus(`Saved ${payload.cards} card(s) to config/cards.config.ts`);
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

  const password = passwords.find((entry) => entry.slug === card?.slug);
  const available = images[card?.slug ?? ""] ?? [];

  return (
    <div className="editor">
      <header className="editor__bar">
        <div>
          <p className="landing__brand">KARTA_SPACE</p>
          <p className="editor__path">config/cards.config.ts</p>
        </div>
        <div className="editor__barRight">
          {status ? <span className="editor__status">{status}</span> : null}
          {dirty && !status ? <span className="editor__status">Unsaved changes</span> : null}
          <button className="button" onClick={save} disabled={saving || blocked || !dirty}>
            {saving ? "Saving…" : "Save to file"}
          </button>
        </div>
      </header>

      {blocked ? (
        <p className="editor__blocked">
          Saving is blocked until every card's errors are fixed — the file would fail the
          next build.
        </p>
      ) : null}

      <div className="editor__body">
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
          <button className="button button--ghost" onClick={addCard}>
            + Add card
          </button>
        </aside>

        {card ? (
          <main className="editor__main">
            {cardProblems.errors.map((problem) => (
              <p key={problem} className="editor__problem editor__problem--error">
                {problem}
              </p>
            ))}
            {cardProblems.warnings.map((problem) => (
              <p key={problem} className="editor__problem">
                {problem}
              </p>
            ))}
            {cardProblems.notes.map((note) => (
              <p key={note} className="editor__hint">
                {note}
              </p>
            ))}

            <div className="editor__row">
              <label className="field">
                <span>Slug (the URL)</span>
                <input
                  value={card.slug}
                  onChange={(event) => edit({ slug: event.target.value })}
                  spellCheck={false}
                />
              </label>
              <p className="editor__hint">
                <a href={`/c/${card.slug}`} target="_blank" rel="noreferrer">
                  open /c/{card.slug} ↗
                </a>
              </p>
            </div>

            <label className="field">
              <span>Title (shown before the card opens)</span>
              <input lang="ja" value={card.title} onChange={(event) => edit({ title: event.target.value })} />
            </label>

            <label className="field">
              <span>Subtitle (optional)</span>
              <input
                lang="ja"
                value={card.subtitle ?? ""}
                onChange={(event) => edit({ subtitle: event.target.value })}
              />
            </label>

            <section className="editor__section">
              <h2>The six faces</h2>
              {card.faces.map((face, index) => (
                <FaceEditor
                  key={index}
                  index={index}
                  face={face}
                  slug={card.slug}
                  available={available}
                  onChange={(next) => editFace(index, next)}
                />
              ))}
            </section>

            <label className="field">
              <span>Closing message (drawn stroke by stroke on the last screen)</span>
              <input lang="ja" value={card.closing} onChange={(event) => edit({ closing: event.target.value })} />
            </label>

            <section className="editor__section">
              <h2>Inside the cube</h2>
              <label className="field">
                <span>Secret line (optional)</span>
                <input
                  lang="ja"
                  value={card.secret ?? ""}
                  onChange={(event) => edit({ secret: event.target.value })}
                />
              </label>
              <p className="face__count" data-warn={(card.secret?.trim().length ?? 0) > SECRET_MAX}>
                {card.secret?.trim().length ?? 0} of {SECRET_MAX} characters
              </p>
              <p className="editor__hint">
                Written on the inside of the far wall. Six seconds after the closing screen
                settles, the reader is offered a way in. Leave it empty and the cube has no
                inside — nothing is offered, and nothing is rendered.
              </p>
            </section>

            <section className="editor__section">
              <h2>Links on the closing screen</h2>
              {PLATFORMS.map((platform) => (
                <label key={platform} className="field">
                  <span>{LABELS[platform]}</span>
                  <input
                    placeholder="leave empty to hide"
                    value={(card.social ?? []).find((link) => link.platform === platform)?.href ?? ""}
                    onChange={(event) => editSocial(platform, event.target.value)}
                    spellCheck={false}
                  />
                </label>
              ))}
            </section>

            <section className="editor__section">
              <h2>Access</h2>
              {password?.ownPassword ? (
                <p className="editor__hint">
                  This card has its own password, set in <code>{password.key}</code>. It opens
                  no other card.
                </p>
              ) : password?.sharedFallback ? (
                <p className="editor__problem">
                  This card uses the shared <code>CARD_PASSWORD</code>, so the same password
                  opens every card without one of its own. Set <code>{password.key}</code> in
                  <code> .env.local</code> to give it a private password.
                </p>
              ) : (
                <p className="editor__hint">
                  No password: anyone with the link can open this card. Set{" "}
                  <code>{password?.key ?? "CARD_PASSWORD_<SLUG>"}</code> in{" "}
                  <code>.env.local</code> to gate it.
                </p>
              )}
              <p className="editor__hint">
                Passwords live in the environment, never in this file. A new card's password
                is only read at server start — restart <code>npm run dev</code> after adding
                one.
              </p>
            </section>

            <button className="button button--ghost" onClick={() => removeCard(selected)}>
              Delete this card
            </button>
          </main>
        ) : (
          <main className="editor__main">
            <p className="editor__hint">No cards yet. Add one to begin.</p>
          </main>
        )}
      </div>
    </div>
  );
}

function FaceEditor({
  index,
  face,
  slug,
  available,
  onChange,
}: {
  index: number;
  face: CardFace;
  slug: string;
  available: string[];
  onChange: (face: CardFace) => void;
}) {
  const chars = face.type === "text" ? face.body.trim().length : 0;
  const outOfRange = face.type === "text" && chars > 0 && (chars < BODY_MIN || chars > BODY_MAX);

  return (
    <div className="face">
      <div className="face__head">
        <strong>Face {index + 1}</strong>
        <div className="face__types">
          <button
            className="face__type"
            aria-pressed={face.type === "text"}
            onClick={() => onChange({ type: "text", body: "" })}
            disabled={face.type === "text"}
          >
            Text
          </button>
          <button
            className="face__type"
            aria-pressed={face.type === "image"}
            onClick={() => onChange({ type: "image", src: available[0] ?? "", alt: "", fit: "cover" })}
            disabled={face.type === "image"}
          >
            Image
          </button>
        </div>
      </div>

      {face.type === "text" ? (
        <>
          <textarea
            lang="ja"
            rows={4}
            value={face.body}
            onChange={(event) => onChange({ type: "text", body: event.target.value })}
          />
          <p className="face__count" data-warn={outOfRange}>
            {chars} characters (aim for {BODY_MIN}–{BODY_MAX})
          </p>
        </>
      ) : (
        <>
          <label className="field">
            <span>Image path</span>
            <input
              list={`images-${slug}`}
              value={face.src}
              onChange={(event) => onChange({ ...face, src: event.target.value })}
              spellCheck={false}
            />
            <datalist id={`images-${slug}`}>
              {available.map((src) => (
                <option key={src} value={src} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Alt text (read aloud by screen readers)</span>
            <input lang="ja" value={face.alt} onChange={(event) => onChange({ ...face, alt: event.target.value })} />
          </label>
          <p className="editor__hint">
            Files go in <code>public{imageFolder(slug)}</code> — generate placeholders with{" "}
            <code>npm run images {slug}</code>.
          </p>
        </>
      )}
    </div>
  );
}
