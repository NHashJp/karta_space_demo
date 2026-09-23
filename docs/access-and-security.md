# Access and security

Source: `lib/access.ts`, `lib/password.ts`, `lib/cards.ts`, `app/c/[slug]/page.tsx`,
`app/api/access/route.ts`, `app/page.tsx`, `app/api/editor/route.ts`

## What this protects against

Be clear about the threat model, because the spec is (spec §29):

- **Does** stop a casual visitor without the link or the password from reading
  the card.
- **Does** stop the card's text reaching a browser that has not been granted
  access.
- **Does** keep cards separate from one another: access to one card grants
  nothing on any other, even on the same deployment and in the same browser.
- **Does** keep a card's *memory photographs* behind the password, not only its
  text (v0.2, below).
- **Does not** make a card confidential. A custom slug is obscurity, not
  authentication. Cube-face images in `/public` are still fetchable by direct
  URL by anyone who knows the path.

It is demo access control. Do not put anything sensitive behind it.

## The gates

```
1. an unguessable slug          /c/2026-newyear-7k2m
2. a per-card password          CARD_PASSWORD_2026_NEWYEAR_7K2M
3. or a hash in the config      access.passwordHash, issued by the editor
4. or a shared fallback         CARD_PASSWORD
5. or neither, if you want      (link-only)
```

`getCardBySlug` accepts only slugs in the registry. Anything else renders the
invalid-card state — and renders nothing else, so a wrong slug reveals no
information about a real one.

The root route never lists cards in production, for the same reason: with many
cards on one deployment, an index page would turn every unguessable slug into a
guessed one. In development it *is* the card index, which is the convenient
half of the same trade.

## One password per card

`cardSecret(slug)` resolves in order (spec v0.2 §14.9):

```
process.env[`CARD_PASSWORD_${SLUG}`]   per card; SLUG upper-cased, non-alphanumerics as _
card.access.passwordHash               a scrypt hash the editor wrote into the config
process.env.CARD_PASSWORD              shared fallback for every other card
none                                   link-only
```

So cards can be mixed freely — some gated with their own password, some open.
An environment password always wins, so **every card that worked in v0.1 keeps
behaving exactly as it did**, whatever is in the config.

v0.1 kept passwords only in environment variables. That is safe, but sharing a
new card meant editing Vercel's settings and waiting for a restart. v0.2 adds a
second path so the editor can issue a password on the spot, without weakening
the first:

| What | Where | Committed? |
|---|---|---|
| The password in plain text | `.karta/secrets.local.json`, so the editor can show it again | **no** (gitignored) |
| A salted scrypt hash | `access.passwordHash` in `cards.config.ts` | yes |
| A hint, optional | `access.hint`, shown on the gate | yes |
| The cookie signing key | `ACCESS_SECRET` in the environment | no |

**The plaintext password is still never committed.** What goes into the config
is `scrypt(normalised, salt16, N = 2^15, r = 8, p = 1, keylen 32)`, stored as
`scrypt$32768$8$1$<salt b64>$<hash b64>` and compared with `timingSafeEqual`.
A hash shorter than the full 32 bytes is refused outright: scrypt's output is a
prefix under truncation, so a shortened hash would still verify while matching
on far fewer bits.

## A forgiving password

A card password is often the answer to a hint only two people know — *the
station where we first met* — and someone typing that on a phone should not
fail on a katakana keyboard, a stray space, or a capital letter. So both sides
are normalised before they are compared (`lib/password.ts`, spec v0.2 §7):

```
NFKC  ->  trim  ->  drop spaces and hyphens  ->  lowercase  ->  katakana to hiragana
```

`カマクラ`, `かまくら` and `ｶﾏｸﾗ` are therefore one password, and so are
`k7qm 2xpa` and `K7QM-2XPA`. The same normalisation runs before hashing and
before checking, and **environment passwords go through it too** — the
forgiveness is a property of the gate, not of where the password is kept.

