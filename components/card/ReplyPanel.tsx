"use client";

import { useLang, useStrings } from "./LangContext";
import { Panel } from "./Panel";
import { MessageForm } from "./MessageForm";
import { RocketIcon } from "./Icons";
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
  const t = useStrings();
  const lang = useLang();
  return (
    <Panel title={t.reply.title} place="high" divided onClose={onClose}>
      <p className="panel__prompt" lang={lang}>
        {card.replyPrompt}
      </p>

      {/*
        Where it is going, carried inside the form so it sits directly above
        the button that sends it, as the comet's does (mockup M13b). It used
        to follow the form, where the one person who most needed it — someone
        about to press 打ち上げる — had already looked away.
      */}
      {/*
        What the button does, in the card's own terms. "打ち上げる" on its own
        is a verb with no object: the reader is about to fire a rocket and the
        screen has not said so, nor that the rocket is the fast way — it goes
        out along the comet's path and overtakes it, which is the whole reason
        there are two ways to send something here.
      */}
      <p className="reply__how" lang={lang}>
        <RocketIcon className="reply__how-icon" />
        {t.reply.how(card.from)}
      </p>

      <MessageForm
        endpoint={`/c/${card.slug}/reply`}
        messageMax={REPLY_MAX}
        submitLabel={t.reply.submit}
        sendingLabel={t.reply.sending}
        note={t.reply.note(card.from)}
        onSent={onSent}
      />
    </Panel>
  );
}
