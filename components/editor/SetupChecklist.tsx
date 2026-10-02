"use client";

import { useState } from "react";
import type { EnvFlags } from "./shared";

/**
 * What the environment does and does not make possible (spec v0.2 §15.2).
 *
 * Every optional feature in v0.2 fails *quietly* when its variable is missing
 * — a reply that is never offered, a comet that never seals, a reminder that
 * never sends — because failing loudly at a receiver would be worse. The cost
 * is that the sender has no way to discover why, so this is where they find
 * out.
 *
 * **Values are never shown.** A tick and a name, and a Generate button for the
 * three nobody can produce by hand.
 */

type Row = {
  key: keyof EnvFlags;
  enables: string;
  generatable?: boolean;
};

const ROWS: Row[] = [
  { key: "PUBLIC_BASE_URL", enables: "Share links, and the live check" },
  { key: "ACCESS_SECRET", enables: "Passwords issued here", generatable: true },
  { key: "RESEND_API_KEY", enables: "All email" },
  { key: "MAIL_FROM", enables: "All email" },
  { key: "NOTIFY_TO", enables: "Where replies and comets arrive" },
  { key: "COMET_SECRET", enables: "Comets released back to you", generatable: true },
  { key: "CRON_SECRET", enables: "The satellite-day reminder", generatable: true },
];

/**
 * The address itself, where there is one to show.
 *
 * Only for the two that are addresses. Everything else stays a tick — the
 * point of this panel is that a browser never holds a secret.
 */
function value(key: keyof EnvFlags, env: EnvFlags): string | undefined {
  if (key === "NOTIFY_TO") return env.notifyTo;
  if (key === "MAIL_FROM") return env.mailFrom;
  return undefined;
}

export function SetupChecklist({
  env,
  onChanged,
}: {
  env: EnvFlags;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const set = ROWS.filter((row) => env[row.key]).length;

  return (
    <div className="setup">
      <button className="setup__chip" onClick={() => setOpen((value) => !value)}>
        Setup {set}/{ROWS.length}
      </button>

      {open ? (
        <div className="setup__panel">
          {notice ? <p className="editor__problem">{notice}</p> : null}

          <table className="setup__table">
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <td data-set={env[row.key]}>{env[row.key] ? "✓" : "✗"}</td>
                  <td>
                    <code>{row.key}</code>
                    <span className="editor__hint">
                      {value(row.key, env) ?? row.enables}
                    </span>
                  </td>
                  <td>
                    {env[row.key] ? null : row.generatable ? (
                      <button
                        className="face__type"
                        disabled={busy !== null}
                        onClick={async () => {
                          setBusy(row.key);
                          const response = await fetch("/api/editor/env", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ generate: row.key }),
                          });
                          setBusy(null);
                          if (response.ok) {
                            // The dev server reads .env.local once, at startup.
                            setNotice(
                              `${row.key} written to .env.local. Restart npm run dev to pick it up.`,
                            );
                            onChanged();
                          } else {
                            setNotice(`Could not write ${row.key}.`);
                          }
                        }}
                      >
                        {busy === row.key ? "…" : "Generate"}
                      </button>
                    ) : (
                      <span className="editor__hint">set by hand</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="editor__hint">
            Set these in <code>.env.local</code> here, and in the Vercel
            project&rsquo;s environment variables for production. Values are
            never shown in this editor.
          </p>
        </div>
      ) : null}
    </div>
  );
}
