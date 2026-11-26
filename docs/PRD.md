# PRD: cemetery-run-demo

Status: approved in the grill on 2026-11-26. Owner: Tomasz. Owner bot: the cemetery-run-demo project bot.
Language: English, ASD-STE100 Simplified Technical English.

## 1. Goal

A hidden demo browser game. The player drives a black estate hearse on the roads of a night cemetery. The player protects the chapel at the end of the road from cartoon zombies. The game is low-poly 3D, runs in a phone browser, and needs no install.

The game is a demo. It shows no names: no company, no town, no person, no phone number, no address. No site links to the game. People get the URL directly (link or QR code).

## 2. Decisions (veto allowed)

| # | Topic | Decision |
|---|-------|----------|
| D1 | Game | The player drives a black estate hearse (Mercedes-style shape, no badge, no logo) on cemetery roads at night. The player protects the chapel at the end of the road. |
| D2 | Enemies | Cartoon zombies walk from between the graves toward the chapel. The hearse hits them. A hit zombie pops into dry leaves or dust. No gore, no blood. |
| D3 | Lose condition | 5 candles burn at the chapel. Each zombie that reaches the chapel puts out one candle. |
| D4 | Round | A round ends after 60 s or when all 5 candles are out. The end screen shows the score and a "Play again" button. |
| D5 | Discount code | NO discount code. No server. |
| D6 | Controls (phone) | Free driving, no lanes. Virtual drag joystick: the player puts a thumb anywhere on the screen and drags in a direction. The hearse turns to that direction and drives. Release: the hearse slows down and stops. |
| D7 | Controls (desktop) | Arrow keys or WASD. |
| D8 | Difficulty | Zombies come in waves. Each wave is faster and has more zombies. The first 10 s are easy. |
| D9 | Intro | About 6 s: the hearse drives along a country road at dusk and in through the cemetery gate. Then "Tap to start" with one control hint. A tap skips the intro. The intro is the first code issue after CI. |
| D10 | Look | Mood of the funeral demo site (look only). Dark palette "Candle Graphite" (see section 6). Fonts Fraunces (titles) and Nunito Sans (text). The game does not link to that site and that site does not link to the game. |
| D11 | Text | English. All player text in one file: `src/strings.ts`. |
| D12 | Sound | Halloween-style spooky-funny music loop (CC0) and a cartoon "pop" sound (CC0). Audio starts after the first tap. A mute button is always visible. |
| D13 | Assets | CC0 low-poly packs (Kenney Graveyard Kit, Kenney Impact Sounds) plus shapes made in code. The hearse is made in code. Each third-party file is listed in `docs/ASSETS.md`. |
| D14 | Phone target | 60 fps on a mid-range 2021 phone. Portrait first; landscape works. The game lowers the pixel ratio and the shadow quality when the frame rate drops. |
| D15 | Hidden | `<meta name="robots" content="noindex, nofollow">` and `robots.txt` with `Disallow: /`. |
| D16 | Camera | Above and behind the hearse, tilted (3/4 chase view). |
| PS1 | Repo | `tomiwu/cemetery-run-demo`. |
| PS2 | Visibility | Public, MIT licence. Demo code is visible; Tomasz accepted this. |
| PS3 | Token | Fine-grained PAT for this repo only (Contents, Issues, Pull requests, Workflows, Administration: read/write). Stored only on the box in `/workspace/cemetery-run-demo-secrets/` and `.sandcastle/.env` (git-ignored). |
| PS4 | Other secrets | Claude Code OAuth token: reused from the other box loops. Loop webhook URL and key: box secrets directory only. |
| PS5 | Stack | Vite, TypeScript strict, Three.js, Vitest, Playwright with phone viewports. Rapier physics only if simple collision code is not sufficient. Pure game logic is separate from the 3D render code (method of the NYE Dance Game). See `docs/adr/0001-stack.md`. |
| PS6 | CI | Six required jobs: `format` (Prettier check), `lint` (ESLint), `typecheck` (tsc), `test` (Vitest with coverage), `build` (Vite), `e2e` (Playwright phone smoke test with screenshots). No "skip if missing" steps. |
| PS7 | Publish | Tomasz allowed the publish to GitHub Pages. A deploy workflow runs on each push to main. Pages source: GitHub Actions. URL: https://tomiwu.github.io/cemetery-run-demo/ |
| M1 | Merge rule | (Tomasz, t5u, 2026-11-26) The loop squash-merges each PR by itself with `--match-head-commit`, but ONLY when every required CI job has conclusion `success`. Otherwise the PR stays open with label `needs-validation`. |
| M2 | Agent | Claude Code, latest Sonnet (`claude-sonnet-5-5`), writes and reviews the code in the Sandcastle loop on the box. No Cursor cloud agents. |
| V1 | Versions | Newest stable on 2026-11-26, with two exceptions: TypeScript 6.0.3 (typescript-eslint 8.74.0 supports `<6.1.0`, so not TypeScript 7.0.2), and Playwright 1.65.1 (the same version as the Chromium in the loop image). |

## 3. Game rules (source of truth for `src/config.ts`)

