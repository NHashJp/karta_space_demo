# KARTA_SPACE

A farewell letter as a 3D card. The reader opens a link, passes an optional
password, and turns a cube through six faces of text or photographs. At the end
the cube unfolds into a satellite and the card keeps going: a trail of shared
memories, a comet carrying a sealed message back on a chosen date, and a way to
reply. Cards are Japanese or English.

One Next.js app, no database. Each card is configuration on its own slug.

## Run it

Requires **Node 22.6+** (`.nvmrc` pins 22; `nvm use`).

```bash
npm install
npm run dev        # http://localhost:3000 — in development the root lists every card
```

Open a sample: `/c/2026-newyear-7k2m` (everything) or `/c/thanks-sample-3f9q`
(text only). English versions: `/c/newyear-en-k7m2q9x4`, `/c/thanks-en-r4t8w2p6`.
Write your own at `/editor`.

Copy `.env.example` to `.env.local` for passwords, mail and secrets; each
variable is explained in [deployment](./docs/deployment.md#2-environment-variables).

## Scripts

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build and serve |
| `npm run check` | typecheck, then the verify suite — the gate before deploying |
| `npm run verify` | the checks alone |
| `npm run images <slug>` | write two placeholder face images for a card |

## Documentation

Start with [docs/overview.md](./docs/overview.md); the full index is
[docs/README.md](./docs/README.md).
