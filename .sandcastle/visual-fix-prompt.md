# Task

You work on `{{PROJECT}}`, issue #{{ISSUE}}, branch `{{BRANCH}}`. A separate visual judge compared the game screenshots with `docs/targets/` and `docs/ref/` and found these gaps (biggest first):

{{GAPS}}

# Rules

- Fix the gaps in the model and render code (`src/render/`, materials, lights, camera). Do not change game logic or tests to hide a gap.
- Look at the target images and `docs/VISUAL_REFERENCE.md` before you change a model. Keep the draw-call and performance limits of the PRD.
- Run all commands in `.sandcastle/checks.json`. Make one commit that starts with `RALPH: #{{ISSUE}} visual fix`, in English (ASD-STE100), with the list of the gaps you fixed and a `## Verification` section with the command and its real output.
- The judge checks your work again. Do not edit `docs/PRD.md`, `.sandcastle/` or `.claude/`.

When you are done, output:

<promise>COMPLETE</promise>
