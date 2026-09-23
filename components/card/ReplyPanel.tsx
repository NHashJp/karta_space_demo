"use client";

import { Panel } from "./Panel";
import { MessageForm } from "./MessageForm";
import { REPLY_MAX } from "@/lib/submission";
import type { ClientCard } from "@/lib/clientCard";

/**
 * The reply rocket's panel (spec v0.2 §10.2).
 *
 * One line saying where the message is going, and then the form. The line
 * matters more than it looks: "it goes straight to みお" is the difference
 * between writing to a person and filling in a feedback box, and it is the
 * only place the receiver is told what happens to what they write.
 */
export function ReplyPanel({
  card,
  onClose,
  onSent,
}: {
  card: ClientCard;
  onClose: () => void;
  /** Dispatched only after the server has accepted the reply (§10.2). */
  onSent: () => void;
}) {
  return (
    <Panel title="返事を打ち上げる" onClose={onClose}>
      <p className="reply__prompt" lang="ja">
        {card.replyPrompt}
      </p>

      <MessageForm
        endpoint={`/c/${card.slug}/reply`}
        messageMax={REPLY_MAX}
        submitLabel="打ち上げる"
        sendingLabel="送信中…"
        onSent={onSent}
      />

      <p className="reply__note" lang="ja">
        すぐに、{card.from}に届きます。
      </p>
    </Panel>
  );
}
