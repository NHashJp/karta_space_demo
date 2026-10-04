# KARTA_SPACE — architecture explained simply

This project is a website for sending a personal letter as an interactive 3D
card. The reader opens a link, enters a password if one is required, and moves
through six sides of a cube. A card can also include a hidden line inside the
cube, photographs of memories, a comet carrying a future message, and a reply
form.

This guide describes the current code. Some older READMEs and comments still
describe the earlier version, particularly where the editor saves cards and
which features exist after the closing screen.

## 1. The basic structure

There is **one Next.js application**, containing both the website and its
server endpoints. There is no separate backend project and no database.

Think of it as four cooperating parts:

| Part | Its job | Where it lives |
| --- | --- | --- |
| Card data | Describes the words, images, dates, and optional features of each letter. | `config/`, `.karta/`, `types/` |
| Server | Finds the requested card, checks access, reads private images, and sends email. | `app/` routes and server helpers in `lib/` |
| Interactive screens | Handles buttons, forms, navigation, and which stage the reader is in. | `components/card/`, `components/access/`, `components/editor/` |
| 3D scene | Draws and animates the cube, camera, stars, planet, comet, and memory trail. | `components/three/` |

The server runs on your computer during development and on the hosting
service after deployment. The interactive experience runs in the reader's
browser. Client components can also have initial HTML prepared on the server;
their browser JavaScript makes them interactive.

## 2. What the technologies mean

| Technology | Plain-language explanation | Role here |
| --- | --- | --- |
| Next.js | A framework that connects web pages to URLs and provides server functionality. | Routing, page rendering, and request handlers. |
| React | Builds screens from reusable pieces called components. | Forms, overlays, and the coordination of the experience. |
| TypeScript | JavaScript with descriptions of what kinds of data are allowed. | Helps catch mistakes, such as an invalid card field. |
| Three.js | A library for drawing 3D objects in the browser. | Geometry, materials, lighting, and camera math. |
| React Three Fiber | Lets React components describe a Three.js scene. | The `Canvas` and per-frame animation hooks. |
| Drei | Ready-made helpers for React Three Fiber. | Helpers such as placing HTML text in a 3D scene. |
| GSAP | An animation library. | Animation work such as cube transitions. |
| GLSL shaders | Small programs executed by the graphics processor. | Visual effects such as stars, nebulae, glows, and planet surfaces. |

A `.ts` file usually contains data or logic. A `.tsx` file can also contain
React markup describing a screen or 3D component. CSS files control the look
of ordinary page elements. JSON files store structured data or settings.

## 3. What happens when someone opens a card

A **slug** is the card's identifier in its URL. In `/c/thanks-sample-3f9q`,
the slug is `thanks-sample-3f9q`. The folder name `[slug]` means that Next.js
accepts different values in that position.

```text
Reader opens /c/<slug>
          |
          v
app/c/[slug]/page.tsx              Server finds the card and checks access
          |
          +-- Unknown card ------> 404 page
          |
          +-- Password needed ---> PasswordGate -> /api/access -> access cookie
          |
          v
lib/clientCard.ts                  Prepares the data the browser may receive
          |
          v
CardExperience.tsx                 Coordinates screens and reader actions
          |
          +--> Ordinary HTML       Titles, controls, forms, and overlays
          |
          +--> CubeScene.tsx       3D canvas, objects, and camera animation
```

Password checking happens on the server. Before access is granted, the
server returns the password screen instead of sending the card content.
After access is granted, `toClientCard()` removes the password hash and
withholds the sender's sealed comet message until its return date. Dates are
calculated using the card's time zone.

Reading and rotating the cube happen locally in the browser. Loading private
photographs, submitting replies, and submitting comet messages make further
requests to the server.

## 4. The major files and their roles

### Pages and server endpoints

In `app/`, a `page.tsx` defines a page and a `route.ts` handles a request,
such as receiving a form submission or returning an image. An **API** is the
request interface the browser uses to ask the server to do something.

