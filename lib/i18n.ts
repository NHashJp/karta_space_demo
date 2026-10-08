/**
 * The card's own language, and every word the interface says in it.
 *
 * A card is written in one language, and everything around it — the buttons,
 * the comet's sheet, the countdown, the dates — speaks the same one, so the
 * receiver never reads a Japanese letter in English chrome or the reverse.
 * Japanese is the default: a card that does not say otherwise is the card it
 * always was.
 *
 * One table per language, both of the same type, so a string added to one and
 * forgotten in the other fails the type check rather than showing up blank.
 * Strings that carry a name or a number are functions; the word order differs
 * between the languages, so the sentence is built here rather than glued
 * together at the call site. In English a return date is always introduced
 * with "by", the one preposition that reads right before a day ("by December
 * 25, 2026"), a season ("by next winter") and a year ("by 2027") alike.
 */

export type Lang = "ja" | "en";

export const LANGS: Lang[] = ["ja", "en"];

export function langOf(value: unknown): Lang {
  return value === "en" ? "en" : "ja";
}

/**
 * How wide a piece of text sets, in **full-width characters** — the unit every
 * fitting rule here was written in, because the cards were Japanese.
 *
 * A Japanese character is about one em wide; a Latin letter about half that,
 * and a space a little less. Fitting an English paragraph by its character
 * count would size it as though it were twice as long as it looks, and set it
 * at half the size it should be. Pure, so the editor, the checks and the page
 * all measure the same way.
 */
export function visualLength(text: string): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x20) width += 0.3;
    else if (code < 0x2e80) width += 0.55;
    else width += 1;
  }
  return width;
}

/**
 * Which language a piece of text is actually written in, for its `lang`
 * attribute: Japanese if it has any kana or kanji, English otherwise. Used
 * where text is drawn outside the card's own tree (the cube's faces live in
 * the 3D scene), and right either way — a Japanese card may quote English.
 */
export function scriptLang(text: string): Lang {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text) ? "ja" : "en";
}

