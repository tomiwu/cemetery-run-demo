// Unit tests for loop-policy.mts. No network, no git. Run: npx tsx .sandcastle/loop-policy-test.mts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EventDeduper,
  resumeAction,
  ciStateOf,
  judgeNextStep,
  needsVisualJudge,
  parseJudgeVerdict,
  redactSecrets,
  IMAGE_CHECK_RETRIES,
  IMAGE_CREATE_ERROR,
  classifyImageCheck,
  imageRecoveryStep,
  NETWORK_ERROR,
  containerNameOf,
  agentBeforePhase,
  jobGate,
  effortFor,
  isFormatOnlyFailure,
  limitWait,
  nextAgentAfterStall,
  parseResetAt,
  phaseOfName,
  sleepUntil,
  writeStatus,
} from "./loop-policy.mts";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) console.log(`ok   ${name}`);
  else {
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
    fails++;
  }
};
const iso = (ms: number | undefined) =>
  ms === undefined ? "undefined" : new Date(ms).toISOString();

// 2026-11-13 09:32 UTC (10:32 CET).
const now = Date.UTC(2026, 10, 13, 9, 32);
const msg = "You've hit your 5-hour limit · resets 1:30pm (UTC)";
check(
  "reset: 1:30pm (UTC) today",
  iso(parseResetAt(msg, now)) === "2026-11-13T13:30:00.000Z",
  iso(parseResetAt(msg, now)),
);
check(
  "reset: 3:30am (UTC) is tomorrow",
  iso(parseResetAt("resets 3:30am (UTC)", now)) === "2026-11-14T03:30:00.000Z",
  iso(parseResetAt("resets 3:30am (UTC)", now)),
);
check(
  "reset: 18:50 Europe/Warsaw (CET, UTC+1)",
  iso(parseResetAt("resets 18:50 (Europe/Warsaw)", now)) ===
    "2026-11-13T17:50:00.000Z",
  iso(parseResetAt("resets 18:50 (Europe/Warsaw)", now)),
);
check(
  "reset: 7pm without a zone is UTC",
  iso(parseResetAt("limit · resets 7pm", now)) === "2026-11-13T19:00:00.000Z",
);
check(
  "reset: 12am is midnight",
  iso(parseResetAt("resets 12am (UTC)", now)) === "2026-11-14T00:00:00.000Z",
);
check(
  "reset: relative 'resets in 2 hours'",
  parseResetAt("It resets in 2 hours.", now) === now + 7_200_000,
);
check(
  "reset: relative 'resets in 1 day'",
  parseResetAt("It resets in 1 day.", now) === now + 86_400_000,
);
check(
  "reset: no time -> undefined",
  parseResetAt("rate limit, try later", now) === undefined,
);
check(
  "reset: a bare number is not a time",
  parseResetAt("the counter resets 3 times", now) === undefined,
);
check(
  "reset: unknown zone -> undefined",
  parseResetAt("resets 6:30pm (Mars/Olympus)", now) === undefined,
);

const w = limitWait(msg, now, 30);
check(
  "wait: until reset + 2 min",
  iso(w.untilMs) === "2026-11-13T13:32:00.000Z",
  iso(w.untilMs),
);
check(
  "wait: no reset -> fixed pause",
  limitWait("overloaded", now, 30).untilMs === now + 30 * 60_000,
);
check(
  "wait: capped at 6 h",
  limitWait("It resets in 3 days.", now, 30).untilMs === now + 6 * 3_600_000,
);

const chain = [
  "Claude Code (claude-opus-5-5)",
  "Claude Code (claude-sonnet-5-5)",
  "Cursor CLI (composer-2.5)",
  "Cursor CLI (cursor-grok-4.5-high)",
];
check(
  "chain: Claude limit on Opus skips Sonnet",
  nextAgentAfterStall(chain, 0, msg) === 2,
);
check(
  "chain: other Opus error -> Sonnet",
  nextAgentAfterStall(chain, 0, "model not found") === 1,
);
check(
  "chain: Composer stall -> Grok",
  nextAgentAfterStall(chain, 2, "usage limit") === 3,
);
check("chain: last agent -> -1", nextAgentAfterStall(chain, 3, "x") === -1);
check(
  "chain: Claude-only chain + limit -> -1 (pause)",
  nextAgentAfterStall(["Claude Code (claude-fable-5-2)"], 0, msg) === -1,
);
check(
  "back to Claude after the reset",
  agentBeforePhase(chain, 2, now - 1, now) === 0,
);
check(
  "stay on Composer before the reset",
  agentBeforePhase(chain, 2, now + 60_000, now) === 2,
);
check(
  "stay on Claude when no limit is known",
  agentBeforePhase(chain, 1, undefined, now) === 1,
);