| File or folder | Role |
| --- | --- |
| [app/layout.tsx](app/layout.tsx) | Shared page shell, fonts, and site metadata. |
| [app/globals.css](app/globals.css) | Shared styling for the screens, controls, and editor. |
| [app/page.tsx](app/page.tsx) | Home page: lists cards during development; shows a neutral notice in production. |
| [app/c/[slug]/page.tsx](app/c/[slug]/page.tsx) | Main entry point for a card. Looks it up, checks access, and prepares browser data. |
| [app/api/access/route.ts](app/api/access/route.ts) | Checks a card password and issues an access cookie. |
| [app/c/[slug]/media/[...path]/route.ts](app/c/[slug]/media/[...path]/route.ts) | Serves a card's private memory pictures after checking access. |
| [app/c/[slug]/reply/route.ts](app/c/[slug]/reply/route.ts) | Validates a reply and emails it to the sender. |
| [app/c/[slug]/comet/route.ts](app/c/[slug]/comet/route.ts) | Encrypts the reader's comet message into a token and emails its link. |
| [app/comet/[token]/page.tsx](app/comet/[token]/page.tsx) | Opens a token link and decides whether its message can be read yet. |
| [app/editor/page.tsx](app/editor/page.tsx) | Opens the local authoring interface in development. |
| [app/api/editor/](app/api/editor/) | Endpoints for saving, uploads, signatures, sharing, setup, and checking the deployed card. |
| [app/api/cron/comets/route.ts](app/api/cron/comets/route.ts) | Scheduled endpoint that sends comet-return reminders for configured sample/source cards. It reads `config/cards.config.ts` directly. |

### Content and reusable logic

The `lib/` folder contains helpers. Some are browser helpers, some use
server-only features such as file access or encryption, and some are plain
calculations usable by either environment.

| File | Role |
| --- | --- |
| [config/cards.config.ts](config/cards.config.ts) | Committed sample cards; can also be edited by hand. |
| [types/card.ts](types/card.ts) | Defines the card's data structure: exactly six faces and its optional features. |
| [lib/cards.ts](lib/cards.ts) | Combines sample and local cards, validates them, and finds a card by slug. |
| [lib/localCards.ts](lib/localCards.ts) | Reads and writes `.karta/cards.local.json`; local cards override samples with the same slug. |
| [lib/cardsFile.ts](lib/cardsFile.ts) | Connects editor saves to local storage on disk and lists available public images. Also contains a separate helper to write the sample config. |
| [lib/cardRules.ts](lib/cardRules.ts) | Shared validation rules used by card loading and the editor. |
| [lib/clientCard.ts](lib/clientCard.ts) | Converts full server data into the version safe and useful for the browser. |
| [lib/access.ts](lib/access.ts), [lib/password.ts](lib/password.ts) | Password checks, password hashes, access cookies, and rate limiting. |
| [lib/experienceState.ts](lib/experienceState.ts) | Rules for moving between stages of the experience. |
| [lib/useFaceNavigation.ts](lib/useFaceNavigation.ts) | Turns wheel, touch, and keyboard input into navigation actions. |
| [lib/timing.ts](lib/timing.ts), [lib/deployment.ts](lib/deployment.ts) | Animation durations and the timeline for unfolding the cube into a satellite. Here, “deployment” means that animation. |
| [lib/cometOrbit.ts](lib/cometOrbit.ts), [lib/orbitClock.ts](lib/orbitClock.ts) | Comet cycles, progress, and time-zone-aware date calculations. |
| [lib/cometSeal.ts](lib/cometSeal.ts) | Encrypts and opens comet tokens, with a return-date check. |
| [lib/mail.ts](lib/mail.ts), [lib/notify.ts](lib/notify.ts) | Email templates, delivery through Resend, and checks for required mail settings. |
| [lib/sound.ts](lib/sound.ts) | Synthesized sound effects using browser audio. |
| [lib/localMarks.ts](lib/localMarks.ts), [lib/cometVisit.ts](lib/cometVisit.ts) | Browser records of actions and comet visits, so later visits can adapt. |
| [lib/editorGuard.ts](lib/editorGuard.ts), [lib/editorAccess.ts](lib/editorAccess.ts) | Restricts editor endpoints to development and applies the optional editor password. |
| [lib/secretsFile.ts](lib/secretsFile.ts) | Keeps editor-issued plaintext sharing passwords in a local, gitignored file. |

