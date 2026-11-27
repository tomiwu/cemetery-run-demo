# Glossary

| Term           | Meaning                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Hearse         | The black estate car that the player drives. Made in code. No badge.                                           |
| Chapel         | The building in the north of the cemetery. The coffin pickup is at its door.                                   |
| Candle         | A grave candle in a small lantern. Decoration only (D21 removed the chapel candles).                           |
| Zombie         | A cartoon enemy. Many wander between the graves and walk toward the hearse when it is near.                    |
| Pop            | The effect when the hearse hits a zombie: the zombie turns into dry leaves or dust.                            |
| Coffin         | What the player delivers. It waits at the chapel door, rides in the hearse, and goes into the dug grave.       |
| Pickup         | Loading the coffin: the hearse stays slowly in the pickup zone at the chapel door.                             |
| Dug grave      | The one target grave: an open pit with an earth mound and an arrow above it.                                   |
| Delivery       | Driving slowly into the dug-grave zone with the coffin. +5 score.                                              |
| Climb-in       | A zombie that gets into the hearse when the hearse is too slow near it.                                        |
| Inside counter | The HUD count of zombies in the hearse. 3 inside: the coffin is lost.                                          |
| Grave break    | A grave hit at speed: the stone breaks into cartoon pieces, the hearse slows a little.                         |
| Power-up box   | A "?" box. Driving through it gives a random power-up for a few seconds.                                       |
| Round          | One game from "Tap to start" to the end screen. Maximum 60 s.                                                  |
| Wave           | A period of 10 s with its own spawn rate and walk speed.                                                       |
| Joystick       | The virtual drag control: the start point of the touch is the centre, the drag gives the direction.            |
| Session        | The pure state machine: intro, ready, playing, ended.                                                          |
| Logic          | Code in `src/logic/`. Pure TypeScript, no Three.js, no DOM.                                                    |
| Render         | Code in `src/render/`. Three.js only. It reads the logic state.                                                |
| Auto-quality   | The system that lowers the pixel ratio and the shadows when the frame rate drops.                              |
| Loop           | The Sandcastle loop on the box. It takes issues, writes code with Claude Code, opens PRs and merges green PRs. |