Generated passwords are 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` —
no `0`/`O` and no `1`/`I`/`L`, because these get read aloud and typed by hand —
shown as `K7QM-2XPA`. That is about 39.6 bits, drawn with rejection sampling so
all 31 letters stay equally likely. A custom password is allowed; the editor
warns below 8 characters.

### Honest limits

- This is still demo access control.
- If the repository is public, the hash can be attacked offline. A generated
  password resists that; a short custom answer does not. Keep the repository
  private, or use a generated password.
- The hint is public to anyone who has the link. Write one that means something
  to one person, not one that narrows the answer for everyone else.
- The rate limit is still in-memory (below).

## Private photographs (v0.2)

A card's memories are the one genuinely personal part of it — photographs of
two people, rather than written text about them. In v0.1 anything in `/public`
was fetchable by anyone who knew the path, password or no password, which was
an acceptable trade for a picture of a nebula and not for this.

So memory images live in `private/cards/<slug>/`, outside the served
directory, and reach the browser only through
`GET /c/[slug]/media/[...path]` (spec v0.2 §14.3):

- the route is **under `/c/[slug]/`** because that is where the access cookie
  is scoped — anywhere else and the browser would not send it;
- it calls the same `canView` as the page;
- it rejects traversal, absolute paths and drive letters *before* touching the
  disk, and then re-checks the **resolved** path is still inside the card's own
  folder, because normalisation is the step that turns a clever relative path
  into a real one;
- it serves only five image types, by extension, with `nosniff`;
- `Cache-Control: private` — a shared cache must never hold a photograph
  fetched with someone else's cookie;
- and every refusal is the same bare 404. A missing file, a wrong extension and
  a card the reader cannot open are indistinguishable from outside, so the
  folder cannot be mapped by probing it.

Cube-face images may stay in `/public` for v0.2; migrating them is optional and
deferred.

One deployment note: the route builds its path from the request, so the build's
tracer cannot see which files it will need. `outputFileTracingIncludes` in
`next.config.ts` names `private/cards/**` for that route, or the photographs
might not be bundled at all on a serverless deployment. Resolving the root once
at module scope rather than per request also stops the tracer falling back to
tracing the whole project.

## One check per receiver-facing route

`canView(slug)` is the single gate every route under `/c/[slug]/…` uses: a
link-only card passes, a password card needs its cookie. Routes must live under
that path precisely because the cookie is scoped to it (spec v0.2 §14).

It is card access, not receiver authentication. The receiver never signs in,
and v0.2 does not change that: a name typed into a reply form is the only
identity they ever give.

## Sealed content never reaches the browser

A card may carry a message that is promised unreadable until a date — the
sender's comet. `lib/clientCard.ts` is where that promise is kept: it builds
the payload the page sends, and before the return date the message is simply
not in it. Not hidden by CSS, not behind a flag — absent.

`npm run verify` section 8 covers the gate itself: the normalisation table
above, the hash round-trip and its rejections, the precedence order, and the
two cookie properties (a new hash or a rotated `ACCESS_SECRET` invalidates the
old one; no `ACCESS_SECRET` issues none at all).

Section 7 asserts both directions of the seal by searching `JSON.stringify` of
the payload, and asserts that no environment value (`RESEND_API_KEY`, `NOTIFY_TO`,
`COMET_SECRET`, `ACCESS_SECRET`) and no `access.passwordHash` ever appears in
it. The dev-only `?now=` time travel is ignored in production for the same
reason: a query parameter that unseals a message would be no seal at all.

## The comet's seal, and its honest limit

A receiver can write a message that is unreadable until a date. With no
database, the message cannot be *kept* somewhere and released later — so the
message **is** the link: `{v, slug, name, body, releasedOn, returnsOn}`
encrypted with AES-256-GCM under `COMET_SECRET`, a random 12-byte IV, and
`karta-comet-v1` as additional authenticated data. The token is
base64url(`iv ‖ ciphertext ‖ tag`), about 260 characters, which fits in a link.

**The dates are inside the ciphertext.** If `returnsOn` sat beside the token as
a query parameter, anyone holding the link could edit it and open the comet
early. Inside, changing it means changing the ciphertext, and GCM refuses to
decrypt anything that has been altered at all — `npm run verify` section 17
flips a bit at positions across the whole token and asserts every one fails.

`open()` decrypts before the return date too, because the dates it needs are in
there — but it does not *return* the body. The page that calls it cannot leak
what it was never handed.

### The limit, stated plainly

This is a promise kept by software, not protection from the operator. **Whoever
holds `COMET_SECRET` can open any comet at any time**, and in the MVP the
sender is also the operator. The seal stops a curious person peeking at a link
they were sent; it does not stop a determined one who also runs the server.

A seal described as stronger than it is would be worse than no seal at all, so:

- rotating `COMET_SECRET` **loses every comet still on its way**. They are not
  stored anywhere to re-encrypt;
- the link is the only copy. If the sender deletes the email, the message is
  gone — the email itself says so;
- the token is never written to the receiver's browser storage. It is their
  message, and keeping a copy is their decision, offered as a button rather
  than done quietly on their behalf.

## Content withholding

The card page is a **server component**. The decision and the content live on
the same side of the network boundary:

```tsx
const card = getCardBySlug(slug);
if (!card) return <InvalidCard />;

if (passwordRequired(card.slug) && !(await hasAccess(card.slug))) {
  return <PasswordGate slug={card.slug} />;
}

return <CardExperience card={card} />;
```

When the gate is returned, `card` is never serialised into the response. There
is no client-side redirect, no hidden element, nothing to read out of the
document. The gate also shows neutral branding rather than the card title, so
even the title does not leak.

You can confirm this from the shell:

```console
$ curl -s http://localhost:3000/c/2026-newyear-7k2m | grep -c "あけましておめでとう"
0
```

## Password check and cookie

The password is only ever compared on the server, against the secret resolved
for that card, using `timingSafeEqual`.

On success the response sets a cookie whose value is derived from that secret:

```ts
// an environment password, exactly as in v0.1
HMAC-SHA256(key = that card's password, message = `karta-space:${slug}`)

// a hash issued by the editor
HMAC-SHA256(key = ACCESS_SECRET, message = `karta-space:${slug}:${passwordHash}`)
```

This is the useful property: the token cannot be produced without knowing the
secret, so it cannot be forged, and no secret is stored anywhere in the client
bundle. Verification recomputes the HMAC and compares it timing-safely.

A hash-protected card **fails closed**. Without `ACCESS_SECRET` there is no key
to sign a cookie with, so the card stays shut rather than falling open: the
access route answers `503`, and `hasAccess` returns false even for the right
password. Rotating `ACCESS_SECRET` signs everyone out of every hashed card.

Cookie attributes: `HttpOnly`, `Secure` in production, `SameSite=Lax`,
`Path=/c/<slug>`, **18 hour** lifetime (spec §17 suggests 12–24).

The cookie is named `ks_access_<slug>` and scoped to that card's path, so one
browser can hold access to any number of cards at once, opening a second card
never evicts the first, and a card's cookie is not even sent to another card.

Changing a card's password invalidates its outstanding cookies automatically,
since the token is keyed by the secret — a new hash is a new key, exactly as a
new environment password is.

## Rate limiting

An in-memory map, **10 attempts per 10 minutes** per IP-and-slug, returning
`429`. Expired entries are swept whenever a new window opens, so the map does
not grow with the number of cards served.

Deliberately basic: it resets on every serverless cold start, so it slows down
a casual guesser and nothing more. Spec §29 lists this as desirable rather than
required. A real limit needs shared storage.

## The editor is development-only

`/editor` and `POST /api/editor` both refuse to do anything when
`NODE_ENV === "production"`: the page renders a notice instead of the cards,
and the route returns `403` without touching the filesystem. Note what the
editor is *not* — it is not a way past the password gate, because it only ever
runs where the card content is already on the same machine as the person
editing it. Two separate reasons it stays out of production, either one
sufficient:

- a deployed filesystem is read-only, so a save could not work anyway;
- an unauthenticated write endpoint on a public deployment would let anyone
  rewrite every card on it.

If the editor ever needs to run on a deployment, it needs real authentication
and somewhere other than the repository to write to — which is the same change
that would replace the config file with a database.

## Search engine visibility

Three layers, because one is easy to defeat by accident (spec §18):

- `robots: { index: false, follow: false, nocache: true }` in both the root
  layout metadata and the card page metadata;
- an `X-Robots-Tag: noindex, nofollow` response header on every route, set in
  `next.config.ts`;
- `public/robots.txt` disallowing everything.

## If you need more

The spec's own guidance, and the honest answer: move images to authenticated
private object storage, and put real sessions behind a database. Both are out
of scope for v0.1 and neither is needed for demo cards.
