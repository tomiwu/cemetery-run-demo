# Context

You work on `{{PROJECT}}`, issue #{{ISSUE}}, branch `{{BRANCH}}`. Do only this issue.

The host writes the full issue (body and comments) to `.sandcastle/context/issue.json` (git-ignored). If the text below is cut, read that file.

<!-- inline-start: .sandcastle/context/issue.json -->

!`mkdir -p .sandcastle/context && printf '*\n' > .sandcastle/context/.gitignore && gh issue view {{ISSUE}} --json number,title,body,comments --jq '{number, title, body, comments: [.comments[].body]}' > .sandcastle/context/issue.json && head -c 15000 .sandcastle/context/issue.json && echo && echo "[Full issue: .sandcastle/context/issue.json ($(wc -c < .sandcastle/context/issue.json) bytes).]"`

<!-- inline-end -->

## Recent commits

!`git log --oneline -10`

# Task

1. Read the issue and its acceptance criteria. Read only the `docs/PRD.md` sections that the issue names. Read `CLAUDE.md`.
2. Read the source files and the tests that the change touches.
3. Use Red-Green-Refactor: a failing test first, then the code.
4. Run all commands in `.sandcastle/checks.json`. Fix all failures.
5. Make one commit. Start the message with `RALPH: #{{ISSUE}}`. Write the task, the key decisions and the files changed.
6. End the commit message with `## Verification`: the exact command, and a fenced block with the last lines of its real output (copy them, do not write them). For a performance issue add a before/after table with the measured numbers.

# Facts that the code does not show

- Hidden demo browser game: a black estate hearse protects a chapel from cartoon zombies in a night cemetery. Low-poly 3D with Three.js. Read `docs/PRD.md` for the rules.
- NO names anywhere: no company, no town, no person, no phone number, no address. Do not link any other site.
- All player text is English and lives only in `src/strings.ts`. All gameplay numbers live only in `src/config.ts`.
- Pure game logic (`src/logic/`) has no Three.js and no DOM import. The render code (`src/render/`) reads the logic state.
- No gore and no blood. A hit zombie pops into dry leaves or dust.
- Third-party files come only from the URLs in the issue. Record each file in `docs/ASSETS.md` (source URL, author, licence).
- Tests do not use the network. Use fakes and invented data. No secrets and no personal data anywhere.
- WebGL in headless Chromium: start Playwright Chromium with `--use-angle=swiftshader` and `--enable-unsafe-swiftshader`.
- The host pushes, opens the PR and squash-merges it only when all required CI jobs succeed. Do not edit `docs/PRD.md`, `.sandcastle/` or `.claude/`. Edit `.github/` only when the issue tells you to. You cannot call `gh api`. If CI or repo settings must change, describe the change with `gh issue comment {{ISSUE}}`.
- If you cannot continue, write the reason with `gh issue comment {{ISSUE}}`.

When you are done, output:

<promise>COMPLETE</promise>
