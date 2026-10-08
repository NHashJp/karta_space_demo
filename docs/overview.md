# Overview

A farewell card you open in a browser: a cube floating in space with a message
on each of its six sides. When you reach the end it unfolds into a satellite and
the card keeps going. The core idea is **さようなら becomes またね** — a goodbye
turned into a promise to meet again.

One person writes it, one person reads it. No accounts, no database, no feed.

## The two people

| | |
|---|---|
| **Sender** | writes the card in `/editor`, deploys it, sends the link and password |
| **Receiver** | opens the link, reads, and may write back — never signs in, never gives an email address |

Anything the receiver writes is emailed to the sender and stored nowhere.

## The journey

1. **Landing** — the title and one button.
2. **Six faces** — one gesture turns one face. Each is a paragraph or a photograph.
3. **Closing screen** — a farewell line drawn by hand, then the sender's
   signature; then the offers to go on (into orbit, and inside the cube).
4. **Inside the cube** *(optional)* — one short line on the inner wall.
5. **Deployment** — the cube grows solar panels and rises into orbit.
6. **The hub** — the satellite, a planet with the sun rising over it, the comet,
   a trail of memories, and a sky with company in it.
7. **The comet** — the first time, an intro shows how many days until it comes
   back and plays its whole way home while the number counts down; then the
   card offers to put the receiver's words on it, sealed until that day.
8. **Onward** — reply by rocket (arrives now), walk the trail of memories
   (newest first), or look at the comet's orbit.

Steps 4–8 are optional; a card with none of them ends at step 3.

## Principles

These shape every decision; the `?` button in the hub states them to the reader.

- **Transformation over ending.** The letter does not close; it becomes the
  thing that comes back.
- **Every feature is a real space object.** The trail is where the cube has
  been, the comet goes far away and returns on schedule, the rocket is fast.
  When the metaphor and the mechanics agree, nothing needs explaining.
- **The countdown is the sky.** The comet's position and the height of the
  rising sun *are* how long is left; the closer the reunion, the brighter the sky.
- **Offers wait.** Nothing new appears while the reader is still taking in the
  ending.
- **Alive, not busy; joyful, not loud.** Everything drifts a little, nothing
  darts, nothing moves behind text being read. Small moments of joy, no
  fireworks.
- **Seal on the server.** What is promised unreadable until a date never reaches
  a browser before then.
- **A feature nobody can deliver is not offered.** Without mail configured, the
  reply and the comet's invitation simply do not appear.
- **Warm means the receiver's.** Warm light marks what is theirs or what has
  opened; everything else stays ion-blue.

## Glossary

| Term | Meaning |
|---|---|
| Slug | a card's identifier in its URL (`/c/<slug>`), also its folder and password variable name |
| Hub | the orbit view after the closing screen |
| Trail / contrail | the ribbon of memories behind the satellite |
| Comet | the sender's promise; it leaves, and returns on `returnsOn` |
| Capsule | the receiver's words put on the comet, sealed until the same day |
| Dawn `p` | 0.2–1, how far the sun has risen; a function of the comet's progress |
| Deployment | the cube-to-satellite animation (not the Vercel kind) |
