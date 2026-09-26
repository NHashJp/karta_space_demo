import type { CardConfig } from "@/types/card";

/**
 * Every card this deployment serves, in one file.
 *
 * Edit it by hand, or run `npm run dev` and open /editor — the editor writes
 * this same file, and rewrites it whole, so comments added below do not
 * survive a save.
 *
 * To add a card, use the editor's Share tab — it issues a slug with an
 * unguessable random part and a password, and tells you what to deploy. By
 * hand: append an entry, put cube-face images in `public/cards/<slug>/` and
 * memory photographs in `private/cards/<slug>/`, redeploy. Nothing else in the
 * codebase needs to know the card exists — `lib/cards.ts` builds the slug
 * registry from this array and validates every entry at import time, so a
 * malformed card fails the build rather than the page.
 *
 * Plaintext passwords are never written here. A card reads
 * `CARD_PASSWORD_<SLUG>` (slug upper-cased, non-alphanumerics as `_`), then
 * its own `access.passwordHash` if the editor issued one, then the shared
 * `CARD_PASSWORD`, and is link-only when none of them is set. Only the salted
 * hash and the hint are ever committed. See `lib/access.ts`.
 */
export const cards: CardConfig[] = [
  {
    "slug": "2026-newyear-7k2m",
    "title": "2026年のあなたへ",
    "subtitle": "スクロールして、六つの面をめぐってください。",
    "closing": "改めてお世話になりました。これからもよろしくね",
    "secret": "ずっと、味方でいます。",
    "from": "みお",
    "writtenAt": "2026-03",
    "timeZone": "Asia/Tokyo",
    "signature": "/cards/2026-newyear-7k2m/signature.svg",
    "comet": {
      "returnsOn": "2026-12-25",
      "leftOn": "2026-03-01",
      "show": "day",
      "promise": "次のクリスマスに、また会おう。",
      "label": "次のクリスマス",
      "yearly": true,
      "message": "この手紙を書いている今は、まだうまく言えないことがあります。あなたがこれを読むころには、きっと言えるようになっているはずなので、その日まで預けておきます。",
      "invite": true
    },
    "reply": {},
    "memories": [
      {
        "title": "はじめて会った日",
        "date": "2023-04",
        "approx": true,
        "caption": "駅の改札で、ずいぶん待たせてしまった日。",
        "image": {
          "src": "private/cards/2026-newyear-7k2m/memory-01.png",
          "alt": "夕暮れの駅前",
          "fit": "cover"
        }
      },
      {
        "title": "夏の帰り道",
        "date": "2023",
        "season": "summer",
        "caption": "何でもない話をしながら歩いた、あの時間。",
        "image": {
          "src": "private/cards/2026-newyear-7k2m/memory-02.png",
          "alt": "夏の夕方の街路",
          "fit": "cover"
        }
      },
      {
        "title": "初めての打ち合わせ",
        "date": "2024-01-18"
      },
      {
        "title": "雪の日の約束",
        "date": "2025-12",
        "approx": true,
        "caption": "積もったら行こうね、と言っていた場所。"
      },
      {
        "title": "最後の打ち上げ",
        "date": "2026-02",
        "caption": "また集まろう、と全員が言った夜。",
        "image": {
          "src": "private/cards/2026-newyear-7k2m/memory-03.png",
          "alt": "夜の窓辺の灯り",
          "fit": "cover"
        },
        "approx": false
      }
    ],
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
        "type": "image",
        "src": "/cards/2026-newyear-7k2m/image-01.png",
        "alt": "静かな夜空にひろがる青い星雲",
        "fit": "cover"
      },
      {
        "type": "text",
        "body": "覚えていますか。夏の終わりに、何でもない話をしながら歩いた帰り道のこと。特別な出来事ではなかったはずなのに、思い出すのはいつもああいう時間で、そういう時間こそがきっと大切だったのだと、今になって思います。"
      },
      {
        "type": "text",
        "style": "line",
        "body": "また、会いましょう。"
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
    "secret": "またいつか、どこかで。",
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
