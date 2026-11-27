# PRD: cemetery-run-demo

Status: approved in the grill on 2026-11-26. Owner: Tomasz. Owner bot: the cemetery-run-demo project bot.
Language: English, ASD-STE100 Simplified Technical English.

## 1. Goal

A hidden demo browser game. The player drives a black estate hearse on the roads of a night cemetery. The player picks up a coffin at the chapel, drives it through a cemetery full of cartoon zombies, and delivers it to a freshly dug grave (D21). The game is low-poly 3D, runs in a phone browser, and needs no install.

The game is a demo. It shows no names: no company, no town, no person, no phone number, no address. No site links to the game. People get the URL directly (link or QR code).

## 2. Decisions (veto allowed)

| # | Topic | Decision |
|---|-------|----------|
| D1 | Game | The player drives a black estate hearse (Mercedes-style shape, no badge, no logo) on cemetery roads at night. ~~The player protects the chapel at the end of the road.~~ Replaced by D21: the player delivers coffins from the chapel to dug graves. |
| D2 | Enemies | Cartoon zombies (always many) wander between the graves and chase the hearse when it is near (D21; they no longer walk to the chapel). The hearse hits them. A hit zombie pops into dry leaves or dust. No gore, no blood. |
| D3 | ~~Lose condition~~ | ~~5 candles burn at the chapel. Each zombie that reaches the chapel puts out one candle.~~ Replaced by D21 (2026-11-27): no chapel candles, no lose condition; grave candles stay as decoration. |
| D4 | Round | A round ends after 60 s (D21: no candle end). The end screen shows deliveries, zombies popped, the score and a "Play again" button. |
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
| D16 | Camera | Above and behind the hearse, tilted (3/4 chase view). The camera follows the hearse position but keeps a fixed world direction (it does not turn with the hearse). Thus a drag up on the screen always drives the hearse away from the camera, and a drag right always drives it to the right. |
| D17 | Pop sound | The cartoon pop is made in code with Web Audio (no file). Reason: Kenney sounds are OGG, and older iPhone Safari does not play OGG. |
| D18 | Assets in the repo | Third-party files come from the release `asset-sources-v1` of this repo (the owner bot downloaded the originals on 2026-11-26). `scripts/fetch-assets.sh` downloads them and checks SHA-256. The fetched files are committed in `public/assets/`. |
| PS1 | Repo | `tomiwu/cemetery-run-demo`. |
| PS2 | Visibility | Public, MIT licence. Demo code is visible; Tomasz accepted this. |
| PS3 | Token | Fine-grained PAT for this repo only (Contents, Issues, Pull requests, Workflows, Administration: read/write). Stored only on the box in `/workspace/cemetery-run-demo-secrets/` and `.sandcastle/.env` (git-ignored). |
| PS4 | Other secrets | Claude Code OAuth token: reused from the other box loops. Loop webhook URL and key: box secrets directory only. |
| PS5 | Stack | Vite, TypeScript strict, Three.js, Vitest, Playwright with phone viewports. Rapier physics only if simple collision code is not sufficient. Pure game logic is separate from the 3D render code (method of the NYE Dance Game). See `docs/adr/0001-stack.md`. |
| PS6 | CI | Six required jobs: `format` (Prettier check), `lint` (ESLint), `typecheck` (tsc), `test` (Vitest with coverage), `build` (Vite), `e2e` (Playwright phone smoke test with screenshots). No "skip if missing" steps. |
| PS7 | Publish | Tomasz allowed the publish to GitHub Pages. A deploy workflow runs on each push to main. Pages source: GitHub Actions. URL: https://tomiwu.github.io/cemetery-run-demo/ |
| M1 | Merge rule | (Tomasz, t5u, 2026-11-26) The loop squash-merges each PR by itself with `--match-head-commit`, but ONLY when every required CI job has conclusion `success`. Otherwise the PR stays open with label `needs-validation`. |
| M2 | Agent | Claude Code, latest Sonnet (`claude-sonnet-5-5`), writes and reviews the code in the Sandcastle loop on the box. No Cursor cloud agents. |
| D19 | Breakable graves | (Tomasz, t16u) Graves break on a hit and do not stop the hearse; a short speed penalty. Trees, walls and the chapel bounce softly. Wider grave spacing. See section 3. |
| D20 | Power-ups | (Tomasz, t16u) Mystery "?" boxes give a random power-up for a few seconds: boost/drift and flamethrower first. HUD icon. See section 3. |
| D21 | Core gameplay | (Tomasz, t20u, 2026-11-27) Delivery game. Pick up the coffin at the chapel (drive slowly into the pickup zone at the chapel door). One target grave at a time is shown freshly dug (open pit, earth mound, shovel) with a floating arrow and a HUD edge arrow. Drive slowly into its zone to deliver (+5). Then a new coffin waits at the chapel and a new grave is dug. Zombies pop when the hearse drives over them at speed (+1). If the hearse is too slow near zombies, they climb into the hearse (cartoon); a counter shows the zombies inside; they slow the hearse; at 3 inside the coffin is lost; speed shakes them off. 60 s round, score = 5 x deliveries + zombies popped. Replaces D3 and the chapel defence of D1. Numbers in section 3. |
| D22 | Collision feel | (Tomasz, t20u) Natural arcade collision from playtest 1 (`docs/playtest/`): slide along walls, soft bounce, speed loss by angle, no sticky contact, small camera shake; tuning numbers in `docs/playtest/README.md`. A recorded playtest run (`.sandcastle/playtest.mjs`) checks it. |
| M3 | Visual judge | (Tomasz, t15u, 2026-11-27) The agent that writes the code does not judge its own look. A separate read-only visual judge agent (`claude-opus-5-5`, effort `high`, set by `JUDGE_MODEL` and `EFFORT_JUDGE`) runs for each UI issue (label `visual` or `ui`, a "Visual match" criterion, or a change in `src/render/`, `src/ui/`, CSS, `index.html` or `public/`). It takes Playwright portrait screenshots (`.sandcastle/visual-shots.mjs`), compares them with `docs/targets/` and `docs/ref/`, and writes `VERDICT: PASS` or `FAIL` and a gap list. On FAIL, a visual fixer (the code agent) fixes the gaps, the checks run, and the judge looks again (up to 3 rounds). Still FAIL: the PR stays open with `needs-validation` and `visual-fail`; the loop does not merge it. At each loop start, a `visual-fail` PR gets one more judge and fix run on its branch; on PASS the labels go away and the normal CI merge rule applies. The judge posts each verdict as an issue comment. |
| M4 | Own podman store | (2026-11-27) The loop uses its own podman store `/workspace/cemetery-run-demo-podman` (wrapper in its `bin/`, written by `scripts/start-loop.sh`). Reason: after the box reboot on 2026-11-27 the shared store lost layer data. Other projects do not use this store. |
| V1 | Versions | Newest stable on 2026-11-26, with two exceptions: TypeScript 6.0.3 (typescript-eslint 8.74.0 supports `<6.1.0`, so not TypeScript 7.0.2), and Playwright 1.65.1 (the same version as the Chromium in the loop image). |

