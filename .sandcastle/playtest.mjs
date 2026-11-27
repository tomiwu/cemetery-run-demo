// Collision playtest (2026-11-27). Phone viewport 412x915, Playwright video in <out>/video.
// Usage: node .sandcastle/playtest.mjs [outDir] [baseUrl]. Writes <out>/track.json (hearse x, z,
// heading, speed per sample). Note: software WebGL runs the game at about 1/3 real speed.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { writeFileSync } from "node:fs";
const URL = process.argv[3] ?? "http://localhost:4173/cemetery-run-demo/";
const out = process.argv[2] ?? "test-results/playtest";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, recordVideo: { dir: `${out}/video`, size: { width: 412, height: 915 } } });
const page = await ctx.newPage();
await page.goto(`${URL}?test=1&hold=0.4`);
await page.waitForFunction(() => window.__game?.state() === "intro", null, { timeout: 90000 });
await page.mouse.click(40, 80);
await page.waitForFunction(() => window.__game?.state() === "ready", null, { timeout: 90000 });
await page.mouse.click(40, 80);
await page.waitForFunction(() => window.__game?.state() === "playing" && window.__game?.gameLoaded(), null, { timeout: 90000 });
await page.waitForTimeout(1500);
const t0 = Date.now();
const log = [];
let shot = 0;
async function hold(keys, ms, label, shotAt = []) {
  for (const k of keys) await page.keyboard.down(k);
  const s = Date.now();
  const next = [...shotAt];
  while (Date.now() - s < ms) {
    const [h, z] = await page.evaluate(() => [window.__game.hearse(), window.__game.zombies().filter(z => z.state === "walking").map(z => [z.x, z.z])]);
    const near = z.filter(([x, zz]) => Math.hypot(x - h.x, zz - h.z) < 2.5).length;
    log.push({ t: Date.now() - t0, label, keys: keys.join("+"), x: +h.x.toFixed(2), z: +h.z.toFixed(2), hd: +h.heading.toFixed(2), v: +h.speed.toFixed(2), zombiesNear: near, zombies: z.length });
    if (next.length && Date.now() - s >= next[0]) { next.shift(); await page.screenshot({ path: `${out}/frame-${String(++shot).padStart(2,"0")}-${label}.png` }); }
    await page.waitForTimeout(80);
  }
  for (const k of keys) await page.keyboard.up(k);
}
await hold(["w"], 7000, "1-chapel-headon", [4500, 6500]);
await hold(["w"], 1500, "2-push-chapel");
await hold(["d"], 3000, "3-steer-away-east", [1500]);
await hold(["d"], 5000, "4-east-wall-headon", [4000]);
await hold(["d", "s"], 4000, "5-wall-45deg-slide", [2000]);
await hold(["a"], 5000, "6-graves-west", [1500, 3500]);
for (let i = 0; i < 6; i++) { await hold(["a"], 250, "7-slow-pulses"); await hold([], 400, "7-slow-pulses"); }
await hold(["a", "w"], 4000, "8-graves-diagonal", [2000]);
await hold(["s"], 5000, "9-graves-south", [2500]);
for (let i = 0; i < 16; i++) {
  const [h, zs] = await page.evaluate(() => [window.__game.hearse(), window.__game.zombies().filter(z => z.state === "walking")]);
  if (!zs.length) { await hold(["w"], 500, "10-zombie-chase"); continue; }
  zs.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z));
  const dx = zs[0].x - h.x, dz = zs[0].z - h.z;
  const keys = [];
  if (Math.abs(dx) > 1) keys.push(dx > 0 ? "d" : "a");
  if (Math.abs(dz) > 1) keys.push(dz > 0 ? "s" : "w");
  await hold(keys.length ? keys : ["w"], 500, "10-zombie-chase", i === 8 ? [300] : []);
}
writeFileSync(`${out}/track.json`, JSON.stringify(log));
await ctx.close();
await browser.close();
console.log("points", log.length);
