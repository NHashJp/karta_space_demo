# Access and security

Source: `lib/access.ts`, `lib/card.ts`, `app/c/[slug]/page.tsx`,
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
2. an optional password         CARD_PASSWORD
3. neither, if you want         (omit CARD_PASSWORD → link-only)
```

`getCardBySlug` accepts exactly one slug. Anything else renders the
invalid-card state — and renders nothing else, so a wrong slug reveals no
information about the real one.

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

The password is only ever compared on the server, against
`process.env.CARD_PASSWORD`, using `timingSafeEqual`.

On success the response sets a cookie whose value is derived from the password
itself:

```ts
HMAC-SHA256(key = CARD_PASSWORD, message = `karta-space:${slug}`)
```

This is the useful property: the token cannot be produced without knowing the
password, so it cannot be forged, and no secret is stored anywhere in the
client bundle. Verification recomputes the HMAC and compares it timing-safely.

Cookie attributes: `HttpOnly`, `Secure` in production, `SameSite=Lax`,
`Path=/`, **18 hour** lifetime (spec §17 suggests 12–24).

Changing `CARD_PASSWORD` invalidates every outstanding cookie automatically,
since the token is keyed by the password.

## Rate limiting

An in-memory map, **10 attempts per 10 minutes** per IP-and-slug, returning
`429`. Deliberately basic: it resets on every serverless cold start, so it
slows down a casual guesser and nothing more. Spec §29 lists this as desirable
rather than required. A real limit needs shared storage.

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
