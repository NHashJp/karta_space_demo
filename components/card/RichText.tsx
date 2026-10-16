import { Fragment } from "react";
import { parseRich } from "@/lib/richText";

/**
 * What the sender wrote, with its **bold**, *italic*, __underline__ and links
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
        // `href` has already been through `safeHref`: http(s) or mailto only.
        // A new tab, so following a link never closes the card behind it.
        if (run.href) {
          node = (
            <a className="rich__a" href={run.href} target="_blank" rel="noopener noreferrer">
              {node}
            </a>
          );
        }
        return <Fragment key={index}>{node}</Fragment>;
      })}
    </>
  );
}
