# Visual reference

Every step of the game must look more and more like this reference. The source is the concept video of the earlier funeral demo website (look only). Do not link that site. Do not copy any name, logo or text from it.

The frames in `docs/ref/` come from that video. The target images in `docs/targets/` are concept images of game moments in the same style. The loop tries to reproduce them.

## Reference frames (`docs/ref/`)

| File                          | Shows                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ref-01-road-dusk-hearse.jpg` | Hearse on a winding dirt road at dusk, river, cemetery with candle lights far away. Main mood frame. |
| `ref-02-hearse-front.jpg`     | Hearse 3/4 front view with headlights on (the badge is blurred: the game has no badge).              |
| `ref-04-hearse-side.jpg`      | Hearse side and rear: long roof, curtains, chrome line, tail lights.                                 |
| `ref-03-cemetery-candles.jpg` | Small walled cemetery with many candle lights, iron gate, chapel, trees.                             |
| `ref-07-cemetery-far.jpg`     | Cemetery and chapel from far away, river, dusk sky.                                                  |
| `ref-06-dawn-sky.jpg`         | Dawn sky with golden rays (end screen mood).                                                         |

## Target images (`docs/targets/`)

| File                          | Game moment                                                  | Issue      |
| ----------------------------- | ------------------------------------------------------------ | ---------- |
| `target-1-intro-road.jpg`     | Intro: hearse on the country road at dusk, cemetery far away | #3, #18    |
| `target-2-gate-start.jpg`     | Cemetery gate and "Tap to start"                             | #3, #18    |
| `target-3-driving.jpg`        | 3/4 chase view, driving between graves, HUD, joystick ring   | #4, #5, #6 |
| `target-4-pop.jpg`            | Zombie pops into leaves and dust (no gore)                   | #7         |
| `target-5-chapel-candles.jpg` | Chapel with 5 candles, zombies approach                      | #8, #9     |
| `target-6-end-screen.jpg`     | End screen with score at dawn                                | #8         |

The targets are painted concept images. The game is low-poly 3D. Match the composition, the colours, the light and the shapes. Do not copy the painted detail. Some target hearses show a grille or a rear badge area: the game hearse has NO badge and NO logo.

## Hearse

- Body style: long black estate hearse on a modern executive saloon base (Mercedes-style E-class shape). Total length about 5.4 m, width 1.9 m, height 1.6 m.
- Proportions: long low bonnet (about 1/4 of the length), raked windscreen, then a long FLAT roof that stays high to the rear. Rear part is a tall box with a near-vertical tailgate. Roof line drops a little at the front doors only.
- Colour: deep glossy black (`#0E0E0F` base, highlights `#5A5354`). Strong, soft reflections of the sky on the roof and the bonnet.
- Chrome: one thin chrome line around the side windows (with a curved "S" swoosh in the rear panel), thin chrome strip at the sill and on the bumpers, chrome grille bars (no emblem).
- Windows: front doors and rear doors with normal dark tinted glass (`#1C1E22`). Long rear side window (the coffin area) with white-cream pleated curtains (`#E8E0CF`), gathered at the sides.
- Lights: wide headlights, warm yellow-white (`#FFD58A`) with a light cone on the road. Tail lights dark red (`#7A1D1A`), large, horizontal.
- Wheels: 5-spoke silver-grey alloys (`#8C8A86`), black tyres.
- No badge, no logo, no text, no number on the plate (blank light plate).
- Low-poly version: keep the silhouette exact; use bevelled boxes; flat-ish shading with one glossy material for the body.

## Cemetery

- Place: a small rural cemetery on a low hill, with a low red-brick wall (`#7A4A35`) and a black wrought-iron double gate between brick pillars with small lanterns.
- Chapel: small red-brick chapel (`#8A4B36` brick, `#5E3427` roof) with a steep gable, arched door with warm light, small bell turret or cross. Not a big church.
- Graves: rows of small grey stone headstones (`#6C6263`, rounded and cross tops), wooden and stone crosses, low grave borders. Many small candles (grave lanterns) on the graves: tiny warm points of light (`#F2B45A`) everywhere. This is the key vibe.
- Trees: tall dark poplars (columnar), round deciduous trees, a few birches. Dark olive-green (`#3F4A2A` to `#2B3020`).
- Ground: dark green-brown grass (`#2D2A23`), pale dirt paths (`#6B5A45` lit, `#302C23` in shadow).
- Surroundings (intro): winding dirt country road, fields, a river with sky reflections (`#726366`), low hills.

## Light, sky and mood

- Time of day: late dusk going to night (blue hour). End screen: dawn.
- Sky: blue-grey at the top (`#3C3F4E`), mauve in the middle (`#726366`), warm amber glow at the horizon (`#D28F54` to `#E0A24A`). Soft clouds.
- Light: cool dim ambient from the sky plus many small warm point lights (candles, lanterns, headlights). Warm light pools on the ground. Light ground fog / haze in the distance.
- Mood: calm, warm, a little melancholic, respectful. Painterly and soft, NOT horror, NOT neon, NOT saturated green. Zombies are goofy cartoon figures (green-grey) that do not break this mood.
- UI: Candle Graphite palette (`#161513` background, `#EDE6D6` text, `#E0A24A` accent). Fraunces for titles, Nunito Sans for HUD.

## Palette (sampled from the frames)

| Role               | Hex                                   |
| ------------------ | ------------------------------------- |
| Sky top            | `#3C3F4E`                             |
| Sky middle / water | `#726366`                             |
| Horizon glow       | `#D28F54`, `#E0A24A`, `#EBAA57`       |
| Grass dark         | `#2D2A23`                             |
| Path               | `#302C23` (shadow), `#6B5A45` (lit)   |
| Brick              | `#7A4A35`, `#8A4B36`                  |
| Headstone          | `#6C6263`                             |
| Candle light       | `#F2B45A`, `#AC7D4F` (glow on ground) |
| Hearse body        | `#0E0E0F`, highlight `#5A5354`        |
| Curtains           | `#E8E0CF`                             |

## How to use this file

- Each issue with a "Visual match" criterion: make the screenshot of the e2e test, put it next to the named reference and target images, and fix the biggest differences in shape, colour and light first.
- The reviewer compares the e2e screenshots with these frames and asks for changes when the look drifts.