- Round length: 60 s. Candles: 5.
- Score: +1 for each zombie hit. Bonus: +1 for each candle that still burns at the end of a full 60 s round (shown on the end screen).
- Waves: wave 1 from 0 s to 10 s is easy (few slow zombies). Then a new wave every 10 s. Each wave increases the spawn rate and the walk speed. Use a capped curve (no wave is impossible).
- Zombies spawn at spawn points between the graves, never on the road in front of the hearse, and never within 6 m of the hearse.
- Zombies walk toward the chapel along a simple path (straight line with small side steps around graves). No path-finding library.
- Hit: the hearse hits a zombie when the distance between their circles is less than the sum of their radii and the hearse speed is above a small minimum.
- Obstacles: gravestones, trees and walls block the hearse (simple circle and box collision). A hit on an obstacle stops the hearse; it does not damage it.
- The hearse cannot leave the cemetery walls.
- All numbers above are in `src/config.ts`. Tests use those values.

## 4. Screens

1. Intro (about 6 s, skippable with a tap).
2. "Tap to start" with one control hint ("Drag anywhere to drive").
3. Game: 3D scene, HUD with the timer, the score and the 5 candles. Mute button always visible.
4. End screen: title, score, the reason (time up or candles out), "Play again".

## 5. Architecture

- `src/logic/` pure TypeScript: session (state machine intro → ready → playing → ended), input (joystick vector from pointer events, keys), hearse motion, spawn and waves, zombies, collisions, scoring, candles. No Three.js, no DOM, no `Math.random` without an injected seeded random function.
- `src/render/` Three.js: scene, camera, lights, models, effects. It reads the logic state each frame.
- `src/ui/` DOM overlay: HUD, screens, mute button. Text from `src/strings.ts`.
- `src/audio/` Web Audio: music loop and pop sound. Starts after the first user gesture.
- `src/config.ts` all tunable numbers. `src/strings.ts` all player text.
- Assets in `public/assets/` (models, fonts, audio). They come only from the release `asset-sources-v1` of this repo (see `docs/ASSETS.md`).

## 6. Look

Candle Graphite palette (dark):

| Role | Hex |
|------|-----|
| background | #161513 |
| surface | #242220 |
| text | #EDE6D6 |
| muted text | #B5A993 |
| accent (candle light) | #E0A24A |
| border | #3A3734 |

Scene: night, cold blue-grey moonlight plus warm candle and lantern light in the accent colour. Light fog. Low-poly, flat shading. Cartoon zombies (green-grey), not frightening. Fonts: Fraunces for titles, Nunito Sans for HUD and text (OFL 1.1, Latin subsets in WOFF2).

## 7. Test decisions

- Vitest unit tests for all of `src/logic/` (session, input, motion, spawn, waves, collisions, scoring, candles). Coverage gate: 90 % lines and 85 % branches for `src/logic/`. A seeded random function makes the tests repeatable.
- Render code is not unit tested. The Playwright e2e test checks it.
- Playwright `e2e` (CI): phone viewports Pixel 7 and iPhone 14 (Chromium engine with the iPhone viewport), plus one desktop viewport. The smoke test opens the page, checks the noindex meta, skips the intro with a tap, starts the game, drags to drive for 2 s, checks that the HUD timer counts down, and saves a screenshot of each screen. No console errors are allowed.
- Test hooks: the page exposes `window.__game` only when the URL has `?test=1` (state read and a fast clock for the end screen test).
- WebGL in headless Chromium: flags `--use-angle=swiftshader` and `--enable-unsafe-swiftshader`.
- Screenshots are CI artifacts (`e2e-screenshots`). The phone gallery issue adds a gallery page in `docs/gallery/`.
- No test uses the network.

## 8. Hard limits (A0.3)

- Box disk: about 10 GB free on 2026-11-26. No new container image for this project. The loop uses tag `localhost/sandcastle:cemetery-run-demo` (same image ID as the existing static-site loop image). Do not remove or prune images of other projects.
- One loop only for this project (flock + pid file).
- GitHub fine-grained PAT: no Checks permission; the loop reads GitHub Actions runs and jobs instead of check rollups. Public repo: Actions minutes are free.
- GitHub Pages: public repo, static files only, 1 GB site limit, soft limit 100 GB bandwidth per month. Keep the build under 15 MB.
- Claude Code: shared plan limit with the other box loops. The loop pauses until the reset time when it hits the limit.
- Sandcastle agent idle timeout: 1800 s. The loop has no web search; issue text gives exact versions and URLs.
- Box clock: Europe/Warsaw. GitHub cron is UTC.

## 9. Access (A0.4)

- Repo work happens on the box: `/workspace/cemetery-run-demo`. Tomasz's Mac is not needed.
- The loop runs on the box under Podman (`--userns=keep-id`) with `scripts/start-loop.sh`.
- Tomasz tests the published URL on his phone. No device is connected to the box.

## 10. Legal (A0.5)

- Kenney Graveyard Kit 5.0 and Kenney Impact Sounds: CC0 1.0 (licence file in each zip).
- Music "Haunting Chiptune Loop [Void Estate]" by Zane Little Music, OpenGameArt: CC0.
- Fonts Fraunces and Nunito Sans: SIL Open Font License 1.1. The OFL files ship next to the fonts.
- Three.js: MIT. Our code: MIT.
- No personal data. No cookies. No analytics. No network calls at run time except loading the static files.
- No names of real people, companies or places in the game, the repo or the commits.

## 11. Open items

- None from the grill. Tomasz can veto any decision above.