const fmtLog =
  "== fmt\nDiff in /home/agent/crates/ui/src/lib.rs at line 4:\n-fn a(){}\n+fn a() {}\n";
const clippyLog =
  "error: this `if` has identical blocks\n  = help: for further information visit https://rust-lang.github.io/rust-clippy/master/index.html#if_same_then_else\n  = note: `-D clippy::if-same-then-else` implied by `-D warnings`";
const testLog =
  "test widgets::clothes ... FAILED\ntest result: FAILED. 1 passed; 1 failed";
check("format-only: rustfmt diff", isFormatOnlyFailure(fmtLog));
check("format-only: clippy lint", isFormatOnlyFailure(clippyLog));
check(
  "format-only: failed test is not format-only",
  !isFormatOnlyFailure(`${fmtLog}${testLog}`),
);
check(
  "format-only: compile error is not format-only",
  !isFormatOnlyFailure(
    "error[E0004]: non-exhaustive patterns: `DrawPart::Chrome` not covered",
  ),
);
check("effort: implementer high", effortFor("implementer", {}) === "high");
check("effort: format fixer low", effortFor("fixer-format", {}) === "low");
check(
  "effort: env override",
  effortFor("reviewer", { EFFORT_REVIEWER: "xhigh" }) === "xhigh",
);
check(
  "effort: bad env value ignored",
  effortFor("fixer", { EFFORT_FIXER: "turbo" }) === "medium",
);
check(
  "phase: fixer with fmt log -> fixer-format",
  phaseOfName("fixer-1", fmtLog) === "fixer-format",
);
check(
  "phase: fixer with test log -> fixer",
  phaseOfName("fixer-2", testLog) === "fixer",
);

const dir = mkdtempSync(join(tmpdir(), "loop-policy-"));
const f = join(dir, "status.json");
writeStatus(f, {
  phase: "implementer",
  model: "claude-opus-5-5",
  agent: "Claude Code (claude-opus-5-5)",
  issue: 236,
  startedAt: "x",
  lastOutputAt: null,
  pid: 1,
});
const s = JSON.parse(readFileSync(f, "utf8"));
check(
  "status: JSON with phase, model, issue, startedAt, lastOutputAt",
  s.phase === "implementer" &&
    s.model === "claude-opus-5-5" &&
    s.issue === 236 &&
    "lastOutputAt" in s &&
    typeof s.updatedAt === "string",
);

const t0 = Date.now();
await sleepUntil(t0 + 120, 20);
check("sleepUntil: wall-clock deadline reached", Date.now() - t0 >= 120);
await sleepUntil(t0 - 1000);
check("sleepUntil: past deadline returns at once", Date.now() - t0 < 1000);


// Merge gate: parse jobs from `gh run view --json jobs` (no jq string escapes).
const REQ = ["format", "lint", "typecheck", "test", "build", "e2e"];
const ghJson = JSON.stringify({
  jobs: REQ.map((name) => ({ name, conclusion: "success", status: "completed" })),
});
const parsed = (JSON.parse(ghJson) as { jobs: { name: string; conclusion: string }[] }).jobs;
check("gate: all six success -> ok", jobGate(parsed, REQ).ok);
check(
  "gate: one failure in a second run wins",
  !jobGate([...parsed, { name: "e2e", conclusion: "failure" }], REQ).ok,
);
check(
  "gate: a missing job blocks",
  jobGate(parsed.filter((j) => j.name !== "build"), REQ).note.includes("build=missing"),
);
check(
  "gate: skipped or pending blocks",
  !jobGate([...parsed.filter((j) => j.name !== "test"), { name: "test", conclusion: "skipped" }], REQ).ok &&
    !jobGate([...parsed.filter((j) => j.name !== "lint"), { name: "lint", conclusion: null }], REQ).ok,
);
const dd = new EventDeduper();
check(
  "events: one ci_failed per state, again after a change",
  dd.shouldSend("ci_failed", "14:abc") &&
    !dd.shouldSend("ci_failed", "14:abc") &&
    dd.shouldSend("ci_failed", "14:def") &&
    dd.shouldSend("loop_idle", "w=2") &&
    !dd.shouldSend("loop_idle", "w=2"),
);

// Robustness: network errors and container names from podman errors.
check(
  "network: EAI_AGAIN API error is a network error",
  NETWORK_ERROR.test("API Error: Can't reach the API server — check your internet or DNS (EAI_AGAIN)"),
);
check("network: a test failure is not a network error", !NETWORK_ERROR.test("expect(received).toBe(expected)"));
check(
  "container: name from a podman rm error",
  containerNameOf(
    "Error: podman rm failed: Command failed: podman rm -f sandcastle-048e75d8-3bbc-4972-b520-0da2f44984a0",
  ) === "sandcastle-048e75d8-3bbc-4972-b520-0da2f44984a0",
);
check("container: no name gives undefined", containerNameOf("podman rm failed") === undefined);