export type Strings = {
  common: {
    close: string;
    back: string;
    loadFailed: string;
    reload: string;
    soundOff: string;
    soundOn: string;
  };
  landing: {
    open: string;
    preparing: string;
    hint: string;
    /** "2026年3月に書かれた手紙" — from a formatted date. */
    writtenIn: (when: string) => string;
    cometBack: string;
  };
  reading: { swipe: string };
  inside: { scrollOut: string; back: string };
  completion: {
    replay: string;
    continues: string;
    deploy: string;
    hasInside: string;
    lookInside: string;
  };
  orbit: {
    tapStar: string;
    returned: string;
    today: string;
    thisSeason: string;
    aboard: string;
    lookInside: string;
    reread: string;
    bar: string;
    trail: string;
    replied: string;
    reply: string;
    comet: string;
    replyArrived: string;
    about: string;
  };
  about: {
    title: string;
    lead: string;
    intro: string;
    /** Leads into the link to the project's own write-up. */
    more: string;
    values: { title: string; body: string }[];
  };
  intro: {
    label: string;
    fallbackPromise: string;
    untilBack: string;
    /** The "あと" and "日" around the number, either side of it. */
    daysBefore: string;
    daysAfter: (days: number) => string;
    arrived: string;
    wordsArrive: (from: string) => string;
    promiseOpens: (from: string) => string;
    skip: string;
  };
  sheet: {
    label: string;
    fromWords: (from: string) => string;
    yourWords: string;
    addWords: string;
    promiseComet: string;
    delivery: (when: string, from: string) => string;
    copied: string;
    copyLink: string;
    dialog: string;
    returned: string;
    leftIn: (when: string) => string;
    alsoDelivered: (from: string) => string;
    toOrbit: string;
    kept: string;
    sealed: (from: string) => string;
    stillWaiting: string;
    invite: string;
    unreadable: (from: string) => string;
    notNow: string;
    submit: string;
    sending: string;
    boarded: string;
    alsoAboard: string;
    continue: string;
    comesBack: (when: string) => string;
  };
  crossroads: {
    title: string;
    rocket: string;
    rocketCost: (from: string) => string;
    trail: string;
    memories: (count: number) => string;
    orbit: string;
    returnsAt: (when: string) => string;
    stay: string;
  };
  reply: {
    title: string;
    how: (from: string) => string;
    submit: string;
    sending: string;
    note: (from: string) => string;
  };
  form: {
    name: string;
    message: string;
    rateLimited: string;
    failed: string;
  };
  trajectory: {
    title: string;
    bothAboard: (from: string) => string;
    sealed: (from: string) => string;
    aria: (when: string) => string;
    mini: (when?: string) => string;
    home: string;
    meetHere: string;
    back: string;
    now: string;
  };
  trail: { further: string; back: string };
  a11y: {
    trail: string;
    comet: string;
    fromWords: (from: string) => string;
  };
  gate: {
    label: string;
    submit: string;
    pending: string;
    wrong: string;
    protected: string;
    hint: (hint: string) => string;
    tooMany: string;
    failed: string;
    hide: string;
    show: string;
  };
  index: { enter: string; devList: (count: number) => string };
  cometPage: {
    notFound: string;
    returned: (name: string) => string;
    boardedOn: (when: string) => string;
    words: (name: string) => string;
    returnsOn: (when: string) => string;
    daysLeft: (days: number) => string;
  };
  defaults: { from: string; replyPrompt: string };
  /** The three emails to the sender (§14.8): plain text, and short. */
  mail: {
    replySubject: (title: string) => string;
    replyLead: (name: string) => string;
    cometSubject: (name: string, date: string) => string;
    cometLead: (title: string, name: string) => string;
    cometSealed: (date: string) => string;
    cometLink: string;
    cometKeep: string;
    daySubject: (label: string) => string;
    dayLead: (title: string) => string;
    dayNudge: string;
    dayCard: (url: string) => string;
    dayOpen: string;
    fallbackLabel: string;
    fallbackPromise: string;
  };
  dates: {
    seasons: [string, string, string, string];
    year: (year: number) => string;
    month: (year: number, month: number) => string;
    day: (year: number, month: number, day: number) => string;
    seasonOf: (year: number, season: string) => string;
    approx: (text: string) => string;
    thisSeason: (season: string) => string;
    nextSeason: (season: string) => string;
  };
  relative: {
    today: string;
    daysAgo: (days: number) => string;
    daysLeft: (days: number) => string;
    soon: string;
    months: (months: number) => string;
    years: (years: number) => string;
    yearsHalf: (years: number) => string;
  };
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ja: Strings = {
  common: {
    close: "閉じる",
    back: "もどる",
    loadFailed: "カードを読み込めませんでした。もう一度お試しください。",
    reload: "再読み込み",
    soundOff: "音を消す",
    soundOn: "音を出す",
  },
  landing: {
    open: "カードを開く",
    preparing: "カードを準備しています…",
    hint: "スクロール／スワイプで次の面へ進みます。",
    writtenIn: (when) => `${when}に書かれた手紙`,
    cometBack: "彗星が、戻ってきました。",
  },
  reading: { swipe: "スクロール／スワイプ" },
  inside: { scrollOut: "スクロールして外へ", back: "外に戻る" },
  completion: {
    replay: "もう一度見る",
    continues: "この手紙には、続きがあります。",
    deploy: "軌道へ送り出す",
    hasInside: "この立方体には、内側があります。",
    lookInside: "中をのぞく",
  },
  orbit: {
    tapStar: "星をタップしてみてください。",
    returned: "約束の彗星が、戻ってきました。",
    today: "今日",
    thisSeason: "この冬",
    aboard: "あなたの言葉も、のっています",
    lookInside: "中をのぞく",
    reread: "手紙を読みかえす",
    bar: "軌道",
    trail: "航跡をたどる",
    replied: "返事、届いています",
    reply: "返事を打ち上げる",
    comet: "彗星",
    replyArrived: "返事は、彗星より先に届きました。",
    about: "KARTA_SPACE について",
  },
  about: {
    title: "KARTA_SPACE について",
    lead: "ただ言葉を送るの場所ではなく、つながりを次に繋げる",
    intro: "別れのもう一度会うための約束に変える、宇宙のカードです。",
    more: "開発の経緯や設計思想は、",
    values: [
      {
        title: "終わりではなく、変わる",
        body: "手紙は閉じて終わりません。衛星になって軌道をめぐり、また戻ってきます。",
      },
      {
        title: "ふたりだけの宇宙",
        body: "航跡の思い出も、約束の彗星も、このカードのためだけにあります。",
      },
      {
        title: "約束は、その日まで封をして",
        body: "彗星にのせた言葉は、戻る日まで誰にも読めません。書いた本人にも、送り主にも。",
      },
      {
        title: "言葉は、宇宙で繋がっている",
        body: "手紙の言葉は、彗星の光にのって、衛星の光にのって、また会う日まで届きます。",
      },
      {
        title: "静かに、いつも夜明け",
        body: "派手な演出より、ゆっくり昇る朝日を。再会が近づくほど、空は明るく、前に進んでいます。",
      },
    ],
  },
  intro: {
    label: "約束の彗星",
    fallbackPromise: "また会えます",
    untilBack: "彗星が戻るまで",
    daysBefore: "あと",
    daysAfter: () => "日",
    arrived: "また会うよ！",
    wordsArrive: (from) => `その日、彗星にのせた言葉が${from}に届きます。`,
    promiseOpens: (from) => `その日、${from}との約束がひらきます。`,
    skip: "スキップ",
  },
  sheet: {
    label: "約束の彗星",
    fromWords: (from) => `${from}の言葉`,
    yourWords: "あなたの言葉",
    addWords: "言葉をのせる",
    promiseComet: "約束の彗星",
    delivery: (when, from) => `${when}に、${from}のもとへ届きます。`,
    copied: "コピーしました",
    copyLink: "彗星の行方を見るリンクをコピー",
    dialog: "彗星",
    returned: "約束の彗星が、戻ってきました。",
    leftIn: (when) => `${when}に旅立った彗星です`,
    alsoDelivered: (from) => `あなたの言葉も、${from}に届いています。`,
    toOrbit: "軌道へもどる",
    kept: "この彗星は、約束を果たしました。",
    sealed: (from) => `${from}の言葉がのっています。また会う日に、ひらきます。`,
    stillWaiting: "彗星は、まだあなたの言葉を待っています。",
    invite: "この彗星に、あなたの言葉ものせませんか。",
    unreadable: (from) => `それまでは、${from}にも読めません。`,
    notNow: "今はやめておく",
    submit: "彗星にのせる",
    sending: "のせています…",
    boarded: "言葉をのせました。",
    alsoAboard: "あなたの言葉も、のっています。",
    continue: "つづける",
    comesBack: (when) => `${when}に、ここへ戻ってきます。`,
  },
  crossroads: {
    title: "このあとは",
    rocket: "ロケットを打ち上げる",
    rocketCost: (from) => `彗星より先に、今すぐ${from}へ`,
    trail: "ふたりの航跡をたどる",
    memories: (count) => `${count}つの思い出`,
    orbit: "彗星の軌道を見る",
    returnsAt: (when) => `${when}に戻ります`,
    stay: "軌道にとどまる",
  },
  reply: {
    title: "返事を打ち上げる",
    how: (from) => `あなたの言葉をのせたロケットが、彗星を追い越して${from}に届きます。`,
    submit: "ロケットを打ち上げる",
    sending: "打ち上げています…",
    note: (from) => `彗星より先に、すぐに${from}へ。`,
  },
  form: {
    name: "お名前",
    message: "メッセージ",
    rateLimited: "少し時間をおいて、もう一度お試しください。",
    failed: "うまく届きませんでした。もう一度お試しください。",
  },
  trajectory: {
    title: "彗星の軌道",
    bothAboard: (from) => `${from}とあなたの言葉がのっています。また会う日に、ひらきます。`,
    sealed: (from) => `${from}の言葉がのっています。また会う日に、ひらきます。`,
    aria: (when) => `彗星の軌道。${when}に、あなたの星へ戻ってきます。`,
    mini: (when) => (when ? `彗星の軌道。${when}に戻ります。` : "彗星の軌道"),
    home: "あなたの星",
    meetHere: "また、ここで。",
    back: "帰ってきました",
    now: "いま、ここ",
  },
  trail: { further: "スクロールで、さらに昔へ", back: "軌道に戻る" },
  a11y: {
    trail: "航跡",
    comet: "彗星",
    fromWords: (from) => `${from}からの言葉`,
  },
  gate: {
    label: "パスワードを入力してください",
    submit: "開く",
    pending: "確認しています…",
    wrong: "パスワードが正しくありません。",
    protected: "このカードはパスワードで保護されています",
    hint: (hint) => `ヒント: ${hint}`,
    tooMany: "試行回数が多すぎます。しばらくしてからお試しください。",
    failed: "うまく確認できませんでした。もう一度お試しください。",
    hide: "パスワードを隠す",
    show: "パスワードを表示",
  },
  index: {
    enter: "カードのリンクからお入りください。",
    devList: (count) => `開発用のカード一覧（${count}）`,
  },
  cometPage: {
    notFound: "この彗星は見つかりませんでした。",
    returned: (name) => `${name}さんの言葉が、戻ってきました。`,
    boardedOn: (when) => `${when}に、彗星にのりました`,
    words: (name) => `${name}さんの言葉`,
    returnsOn: (when) => `約束の彗星にのって、${when}に戻ってきます。`,
    daysLeft: (days) => `あと${days}日`,
  },
  defaults: { from: "送り主", replyPrompt: "ひとこと、返事をどうぞ。" },
  mail: {
    replySubject: (title) => `「${title}」に返事が届きました`,
    replyLead: (name) => `${name}さんから、返事が届きました。`,
    cometSubject: (name, date) => `${name}さんの言葉が、彗星にのりました（${date}に戻ってきます）`,
    cometLead: (title, name) => `「${title}」から、${name}さんが彗星に言葉をのせました。`,
    cometSealed: (date) => `${date}に戻ってくるまで、中身は読めません。`,
    cometLink: "彗星の行方と、戻ってきた言葉は、このリンクから:",
    cometKeep: "このメールは消さずに残しておいてください。リンクがなくなると、彗星は見つけられなくなります。",
    daySubject: (label) => `今日は「${label}」です`,
    dayLead: (title) => `「${title}」の彗星が、戻ってくる日になりました。`,
    dayNudge: "相手に、連絡してみませんか。",
    dayCard: (url) => `カード: ${url}`,
    dayOpen: "彗星のメールが届いている場合は、今日からそのリンクで読めます。",
    fallbackLabel: "約束の日",
    fallbackPromise: "また会いましょう。",
  },
  dates: {
    seasons: ["春", "夏", "秋", "冬"],
    year: (year) => `${year}年`,
    month: (year, month) => `${year}年${month}月`,
    day: (year, month, day) => `${year}年${month}月${day}日`,
    seasonOf: (year, season) => `${year}年${season}`,
    approx: (text) => `${text}頃`,
    thisSeason: (season) => `この${season}`,
    nextSeason: (season) => `次の${season}`,
  },
  relative: {
    today: "今日",
    daysAgo: (days) => `${days}日前`,
    daysLeft: (days) => `あと${days}日`,
    soon: "もうすぐ",
    months: (months) => `約${months}か月後`,
    years: (years) => `約${years}年後`,
    yearsHalf: (years) => `約${years}年半後`,
  },
};

const en: Strings = {
  common: {
    close: "Close",
    back: "Back",
    loadFailed: "The card could not be loaded. Please try again.",
    reload: "Reload",
    soundOff: "Mute sound",
    soundOn: "Turn sound on",
  },
  landing: {
    open: "Open the card",
    preparing: "Preparing your card…",
    hint: "Scroll or swipe to turn to the next side.",
    writtenIn: (when) => `A letter written in ${when}`,
    cometBack: "The comet has come back.",
  },
  reading: { swipe: "Scroll / swipe" },
  inside: { scrollOut: "Scroll to step outside", back: "Back outside" },
  completion: {
    replay: "Watch again",
    continues: "This letter goes on.",
    deploy: "Send it into orbit",
    hasInside: "This cube has an inside.",
    lookInside: "Look inside",
  },
  orbit: {
    tapStar: "Try tapping the star.",
    returned: "The promised comet has come back.",
    today: "Today",
    thisSeason: "This winter",
    aboard: "Your words are aboard too",
    lookInside: "Look inside",
    reread: "Read the letter again",
    bar: "Orbit",
    trail: "Follow the trail",
    replied: "Your reply arrived",
    reply: "Launch a reply",
    comet: "Comet",
    replyArrived: "Your reply arrived before the comet.",
    about: "About KARTA_SPACE",
  },
  about: {
    title: "About KARTA_SPACE",
    lead: "Not just a place to send words — a way to carry a connection forward.",
    intro: "A card in space that turns a goodbye into a promise to meet again.",
    more: "How it came about, and the thinking behind it: ",
    values: [
      {
        title: "Not an ending — a change",
        body: "The letter does not close. It becomes a satellite, circles in orbit, and comes back.",
      },
      {
        title: "A space for just the two of you",
        body: "The memories on the trail and the promised comet exist for this card alone.",
      },
      {
        title: "Sealed until the day",
        body: "Words put on the comet cannot be read by anyone until it returns — not the writer, not the sender.",
      },
      {
        title: "Words, connected across space",
        body: "The letter's words travel on the comet's light and the satellite's, all the way to the day you meet again.",
      },
      {
        title: "Quiet, and always dawn",
        body: "A slow sunrise instead of fireworks. The closer the reunion, the brighter the sky, and the further you have come.",
      },
    ],
  },
  intro: {
    label: "The promised comet",
    fallbackPromise: "We will meet again",
    untilBack: "Until the comet returns",
    daysBefore: "",
    daysAfter: (days) => (days === 1 ? " day to go" : " days to go"),
    arrived: "See you again!",
    wordsArrive: (from) => `On that day, the words on the comet reach ${from}.`,
    promiseOpens: (from) => `On that day, your promise with ${from} opens.`,
    skip: "Skip",
  },
  sheet: {
    label: "The promised comet",
    fromWords: (from) => `Words from ${from}`,
    yourWords: "Your words",
    addWords: "Add your words",
    promiseComet: "The promised comet",
    delivery: (when, from) => `They reach ${from} by ${when}.`,
    copied: "Copied",
    copyLink: "Copy the link to follow the comet",
    dialog: "Comet",
    returned: "The promised comet has come back.",
    leftIn: (when) => `It set out in ${when}.`,
    alsoDelivered: (from) => `Your words have reached ${from} too.`,
    toOrbit: "Back to orbit",
    kept: "This comet has kept its promise.",
    sealed: (from) => `Words from ${from} are aboard. They open on the day you meet again.`,
    stillWaiting: "The comet is still waiting for your words.",
    invite: "Would you like to put your own words on this comet?",
    unreadable: (from) => `Until then, not even ${from} can read them.`,
    notNow: "Not now",
    submit: "Put them on the comet",
    sending: "Boarding…",
    boarded: "Your words are aboard.",
    alsoAboard: "Your words are aboard too.",
    continue: "Continue",
    comesBack: (when) => `It comes back here by ${when}.`,
  },
  crossroads: {
    title: "What next",
    rocket: "Launch a rocket",
    rocketCost: (from) => `Straight to ${from}, ahead of the comet`,
    trail: "Follow your trail together",
    memories: (count) => (count === 1 ? "1 memory" : `${count} memories`),
    orbit: "See the comet's orbit",
    returnsAt: (when) => `Back by ${when}`,
    stay: "Stay in orbit",
  },
  reply: {
    title: "Launch a reply",
    how: (from) => `A rocket carrying your words overtakes the comet and reaches ${from}.`,
    submit: "Launch the rocket",
    sending: "Launching…",
    note: (from) => `To ${from} right away, ahead of the comet.`,
  },
  form: {
    name: "Your name",
    message: "Message",
    rateLimited: "Please wait a moment and try again.",
    failed: "It did not get through. Please try again.",
  },
  trajectory: {
    title: "The comet's orbit",
    bothAboard: (from) => `Words from ${from} and from you are aboard. They open on the day you meet again.`,
    sealed: (from) => `Words from ${from} are aboard. They open on the day you meet again.`,
    aria: (when) => `The comet's orbit. It comes back to your planet by ${when}.`,
    mini: (when) => (when ? `The comet's orbit. It returns by ${when}.` : "The comet's orbit"),
    home: "Your planet",
    meetHere: "Here, again.",
    back: "It came back",
    now: "Now, here",
  },
  trail: { further: "Scroll to go further back", back: "Back to orbit" },
  a11y: {
    trail: "Trail",
    comet: "Comet",
    fromWords: (from) => `Words from ${from}`,
  },
  gate: {
    label: "Enter the password",
    submit: "Open",
    pending: "Checking…",
    wrong: "That password is not right.",
    protected: "This card is protected by a password",
    hint: (hint) => `Hint: ${hint}`,
    tooMany: "Too many attempts. Please wait a while and try again.",
    failed: "That could not be checked. Please try again.",
    hide: "Hide password",
    show: "Show password",
  },
  index: {
    enter: "Please open your card from its link.",
    devList: (count) => `Development card list (${count})`,
  },
  cometPage: {
    notFound: "This comet could not be found.",
    returned: (name) => `${name}'s words have come back.`,
    boardedOn: (when) => `Boarded the comet in ${when}`,
    words: (name) => `Words from ${name}`,
    returnsOn: (when) => `Riding the promised comet, back by ${when}.`,
    daysLeft: (days) => (days === 1 ? "1 day to go" : `${days} days to go`),
  },
  defaults: { from: "the sender", replyPrompt: "Write a reply, if you like." },
  mail: {
    replySubject: (title) => `A reply to "${title}" has arrived`,
    replyLead: (name) => `${name} sent you a reply.`,
    cometSubject: (name, date) => `${name}'s words are on the comet (back by ${date})`,
    cometLead: (title, name) => `From "${title}", ${name} put their words on the comet.`,
    cometSealed: (date) => `They cannot be read until it comes back, by ${date}.`,
    cometLink: "Follow the comet, and read the words when they return, here:",
    cometKeep: "Please keep this email. Without the link, the comet cannot be found again.",
    daySubject: (label) => `Today is ${label}`,
    dayLead: (title) => `The comet from "${title}" comes back today.`,
    dayNudge: "Why not reach out to them?",
    dayCard: (url) => `Card: ${url}`,
    dayOpen: "If you received an email about words on the comet, its link opens them from today.",
    fallbackLabel: "the promised day",
    fallbackPromise: "Let's meet again.",
  },
  dates: {
    seasons: ["spring", "summer", "autumn", "winter"],
    year: (year) => `${year}`,
    month: (year, month) => `${MONTHS[month - 1]} ${year}`,
    day: (year, month, day) => `${MONTHS[month - 1]} ${day}, ${year}`,
    seasonOf: (year, season) => `${season} ${year}`,
    approx: (text) => `around ${text}`,
    thisSeason: (season) => `this ${season}`,
    nextSeason: (season) => `next ${season}`,
  },
  relative: {
    today: "today",
    daysAgo: (days) => (days === 1 ? "1 day ago" : `${days} days ago`),
    daysLeft: (days) => (days === 1 ? "1 day to go" : `${days} days to go`),
    soon: "soon",
    months: (months) => (months === 1 ? "in about a month" : `in about ${months} months`),
    years: (years) => (years === 1 ? "in about a year" : `in about ${years} years`),
    yearsHalf: (years) => `in about ${years}½ years`,
  },
};

const TABLES: Record<Lang, Strings> = { ja, en };

export function strings(lang: Lang | undefined): Strings {
  return TABLES[lang ?? "ja"];
}
