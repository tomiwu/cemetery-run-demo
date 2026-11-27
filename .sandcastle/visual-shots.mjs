// Visual judge screenshots (2026-11-27). Portrait phone view (412x915), like docs/targets.
// Usage: node .sandcastle/visual-shots.mjs [baseUrl] [outDir]
//   baseUrl default http://localhost:4173/cemetery-run-demo/ (npm run build && npm run preview)
//   outDir  default test-results/judge
// Shots: intro at 10/50/90 %, start screen, game start, after driving forward/left/right.
// It also prints the hearse track (x, z, speed) as JSON for a collision check.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4173/cemetery-run-demo/";
const out = process.argv[3] ?? "test-results/judge";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
const state = () => page.evaluate(() => window.__game?.state());
const waitState = (s) =>
  page.waitForFunction((v) => window.__game?.state() === v, s, { timeout: 90_000 });
for (const hold of [0.1, 0.5, 0.9]) {
  await page.goto(`${base}?test=1&hold=${hold}`);
  await waitState("intro");
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/intro-${hold}.png` });
}
await page.mouse.click(40, 80);
await waitState("ready");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/ready.png` });
await page.mouse.click(40, 80);
await waitState("playing");
await page.waitForFunction(() => window.__game?.gameLoaded(), null, { timeout: 90_000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/play-start.png` });
const track = [];
for (const [label, keys, ms] of [
  ["drive-forward", ["w"], 6000],
  ["drive-left", ["a", "w"], 3000],
  ["drive-right", ["d", "w"], 4000],
]) {
  for (const k of keys) await page.keyboard.down(k);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    track.push({ label, t: Date.now() - t0, ...(await page.evaluate(() => window.__game?.hearse())) });
    await page.waitForTimeout(250);
  }
  for (const k of keys) await page.keyboard.up(k);
  await page.screenshot({ path: `${out}/${label}.png` });
}
writeFileSync(`${out}/track.json`, JSON.stringify(track));
console.log(`state ${await state()}; ${track.length} track points; shots in ${out}`);
await browser.close();
