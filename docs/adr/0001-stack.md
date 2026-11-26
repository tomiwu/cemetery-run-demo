# ADR 0001: Stack

Date: 2026-11-26. Status: accepted (grill, Tomasz).

## Context

The game must be 3D, load fast, and run smoothly in a phone browser. The Sandcastle loop writes the code. Tomasz also allowed Rust plus WebAssembly.

## Options

1. Vite + TypeScript + Three.js.
2. Rust + WebAssembly (for example Bevy or three-d).
3. A game engine export (Godot web, Unity WebGL).

## Decision

Option 1: Vite 8.4.0, TypeScript 6.0.3 (strict), Three.js 0.187.0, Vitest 5.1.2, Playwright 1.65.1, ESLint 10.15.0 with typescript-eslint 8.74.0, Prettier 3.10.1. Node 26 LTS.

## Reasons

- Three.js gives a small download (about 150 KB gzip) and good phone performance.
- Rust/WASM and engine exports give a larger download, slower builds and fewer examples for the loop agent.
- The NYE Dance Game used the same method (pure logic split, pointer events, Vitest, Playwright gallery, static Pages deploy). It worked.
- Rapier physics is not used. Circle and box collision in `src/logic/collision.ts` is sufficient. Add Rapier only if a later issue shows that simple collision is not sufficient.

## Version notes

- TypeScript 7.0.2 is the newest, but typescript-eslint 8.74.0 supports TypeScript `>=4.8.4 <6.1.0`. We use 6.0.3.
- Playwright 1.65.1 is the newest and is the same version as the Chromium in the loop image.
