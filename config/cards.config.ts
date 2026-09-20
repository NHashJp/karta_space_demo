import type { CardConfig } from "@/types/card";

/**
 * Every card this deployment serves, in one file.
 *
 * Edit it by hand, or run `npm run dev` and open /editor — the editor writes
 * this same file, and rewrites it whole, so comments added below do not
 * survive a save.
 *
 * To add a card: append an entry, drop its images in `public/cards/<slug>/`,
 * redeploy. Nothing else in the codebase needs to know the card exists —
 * `lib/cards.ts` builds the slug registry from this array and validates every
 * entry at import time, so a malformed card fails the build rather than the
 * page.
 *
 * Passwords are never written here. Each card reads
 * `CARD_PASSWORD_<SLUG>` (slug upper-cased, non-alphanumerics as `_`), falling
 * back to `CARD_PASSWORD` for all cards, and is link-only when neither is set.
 * See `lib/access.ts`.
 */
export const cards: CardConfig[] = [
  {
    "slug": "2026-newyear-7k2m",
    "title": "2026年のあなたへ",
    "subtitle": "スクロールして、六つの面をめぐってください。",
    "closing": "改めてお世話になりました。これからもよろしくね",
    "social": [
      {
        "platform": "instagram",
        "href": "https://www.instagram.com/your-handle",
        "label": "Instagram"
      },
      {
        "platform": "github",
        "href": "https://github.com/your-handle",
        "label": "GitHub"
      },
      {
        "platform": "linkedin",
        "href": "https://www.linkedin.com/in/your-handle",
        "label": "LinkedIn"
      }
    ],
    "faces": [
      {
        "type": "text",
        "body": "あけましておめでとう。去年はいろいろなことがあったけれど、こうして新しい年をまた一緒に迎えられたことが、なによりうれしいです。この小さな立方体に、六つの言葉を閉じ込めました。急がずに、ひとつずつ開いてみてください。"
      },
      {
        "type": "text",
        "body": ""
      },
      {
        "type": "text",
        "body": "覚えていますか。夏の終わりに、何でもない話をしながら歩いた帰り道のこと。特別な出来事ではなかったはずなのに、思い出すのはいつもああいう時間で、そういう時間こそがきっと大切だったのだと、今になって思います。"
      },
      {
        "type": "text",
        "body": "新しい年に、大きな目標を立てる必要はないのかもしれません。ただ、よく眠って、よく笑って、行きたい場所に行けますように。困ったときには、遠慮なく声をかけてください。いつでも、ちゃんとここにいます。"
      },
      {
        "type": "image",
        "src": "/cards/2026-newyear-7k2m/image-02.png",
        "alt": "遠くの惑星を照らす紫色のやわらかな光",
        "fit": "cover"
      },
      {
        "type": "text",
        "body": "この一年が、あなたにとって静かであたたかいものでありますように。うまくいかない日があっても、それはそれで悪くない一日だったと思える、そんな年になりますように。またどこかで、ゆっくり話しましょう。"
      }
    ]
  },
  {
    "slug": "thanks-sample-3f9q",
    "title": "ありがとうを、六つに分けて",
    "subtitle": "スクロールして、六つの面をめぐってください。",
    "closing": "本当にありがとう。またゆっくり話そうね",
    "faces": [
      {
        "type": "text",
        "body": "ひさしぶり。元気にしていますか。面と向かってだと照れてしまって言えないことを、こうして小さな立方体の中に六つ入れてみました。時間のあるときに、ひとつずつめくってみてください。"
      },
      {
        "type": "text",
        "body": "はじめて一緒に仕事をした日のことを、いまでもよく覚えています。何をどう進めればいいのか分からなかった私に、あなたはいつも遠回りをいとわず、ていねいに説明してくれました。あれがなければ、今の私はいません。"
      },
      {
        "type": "text",
        "body": "うまくいかなかった時期のことも書いておきます。あのころ、大丈夫かと声をかけてくれたのはあなたでした。特別な言葉ではなかったけれど、気にかけてくれている人がいるとわかるだけで、ずいぶん救われたのです。"
      },
      {
        "type": "text",
        "body": "楽しかったことも、たくさんありました。遅くまで残った日の帰り道、次はこうしてみようかと話しながら歩いた時間が、いちばん記憶に残っています。ああいう何でもない時間こそ、きっと大切だったのだと思います。"
      },
      {
        "type": "text",
        "body": "これから進む道は少し離れてしまうけれど、遠くにいても、あなたがうまくやっているといいなと思っています。困ったことがあれば、いつでも連絡してください。私にできることなら、よろこんで力になります。"
      },
      {
        "type": "text",
        "body": "最後に。あらためて、ありがとうございました。一緒に過ごした時間が、私にとってどれだけ心強いものだったか、この六つの面ではとても伝えきれません。どうか、体に気をつけて。またどこかで会いましょう。"
      }
    ]
  }
];