### Screens and graphics

| File or folder | Role |
| --- | --- |
| [components/card/CardExperience.tsx](components/card/CardExperience.tsx) | Main coordinator: connects the state machine, navigation, scene, screens, sound, and submissions. |
| [components/card/](components/card/) | Landing and closing screens, progress indicators, reply forms, comet sheets, and memory overlays. |
| [components/access/](components/access/) | Card and editor password screens. |
| [components/editor/EditorShell.tsx](components/editor/EditorShell.tsx) | Holds editor draft data and coordinates editing and saving. |
| [components/editor/sections/](components/editor/sections/) | Individual editing sections for basics, faces, memories, orbit, closing, links, and sharing. |
| [components/editor/PreviewPane.tsx](components/editor/PreviewPane.tsx) | Shows a card preview with development controls for jumping to stages and dates. |
| [components/three/CubeScene.tsx](components/three/CubeScene.tsx) | Assembles the entire 3D canvas, including the cube and later orbit features. |
| [components/three/MessageCube.tsx](components/three/MessageCube.tsx) | Builds and animates the cube and its satellite form. |
| [components/three/CameraRig.tsx](components/three/CameraRig.tsx) | Controls the camera's movement through reading, the cube interior, orbit, and memories. |
| [components/three/TextFace.tsx](components/three/TextFace.tsx), [ImageFace.tsx](components/three/ImageFace.tsx), [SecretFace.tsx](components/three/SecretFace.tsx) | Draws the different kinds of cube content. |
| [components/three/SpaceEnvironment.tsx](components/three/SpaceEnvironment.tsx) | Groups the background nebula, stars, and wandering lights. |
| [components/three/OrbitScene.tsx](components/three/OrbitScene.tsx), [Comet.tsx](components/three/Comet.tsx), [Trail.tsx](components/three/Trail.tsx) | Builds the planet/orbit setting, promise comet, and path through memories. |
| [components/three/framing.ts](components/three/framing.ts) | Calculates camera positions and content sizing for different screen sizes. |
| [components/three/rotationPresets.ts](components/three/rotationPresets.ts) | Defines face orientations and the cube's rotation paths. |
| [components/three/shaders/](components/three/shaders/) | Graphics programs that determine how procedural scene effects look. |
| [components/text/StrokeText.tsx](components/text/StrokeText.tsx) | Draws the closing text with a stroke animation. |

## 5. How the interaction and animation fit together

The central idea is a **state machine**: a list of stages and rules about which
stage can follow another. For example:

```text
landing -> entering -> reading -> transitioning -> reading
                          |
                  after the sixth face
                          v
                      leaving -> completed -> deploying -> orbit
                                              (if the card has orbit features)
```

Optional branches allow entering the cube, exploring memories, opening the
comet, or sending a reply. `lib/experienceState.ts` defines those rules;
`CardExperience.tsx` uses them through React's `useReducer`.

For example, a swipe produces a `move` event. The state machine decides
whether it is allowed and selects the next face. The cube animates the
rotation, then reports `rotationEnd`, allowing the next gesture. This keeps
rapid input from skipping through unfinished animations.

React tracks meaningful changes such as “we are now reading face 3.” The 3D
components handle the small movements between those changes using `useFrame`,
which runs each animation frame. They update Three.js objects and stored
references directly, so the whole React interface does not need to render
again for every tiny movement.

The page mixes normal HTML with a 3D canvas. Buttons and forms are mostly
ordinary web elements; the cube and space effects are drawn using WebGL, the
browser's graphics interface. Some face text is HTML positioned in 3D.