## 3. Game rules (source of truth for `src/config.ts`)

- Round length: 60 s. No chapel candles (D21).
- Delivery loop (D21): the coffin waits at the chapel door. Pickup: the hearse stays in the pickup zone (radius 3 m) under 3 m/s for 0.5 s. Target grave: one at a time, a grave at least 20 m from the chapel, shown freshly dug with an arrow. Delivery: the hearse with the coffin stays in the grave zone (radius 2.5 m) under 3 m/s for 0.8 s. Then a new coffin at the chapel and a new dug grave (never the same grave twice in a row).
- Score: +5 for each delivery, +1 for each zombie popped. End screen: deliveries, zombies popped, total.
- Zombies inside (D21): when the hearse is under 2.5 m/s and a walking zombie is within 2.4 m for 0.6 s, the zombie climbs in. HUD counter "inside: N". Each zombie inside lowers the top speed by 8 %. At 3 inside: the coffin is lost (it goes back to the chapel), -3 score (not below 0), and all zombies jump out. Shake off: 1.5 s at 8 m/s or more, or a wall hit with an impact of 5 m/s or more, throws one zombie out (it pops, +1).
- Waves: wave 1 from 0 s to 10 s is easy (few slow zombies). Then a new wave every 10 s. Each wave increases the spawn rate and the walk speed. Use a capped curve (no wave is impossible).
- Zombies spawn at spawn points between the graves, never on the road in front of the hearse, and never within 6 m of the hearse.
- Zombies (D21): always many (at least 10 alive from the start, up to 30 later). A zombie within 14 m of the hearse walks toward it; others wander between the graves. Straight lines with small side steps around graves. No path-finding library.
- Hit: the hearse hits a zombie when the distance between their circles is less than the sum of their radii and the hearse speed is above a small minimum.
- Obstacles (Tomasz, t16u, 2026-11-27, replaces "a hit stops the hearse"):
  - Graves do NOT stop the hearse. A grave hit at 3 m/s or more breaks the grave into cartoon stone pieces and dust (no gore), the hearse keeps 75 % of its speed and drives on (D22). A broken grave stays as low rubble (no collision) for the rest of the round. Slower than 3 m/s: the hearse pushes against the grave and slides around it.
  - Trees, walls, the gate and the chapel stay solid. The hearse bounces off softly (keeps the tangent speed, a small rebound), it never stops dead and never sticks.
  - The graves stand wider apart (centres at least 5.0 m in a row, 5.5 m between rows), so that the hearse can drive between them. Tuning numbers: `docs/playtest/README.md` (D22).
- Power-ups (Tomasz, t16u, 2026-11-27): mystery boxes ("?" boxes, like in kart racers) appear on the map. Driving through a box gives one random power-up for a few seconds; one power-up at a time. First power-ups: boost (more top speed and a drift with tighter turns) and flamethrower (cartoon flames in front of the hearse pop zombies in a short cone, no gore). The HUD shows an icon of the active power-up and its time left.
- The hearse cannot leave the cemetery walls.
- All numbers above are in `src/config.ts`. Tests use those values.

## 4. Screens

1. Intro (about 6 s, skippable with a tap).
2. "Tap to start" with one control hint ("Drag anywhere to drive").
3. Game: 3D scene, HUD with the timer, the score, the coffin state (at the chapel / in the hearse), an edge arrow to the target, the zombies-inside counter and the active power-up. Mute button always visible.
4. End screen: title, deliveries, zombies popped, total, "Play again".

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
- (2026-11-27) CI gives each e2e test one retry (`retries: 1`, CI only), because software WebGL on a shared runner sometimes misses a short timing window (four runs of a docs-only PR failed on different timing tests). A test that fails twice fails the job. Playwright reports a passed retry as "flaky".

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
