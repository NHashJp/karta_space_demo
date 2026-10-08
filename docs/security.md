# Security

Source: `lib/access.ts`, `lib/password.ts`, `app/c/[slug]/page.tsx`,
`app/api/access/route.ts`, `app/c/[slug]/media/`, `lib/cometSeal.ts`,
`lib/clientCard.ts`, `lib/editorGuard.ts`

This is demo access control: it keeps a casual visitor out of a card and keeps
cards apart from each other. It is not confidentiality — do not put anything
sensitive behind it.

## What a visitor without access gets

Nothing of the card. `app/c/[slug]/page.tsx` is a server component: an unknown
slug is a 404, and a card that needs a password returns the gate *instead of*
the card, so no title, text, path or picture is in the page. The production
root lists no cards, so slugs cannot be enumerated.

## Passwords

`cardSecret(slug)` resolves in order:

1. `CARD_PASSWORD_<SLUG>` (slug upper-cased, non-alphanumerics as `_`)
2. `access.passwordHash` in the card, issued by the editor
3. `CARD_PASSWORD`, shared by every other card
4. none — the card is link-only

The editor's hash is `scrypt` (N = 2^15, r = 8, p = 1, 32 bytes, 16-byte salt),
compared with `timingSafeEqual`; a shortened hash is refused. The plaintext
lives only in the gitignored `.karta/secrets.local.json`.

Passwords are **normalised** before hashing and checking — NFKC, trimmed, spaces
and hyphens dropped, lower-cased, katakana to hiragana — so `カマクラ`, `かまくら`
and `ｶﾏｸﾗ` are one password. Generated ones are 8 characters from an alphabet
without look-alikes (~39.6 bits), shown as `K7QM-2XPA`. The gate lets the reader
reveal what they typed.

Attempts are limited to 10 per 10 minutes per IP and card, in memory — it resets
on a serverless cold start, so it only slows a casual guesser.

## The access cookie

`ks_access_<slug>`, scoped to `/c/<slug>`, HttpOnly, `Secure` in production,
`SameSite=Lax`, 18 hours. Its value is an HMAC: keyed by the environment
password, or by `ACCESS_SECRET` over the card's hash. It cannot be forged
without the secret, a new password invalidates every old cookie, and one
browser can hold many cards without any one opening another. A hash-protected
card with no `ACCESS_SECRET` **fails closed**.

## Private pictures

Every picture — cube faces and memory photographs — lives in
`private/cards/<slug>/`, outside the served folder, and reaches the browser only
through `GET /c/<slug>/media/<file>`:

- under `/c/<slug>/` so the card's cookie is sent, and checked with the same
  `canView` as the page;
- traversal, absolute paths and drive letters refused before touching the disk,
  then the resolved path re-checked inside the card's own folder;
- five image types only, `nosniff`, `Cache-Control: private`;
- every refusal is the same 404, so the folder cannot be mapped by probing.

The build traces `private/cards/**` into this route (`next.config.ts`), so the
files ship with the function on Vercel.

## Sealed messages

- **The sender's comet message** is simply absent from the page before its
  return date — `toClientCard` leaves it out, rather than hiding it.
  `npm run verify` searches the whole serialised payload to prove it, and that no
  environment value or password hash appears in it either. `?now=` is inert in
  production for the same reason.
- **The receiver's words** become the link: `{slug, name, body, dates}` encrypted
  with AES-256-GCM under `COMET_SECRET`. The dates are inside the ciphertext, so
  they cannot be edited to open early; any change to the token makes it fail.
  Before the date the server decrypts but never returns the body.

The honest limit: **whoever holds `COMET_SECRET` can open any comet at any
time**, and here the sender is also the operator. Rotating the secret loses
every comet still on its way, and the email link is the only copy.

## The signature

Kept inside the card (behind its password), and rebuilt on the server from its
own path data before reaching the page, so only stroked paths are ever inserted
into the document.

## The editor

Every editor page and route refuses in production (`lib/editorGuard.ts`, one
guard for all of them). Locally, `EDITOR_PASSWORD` adds a lock — useful on a
shared network or a tunnel, since the editor writes files and shows plaintext
passwords. Its cookie lasts 12 hours and is an HMAC over the password.

## Not indexed

`robots: noindex` in metadata, an `X-Robots-Tag: noindex, nofollow` header on
every route, and a `robots.txt` that disallows everything.

## Limits, stated plainly

- A slug is obscurity, not authentication; the hint is visible to anyone with
  the link.
- If the repository is ever public, a short custom password's hash can be
  attacked offline — use a generated one, and keep the repository private.
- Anything committed (sample cards, pictures) stays in git history.