## 6. Where the data actually lives

| Data | Location | What to understand |
| --- | --- | --- |
| Sample cards | `config/cards.config.ts` | Part of the repository and normal deployment. |
| Editor-saved cards | `.karta/cards.local.json` | Local and gitignored. Saving in the editor does **not** publish them. |
| Editor-issued sharing passwords | `.karta/secrets.local.json` | Local and gitignored; their hashes are stored with the corresponding card data. |
| Cube images and signature SVGs | `public/cards/<slug>/` | Directly available by URL, independently of the card password screen. |
| Memory photographs | `private/cards/<slug>/` | Served through the card's access-checked media route. |
| Server settings and secrets | Environment variables; usually `.env.local` in development | Configure passwords, encryption, email, and the deployed website URL. |
| Visit/action markers | Browser `localStorage` | Small records on that browser; these are not a shared database. |
| Reader replies | Sender's email inbox | Sent by email rather than stored in an application database. |
| Reader comet messages | Encrypted token in a link | The link carries the message; the server checks the return date before revealing it. |

The editor runs in development only. A normal Git-based deployment does not
include `.karta/`, so a locally saved card needs a deliberate way to reach the
deployed application. The current project has no built-in publishing service
or database for those local cards. See [the deployment guide](docs/deployment.md)
for this limitation.

## 7. Supporting files and commands

| File or folder | Role |
| --- | --- |
| [package.json](package.json) | Lists the packages the app depends on and commands you can run. |
| [tsconfig.json](tsconfig.json) | TypeScript settings and the `@/` shortcut for imports from the project root. |
| [next.config.ts](next.config.ts) | Next.js settings, no-index response headers, and inclusion of private photos in the server build. |
| [vercel.json](vercel.json) | Schedules the comet reminder endpoint daily at midnight UTC. |
| [.gitignore](.gitignore) | Keeps dependencies, generated builds, and local card/settings files out of Git. |
| [scripts/](scripts/) | Verification scripts for logic, geometry, framing, and orbiters, plus a placeholder-image generator. |
| [docs/](docs/README.md) | More detailed explanations, specifications, and manual testing guidance. |

```bash
npm install          # Install dependencies
npm run dev          # Start the local app; open http://localhost:3000
npm run check        # Check TypeScript and run the verification scripts
npm run build        # Create the production build
npm run start        # Serve that production build locally
```

`node_modules/` contains installed packages and `.next/` contains generated
Next.js output. You normally edit neither. The verification scripts check many
calculations and rules without opening a browser; visual appearance and real
device interaction still need the [manual checks](docs/testing.md).

## 8. Where to start when changing something

| You want to… | Start here |
| --- | --- |
| Change the letter's words or photographs | `/editor` locally, or `config/cards.config.ts` for source cards. |
| Understand what fields a card accepts | `types/card.ts`, then `lib/cardRules.ts`. |
| Change buttons, screens, or forms | `components/card/` and `app/globals.css`. |
| Change the order or rules of the experience | `lib/experienceState.ts`, then `CardExperience.tsx`. |
| Change cube movement or camera framing | `MessageCube.tsx`, `rotationPresets.ts`, `CameraRig.tsx`, and `framing.ts`. |
| Change the space background | `SpaceEnvironment.tsx`, its child components, and `shaders/`. |
| Change passwords or who can open a card | `lib/access.ts` and the card page/access route. |
| Change replies or comet delivery | The reply/comet routes, `lib/mail.ts`, and `lib/cometSeal.ts`. |

For a first code-reading session, follow this order:
`types/card.ts` → `config/cards.config.ts` → `lib/cards.ts` →
`app/c/[slug]/page.tsx` → `lib/clientCard.ts` → `CardExperience.tsx` →
`lib/experienceState.ts` → `CubeScene.tsx`.

That follows the same journey as a card: its shape, its content, its lookup,
its access check, its browser data, its interactions, and finally its graphics.
