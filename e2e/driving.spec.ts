import { expect, test, type Page } from "@playwright/test";

interface Hearse {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

const hearse = (page: Page): Promise<Hearse> =>
  page.evaluate(() => {
    const value = window.__game?.hearse();
    if (!value) {
      throw new Error("The test hook is missing.");
    }
    return value;
  });

const state = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => window.__game?.state());

/** Skip the intro with a tap, then tap to start. Software WebGL is slow, so wait for each state. */
async function startGame(page: Page): Promise<void> {
  await page.goto("?test=1&hold=0.4");
  await expect.poll(() => state(page), { timeout: 30_000 }).toBe("intro");
  await page.mouse.click(40, 80);
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("ready");
  await page.mouse.click(40, 80);
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("playing");
}

function problemsOf(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`page: ${error.message}`);
  });
  return problems;
}

const distance = (a: Hearse, b: Hearse): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

test("a 2 s drag up drives the hearse away from the camera, a release stops it", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const problems = problemsOf(page);
  await startGame(page);
  const size = page.viewportSize();
  const cx = (size?.width ?? 400) / 2;
  const cy = (size?.height ?? 800) * 0.75;
  const before = await hearse(page);
  expect(before.speed).toBe(0);

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 120, { steps: 6 });
  await page.waitForTimeout(2000);
  // Slow software rendering counts less game time per second. Keep the drag until the hearse is far enough.
  await expect
    .poll(async () => distance(before, await hearse(page)), {
      timeout: 60_000,
    })
    .toBeGreaterThan(3);
  const moved = await hearse(page);
  expect(moved.z).toBeLessThan(before.z - 3);
  expect(Math.abs(moved.x - before.x)).toBeLessThan(0.5);
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-driving.png`,
  });

  await page.mouse.up();
  await expect
    .poll(async () => (await hearse(page)).speed, { timeout: 30_000 })
    .toBe(0);
  const stopped = await hearse(page);
  await page.waitForTimeout(300);
  expect(distance(stopped, await hearse(page))).toBe(0);

  expect(problems).toEqual([]);
});

test("a drag right drives the hearse to the right", async ({ page }) => {
  test.setTimeout(120_000);
  const problems = problemsOf(page);
  await startGame(page);
  const size = page.viewportSize();
  const cx = (size?.width ?? 400) / 3;
  const cy = (size?.height ?? 800) / 2;
  const before = await hearse(page);

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 6 });
  await expect
    .poll(async () => (await hearse(page)).x - before.x, { timeout: 60_000 })
    .toBeGreaterThan(3);
  await page.mouse.up();
  const after = await hearse(page);
  expect(Math.abs(after.z - before.z)).toBeLessThan(2);

  expect(problems).toEqual([]);
});

test("arrow keys and WASD drive the hearse", async ({ page }) => {
  test.setTimeout(120_000);
  const problems = problemsOf(page);
  await startGame(page);
  const before = await hearse(page);

  await page.keyboard.down("ArrowUp");
  await expect
    .poll(async () => before.z - (await hearse(page)).z, { timeout: 60_000 })
    .toBeGreaterThan(2);
  await page.keyboard.up("ArrowUp");

  const middle = await hearse(page);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await hearse(page)).x - middle.x, { timeout: 60_000 })
    .toBeGreaterThan(2);
  await page.keyboard.up("d");

  expect(problems).toEqual([]);
});
