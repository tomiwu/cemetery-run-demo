# Collision playtest 1 (2026-11-27)

Live site, main `86724b6` (after #6 zombies, before #7 and #27). Phone viewport 412x915, keyboard input, Playwright video. Script: `node .sandcastle/playtest.mjs <outDir> <baseUrl>`.

- Video: `playtest-1-live-86724b6.mp4` (74 s). Software WebGL runs the game at about 1/3 real speed, so the video looks slow.
- Track: `playtest-1-track.json` (hearse x, z, heading, speed, zombies within 2.5 m, every ~130 ms).
- Frames: `playtest-1-frame-*.jpg`.

## What we did and what happened

| Test                                                    | Result                                                                                                                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| East wall head-on at 10 m/s (90 degrees)                | Speed 10 -> 0 in one step at x = 28.6. No bounce, no shake, no sound. Feels like a glue wall.                                                                                                |
| Same wall, steer 45 degrees along it (south-east)       | 0.0 m moved in 4 s, speed 0 on every sample. The hearse cannot slide along the wall.                                                                                                         |
| Steer straight away from the wall (west)                | 0.1 m in 5 s while the hearse slowly turned. It sticks until the nose points away.                                                                                                           |
| Grave field west at speed, slow pulses, diagonal, south | The hearse stops at each grave (speed 0 on 18 of 26 samples in the diagonal run, 1 m moved in 5 s south). Columns are 4 m apart: the gap between two graves (2.8 m) equals the hearse width. |
| Zombie chase (16 x 0.5 s toward the nearest zombie)     | Speed 0 on 88 of 100 samples: stuck between graves. The hearse never came within 2.5 m of a zombie. Zombies have no collision with the hearse yet (#7).                                      |
| Camera at the east wall                                 | Trees and a lamp post between the camera and the hearse hide the hearse (frames 03 to 05).                                                                                                   |

## Root causes in the code

1. `resolveHearse` (`src/logic/collision.ts`) sets `speed: 0` on **every** step with contact, also when the hearse moves away from the obstacle. Arcade games apply the response only when the velocity points into the obstacle (`v . n < 0`) and the speed cut only on the **first** contact, not on every step of a scrape.
2. The response removes the whole speed instead of only the normal part. A slide keeps the tangent part: `v' = v_t - e * v_n` (restitution `e`).
3. One collision circle of radius 1.4 m for a long, narrow hearse: the nose goes into an obstacle on a head-on hit, and the sides are too wide for the gaps between graves.
4. Turn rate at speed 0 is 35 % (1.2 rad/s), and there is no reverse: after a dead stop the player waits.
5. Graves are hard blockers 4 m apart (#27 replaces this).

## How arcade driving games do it (reference)

- Kart racers: a wall hit keeps part of the speed and can push and turn the kart away; the speed cut applies once per contact. Applying it on every step while scraping "stops you almost completely" (UE5 Kart Physics docs, Wall Hit settings).
- Slide and bounce with one formula: split the velocity into the normal part and the tangent part, keep the tangent part, reverse the normal part times the restitution; apply only when `v . n < 0` ("the guard that stops you sticking").
- Top-down games (Micro Machines, top-down GTA): cars bounce off walls with a small rebound and keep sliding along them; small objects (fences, signs) break and only slow the car (Crazy Taxi does the same with small street objects).
- Feedback: a short, small camera shake and a sound scaled by the impact, never a freeze.

## Tuning numbers (for #27)

| Item              | Value                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hearse collider   | 2 circles on the heading axis at +1.3 m and -1.3 m, radius 1.0 m (length about 4.6 m, width 2.0 m). Replaces the one 1.4 m circle.                                             |
| Response guard    | Only when `v . n < 0`. Push out by the overlap plus 0.02 m.                                                                                                                    |
| Solid obstacles   | Walls, gate, chapel: restitution `e = 0.3`. Trees: `e = 0.35`. Tangent speed kept: 92 %.                                                                                       |
| Speed after a hit | From the formula: 30 degrees from the wall keeps about 80 %, 45 degrees about 65 %, head-on rebounds at 30 % (at least 1.5 m/s back). Never 0 for longer than one step.        |
| Rebound handling  | The rebound is a knock-back velocity that decays at 12 m/s^2; steering and throttle stay active.                                                                               |
| Turn on the spot  | `slowTurnShare` 0.35 -> 0.6 (2.1 rad/s at speed 0).                                                                                                                            |
| Unstick           | In contact for more than 0.25 s at a speed under 1 m/s: an extra push out of 0.3 m along the normal.                                                                           |
| Graves            | Break at 3 m/s or more: speed x 0.75, then drive on (no response). Under 3 m/s: soft obstacle, `e = 0`, slide around it.                                                       |
| Grave spacing     | Centres at least 5.0 m apart in a row and 5.5 m between rows (gap between graves at least 3.8 m = hearse width 2.0 m + 1.8 m).                                                 |
| Zombies           | Pop at 3 m/s or more: speed x 0.95. Under 3 m/s: pushed aside (and they can climb in, see the climb-in issue).                                                                 |
| Camera shake      | Wall or tree: amplitude 0.04 m x impact (normal speed / 10), at most 0.25 m, 0.15 s. Grave break 0.08 m, 0.1 s. Zombie pop 0.04 m, 0.08 s. None with `prefers-reduced-motion`. |
| Camera occlusion  | Trees and lamp posts between the camera and the hearse fade to 30 % opacity.                                                                                                   |
