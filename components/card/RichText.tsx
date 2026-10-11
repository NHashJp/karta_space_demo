import { Fragment } from "react";
import { parseRich } from "@/lib/richText";

/**
 * What the sender wrote, with its **bold**, *italic* and __underline__
 * (`lib/richText.ts`). Elements, never `innerHTML`: the marks decide which
 * tag wraps a run, and the run itself is only ever text.
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRich(text).map((run, index) => {
        let node: React.ReactNode = run.text;
        if (run.underline) node = <u className="rich__u">{node}</u>;
        if (run.italic) node = <em className="rich__i">{node}</em>;
        if (run.bold) node = <strong className="rich__b">{node}</strong>;
        return <Fragment key={index}>{node}</Fragment>;
      })}
    </>
  );
}
