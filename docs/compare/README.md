# Screenshot vs target comparison, round 1 (2026-11-27)

Live site https://tomiwu.github.io/cemetery-run-demo/ at main `ae87bda` (after #5, before zombies #6).
Portrait 412x915 with `node .sandcastle/visual-shots.mjs <url> <dir>` (software WebGL). Targets: `docs/targets/`, frames: `docs/ref/`.
A separate judge (not the code agent) made this list. The loop visual judge repeats the check after #6.

Side by side (live left, target right):

- `live-intro-0.5--vs--target-1-intro-road.jpg`
- `live-ready--vs--target-2-gate-start.jpg`
- `live-drive-forward--vs--target-3-driving.jpg`
- `live-play-start--vs--target-5-chapel-candles.jpg`
- `live-desktop-collision-stop.jpg`: the hearse stops at a grave (collision works, see below).

## Gaps (biggest first)

1. **Ground and path (game).** The game ground is a flat dark grey slab with wide straight grey road strips. Target 3: grass with a narrow, curved, warm dirt path, lit by the headlights. The intro (target 1) already has grass and a dirt path; the game does not.
2. **Camera (game).** The game camera looks almost straight down and the horizon is a thin band. Target 3 and 5: 3/4 chase view, about 35 to 45 degrees down, sky and tree line in the top quarter.
3. **Hearse (game).** From behind it reads as a black box or van: no visible side windows, no curtains, no chrome line, no rear glass. Target 3: long hearse, flat high roof, side windows with white curtains, chrome trim, rounded hood. The intro hearse is closer; the game must use the same model.
4. **Graves.** Small grey stones on brown pebble rings (they look like worms from above). Target: upright light grey and beige headstones (about 0.9 to 1.2 m high) on stone bases, crosses, plinth graves, in dense rows. Remove the pebble rings or make them flat stone borders.
5. **Candles.** Small orange dots float next to the graves. Target: grave candles in red and white glass lanterns on the graves, each with a warm glow and a light pool on the ground.
6. **Chapel.** Saturated orange box with a glowing yellow door and no tower. Target 5 and 2: red-brick chapel (dark red, not orange), steep dark roof, small bell tower or steeple with a cross, warm arched windows, candles at the door.
7. **Trees.** Few dark cone pines and round bushes. Target: rows of tall, slim, dark green poplars and cypresses along the wall, and a dark tree line behind.
8. **Light and atmosphere.** The game is flat and dark grey. Target: dusk sky (blue-grey to amber), low ground fog between graves, warm light pools (headlights, candles, lanterns), cool blue fill light.
9. **Wall and gate.** The wall is a low flat strip in the game. Target: red-brick wall with pillars and caps; the gate with lamps on the pillars (target 2).
10. **Lamp posts.** In the game foreground they look like black hooks with orange blobs. Target: dark iron lanterns with a warm glass head, or remove them from the near view.
11. **Zombies.** Not in the game yet (#6). Target 3 and 4: low-poly green-skin zombies, about 1.6 m, torn grey and brown clothes, readable silhouettes, arms forward.
12. **HUD.** No timer, score or candle lives in the game view yet (later issues). Target 3: timer top left, score top centre, candle icons top right, joystick ring.

## Collision check (live, desktop, `ae87bda`)

Collision with graves, trees, pumpkins, lamp posts and walls works: driving forward then left, the hearse stopped at x=-4.1, z=-15.9 (speed 0) at a grave. Problem: after the hit the hearse sticks. Forward, left+forward and right+forward moved it only about 0.5 m in 30 s. The collision sets the speed to 0 every step, so the hearse cannot slide along or turn away. There is no hit feedback (no bump, sound or shake).

## Round 2 (2026-11-27, issue #26)

Same shots after the look pass (`round-2-*.jpg`, same names as round 1 without the `live-` prefix):
grass ground with narrow warm dirt paths, 3/4 chase camera (about 40 degrees down, view axis ahead of the
hearse), upright light grey and beige headstones on stone bases, red and white candle lanterns with warm
light pools, dark red brick chapel with a steep roof and bell tower, tall poplars and a dark tree line,
dusk sky, low fog, brick wall with pillars, iron gate with lamps, low iron lamp posts and low-poly zombies.

- `round-2-play-start--vs--target-5-chapel-candles.jpg`
- `round-2-drive-forward--vs--target-3-driving.jpg`
- `round-2-ready--vs--target-2-gate-start.jpg` (intro scene, not changed in this round)
- `round-2-intro-0.5--vs--target-1-intro-road.jpg` (intro scene, not changed in this round)
