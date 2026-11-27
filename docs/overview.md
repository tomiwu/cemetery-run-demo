# Overview

cemetery-run-demo is a hidden demo browser game. Low-poly 3D with Three.js. It runs on phones.

## Flow

```
intro (6 s, tap skips) -> ready ("Tap to start") -> playing (60 s or 5 candles out) -> ended (score, Play again)
```

## Modules

```
src/
  main.ts          wires logic, render, UI and audio; one requestAnimationFrame loop
  config.ts        all gameplay numbers
  strings.ts       all player text (English)
  logic/           pure TypeScript, unit tested (session, input, motion, map, spawn, waves, collision, score, candles)
  render/          Three.js scene, camera, models, effects, auto-quality
  ui/              DOM overlay: HUD, screens, mute button
  audio/           Web Audio music loop and pop sound
public/
  assets/          models (GLB), fonts (WOFF2), audio (MP3) - see docs/ASSETS.md
  robots.txt       Disallow: /
e2e/               Playwright phone smoke test and gallery
```

## Data flow per frame

1. `input` turns pointer and key events into a joystick vector.
2. `logic.step(state, input, dt)` returns the next state (hearse, zombies, candles, score, time, events).
3. `render` moves the Three.js objects to match the state and plays effects for the events (hit, candle out).
4. `ui` updates the HUD. `audio` plays sounds for the events.

## Delivery

- Sandcastle loop on the box: one issue, one branch, one PR. Squash merge only when all six CI jobs succeed.
- GitHub Pages deploy on each push to main: https://tomiwu.github.io/cemetery-run-demo/
