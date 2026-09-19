import type { CardConfig } from "@/types/card";

/**
 * The one card this deployment serves.
 * To change the card: edit this file, swap the images in /public/card, redeploy.
 */
export const cardConfig: CardConfig = {
  slug: "2026-newyear-7k2m",
  title: "2026年のあなたへ",
  subtitle: "スクロールして、六つの面をめぐってください。",
  closing: "最後まで見てくれてありがとう。",
  faces: [
    {
      type: "text",
      body: "あけましておめでとう。去年はいろいろなことがあったけれど、こうして新しい年をまた一緒に迎えられたことが、なによりうれしいです。この小さな立方体に、六つの言葉を閉じ込めました。急がずに、ひとつずつ開いてみてください。",
    },
    {
      type: "image",
      src: "/card/image-01.png",
      alt: "静かな夜空にひろがる青い星雲",
      fit: "cover",
    },
    {
      type: "text",
      body: "覚えていますか。夏の終わりに、何でもない話をしながら歩いた帰り道のこと。特別な出来事ではなかったはずなのに、思い出すのはいつもああいう時間で、そういう時間こそがきっと大切だったのだと、今になって思います。",
    },
    {
      type: "text",
      body: "新しい年に、大きな目標を立てる必要はないのかもしれません。ただ、よく眠って、よく笑って、行きたい場所に行けますように。困ったときには、遠慮なく声をかけてください。いつでも、ちゃんとここにいます。",
    },
    {
      type: "image",
      src: "/card/image-02.png",
      alt: "遠くの惑星を照らす紫色のやわらかな光",
      fit: "cover",
    },
    {
      type: "text",
      body: "この一年が、あなたにとって静かであたたかいものでありますように。うまくいかない日があっても、それはそれで悪くない一日だったと思える、そんな年になりますように。またどこかで、ゆっくり話しましょう。",
    },
  ],
};
