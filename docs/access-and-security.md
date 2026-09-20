# Access and security

Source: `lib/access.ts`, `lib/cards.ts`, `app/c/[slug]/page.tsx`,
`app/api/access/route.ts`

## What this protects against

Be clear about the threat model, because the spec is (spec §29):

- **Does** stop a casual visitor without the link or the password from reading
  the card.
- **Does** stop the card's text reaching a browser that has not been granted
  access.
- **Does not** make the card confidential. A custom slug is obscurity, not
  authentication. Images in `/public` are fetchable by direct URL by anyone who
  knows the path.

It is demo access control. Do not put anything sensitive behind it.

## The three gates

```
1. an unguessable slug          /c/2026-newyear-7k2m
2. a per-card password          CARD_PASSWORD_2026_NEWYEAR_7K2M
3. or a shared fallback         CARD_PASSWORD
4. or neither, if you want      (link-only)
```

`getCardBySlug` accepts only slugs in the registry. Anything else renders the
invalid-card state — and renders nothing else, so a wrong slug reveals no
information about a real one.

The root route never lists cards in production, for the same reason: with many
cards on one deployment, an index page would turn every unguessable slug into a
guessed one. In development it *is* the card index, which is the convenient
half of the same trade.

## One password per card

`cardPassword(slug)` resolves in order:

```
process.env[`CARD_PASSWORD_${SLUG}`]   per card; SLUG upper-cased, non-alphanumerics as _
process.env.CARD_PASSWORD              shared fallback for every other card
undefined                              link-only
```

So cards can be mixed freely — some gated with their own password, some open —
without touching `cards.config.ts`. **No password is ever written into the
config file**, which is what makes that file safe to commit and to hand to
whoever writes the messages.

## Content withholding

The card page is a **server component**. The decision and the content live on
the same side of the network boundary:

```tsx
const card = getCardBySlug(slug);
if (!card) return <InvalidCard />;

if (passwordRequired() && !(await hasAccess(card.slug))) {
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

The password is only ever compared on the server, against the environment
variable resolved for that card, using `timingSafeEqual`.

On success the response sets a cookie whose value is derived from the password
itself:

```ts
HMAC-SHA256(key = that card's password, message = `karta-space:${slug}`)
```

This is the useful property: the token cannot be produced without knowing the
password, so it cannot be forged, and no secret is stored anywhere in the
client bundle. Verification recomputes the HMAC and compares it timing-safely.

Cookie attributes: `HttpOnly`, `Secure` in production, `SameSite=Lax`,
`Path=/c/<slug>`, **18 hour** lifetime (spec §17 suggests 12–24).

The cookie is named `ks_access_<slug>` and scoped to that card's path, so one
browser can hold access to any number of cards at once, opening a second card
never evicts the first, and a card's cookie is not even sent to another card.

Changing a card's password invalidates its outstanding cookies automatically,
since the token is keyed by the password.

## Rate limiting

An in-memory map, **10 attempts per 10 minutes** per IP-and-slug, returning
`429`. Expired entries are swept whenever a new window opens, so the map does
not grow with the number of cards served. Deliberately basic: it resets on every serverless cold start, so it
slows down a casual guesser and nothing more. Spec §29 lists this as desirable
rather than required. A real limit needs shared storage.

## The editor is development-only

`/editor` and `POST /api/editor` both refuse to do anything when
`NODE_ENV === "production"`: the page renders a notice instead of the cards,
and the route returns `403` without touching the filesystem. Two separate
reasons, either one sufficient:

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
of scope for v0.1 and neither is needed for a demo card.
