# Glossary

| Term         | Meaning                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Hearse       | The black estate car that the player drives. Made in code. No badge.                                           |
| Chapel       | The building at the end of the cemetery road. The player protects it.                                          |
| Candle       | One of 5 lights at the chapel. A zombie that reaches the chapel puts out one candle.                           |
| Zombie       | A cartoon enemy that walks from between the graves to the chapel.                                              |
| Pop          | The effect when the hearse hits a zombie: the zombie turns into dry leaves or dust.                            |
| Round        | One game from "Tap to start" to the end screen. Maximum 60 s.                                                  |
| Wave         | A period of 10 s with its own spawn rate and walk speed.                                                       |
| Joystick     | The virtual drag control: the start point of the touch is the centre, the drag gives the direction.            |
| Session      | The pure state machine: intro, ready, playing, ended.                                                          |
| Logic        | Code in `src/logic/`. Pure TypeScript, no Three.js, no DOM.                                                    |
| Render       | Code in `src/render/`. Three.js only. It reads the logic state.                                                |
| Auto-quality | The system that lowers the pixel ratio and the shadows when the frame rate drops.                              |
| Loop         | The Sandcastle loop on the box. It takes issues, writes code with Claude Code, opens PRs and merges green PRs. |