// Image check: a transient inspect error is not a missing image.
check("image: exit 0 is ok", classifyImageCheck(0, "") === "ok");
check(
  "image: 'image not known' is missing",
  classifyImageCheck(125, "Error: localhost/sandcastle:x: image not known") === "missing",
);
check(
  "image: a lock error is transient",
  classifyImageCheck(125, "Error: database is locked") === "transient",
);
check("image: ok -> use", imageRecoveryStep("ok", 0, false) === "use");
check("image: first misses -> wait", imageRecoveryStep("missing", 0, false) === "wait");
check(
  "image: missing after all retries -> rebuild once",
  imageRecoveryStep("missing", IMAGE_CHECK_RETRIES - 1, false) === "rebuild" &&
    imageRecoveryStep("missing", IMAGE_CHECK_RETRIES - 1, true) === "give-up",
);
check(
  "image: transient after all retries -> give up (no rebuild)",
  imageRecoveryStep("transient", IMAGE_CHECK_RETRIES - 1, false) === "give-up",
);
check(
  "image: sandcastle create error text is detected",
  IMAGE_CREATE_ERROR.test(
    "Provider 'podman' create failed: Image 'localhost/sandcastle:cemetery-run-demo' not found locally.",
  ),
);

// Visual judge.
check("judge: label visual -> judge", needsVisualJudge(["Sandcastle", "visual"], "", []));
check("judge: 'Visual match' in body -> judge", needsVisualJudge([], "- [ ] Visual match: ...", []));
check("judge: render file changed -> judge", needsVisualJudge([], "", ["src/render/hearse.ts"]));
check("judge: logic only -> no judge", !needsVisualJudge([], "score rules", ["src/logic/score.ts"]));
check(
  "judge: verdict PASS",
  parseJudgeVerdict("# Judge\nVERDICT: PASS\n").verdict === "pass",
);
{
  const v = parseJudgeVerdict(
    "VERDICT: FAIL\n- gap: hearse has no windows -> add side windows\ngap: no fog -> add fog\n",
  );
  check(
    "judge: verdict FAIL with 2 gaps",
    v.verdict === "fail" && v.gaps.length === 2 && v.gaps[0] === "hearse has no windows -> add side windows",
  );
}
check("judge: no verdict line -> missing", parseJudgeVerdict("I looked.").verdict === "missing");
check(
  "judge: fail in round 1 of 3 -> fix; round 3 -> give up; pass -> pass",
  judgeNextStep({ verdict: "fail", gaps: [] }, 1, 3) === "fix" &&
    judgeNextStep({ verdict: "missing", gaps: [] }, 3, 3) === "give-up" &&
    judgeNextStep({ verdict: "pass", gaps: [] }, 1, 3) === "pass",
);
{
  const tok = "github_pat_" + "A1b2C3d4E5f6G7h8I9j0KLMNOP";
  const r = redactSecrets(`podman run -d -e GH_TOKEN=${tok} -e PROJECT=x -w /home ${tok}`);
  check("redact: env values and tokens are removed", !r.includes(tok) && !r.includes("=x ") && r.includes("-e GH_TOKEN=***"));
}

// CI head race: the old failed head must not count after a push.
check(
  "ci: old PR head after a push -> pending",
  ciStateOf("old", "new", [{ status: "completed", conclusion: "failure" }]) === "pending",
);
check(
  "ci: pushed head with a running run -> pending; done -> success",
  ciStateOf("new", "new", [{ status: "in_progress", conclusion: "" }]) === "pending" &&
    ciStateOf("new", "new", [{ status: "completed", conclusion: "success" }]) === "success",
);
check(
  "ci: no expected head -> plain state; no runs -> none",
  ciStateOf("a", undefined, [{ status: "completed", conclusion: "failure" }]) === "failure" &&
    ciStateOf("a", "a", []) === "none",
);

// Resume: a visual-fail PR is never merged by the CI path.
check(
  "resume: visual-fail -> one visual retry, then wait; other PRs -> ci",
  resumeAction(["needs-validation", "visual-fail"], false) === "visual-retry" &&
    resumeAction(["visual-fail"], true) === "wait" &&
    resumeAction(["needs-validation"], false) === "ci" &&
    resumeAction([], true) === "ci",
);

if (fails) {
  console.log(`\n${fails} loop-policy test(s) failed.`);
  process.exit(1);
}
console.log("\nAll loop-policy tests passed.");
