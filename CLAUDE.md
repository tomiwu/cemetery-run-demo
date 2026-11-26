# Rules for agents in this repo

Read `docs/PRD.md` (only the sections that your issue names) and `docs/overview.md`.

## Language

- English, ASD-STE100 Simplified Technical English, for code, comments, commits, docs and player text.
- Player text lives only in `src/strings.ts`. Gameplay numbers live only in `src/config.ts`.

## Hard rules

- NO names anywhere: no company, no town, no person, no phone number, no address. Do not link to another site.
- No gore, no blood.
- `src/logic/` is pure: no Three.js, no DOM, no `Date.now()`, no `Math.random()`. Inject time and a seeded random function.
- Third-party files come only from the release `asset-sources-v1` through `scripts/fetch-assets.sh`. Add a line to `docs/ASSETS.md` for each new file in `public/assets/`.
- No new dependency unless the issue names it with an exact version.
- Tests do not use the network. No secrets and no personal data.
- Do not edit `docs/PRD.md`, `.sandcastle/` or `.claude/`. Edit `.github/` only when the issue tells you to.

## Before each commit

Run `scripts/precommit.sh` (format check, lint, typecheck, unit tests with coverage, build, e2e). All must pass.
Use `npm run format` to fix formatting. Do not format by hand.

## Commits

- One commit per task. The message starts with `RALPH: #<issue>`.
- End the message with `## Verification`: the command and a fenced block with the pasted tail of its real output.

## Merge

The host loop pushes, opens the PR and squash-merges it only when all six CI jobs (`format`, `lint`, `typecheck`, `test`, `build`, `e2e`) have conclusion `success`.
