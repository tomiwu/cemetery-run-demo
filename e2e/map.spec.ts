import { expect, test, type Page } from "@playwright/test";

const state = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => window.__game?.state());

const hearse = (page: Page): Promise<{ x: number; z: number; speed: number }> =>
  page.evaluate(() => {
    const value = window.__game?.hearse();
    if (!value) {
      throw new Error("The test hook is missing.");
    }
    return value;
  });

/** Skip the intro, wait for the cemetery models, then tap to start. */
async function startGame(page: Page): Promise<void> {
  await page.goto("?test=1&hold=0.4");
  await expect.poll(() => state(page), { timeout: 30_000 }).toBe("intro");
  await page.mouse.click(40, 80);
  await expect.poll(() => state(page), { timeout: 30_000 }).toBe("ready");
  await page.mouse.click(40, 80);
  await expect.poll(() => state(page), { timeout: 30_000 }).toBe("playing");
  await expect
    .poll(() => page.evaluate(() => window.__game?.gameLoaded()), {
      timeout: 60_000,
    })
    .toBe(true);
}

test("the cemetery map has at most 120 draw calls and the hearse stays inside the walls", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`page: ${error.message}`);
  });

  await startGame(page);
  // Let the camera settle and draw a few frames with the models.
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-map.png`,
  });
  const calls = await page.evaluate(() => window.__game?.drawCalls());
  expect(calls).toBeGreaterThan(0);
  expect(calls).toBeLessThanOrEqual(120);

  // Drive to the right. The side wall stops the hearse: the hearse centre stays 1.4 m inside.
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await hearse(page)).x, { timeout: 90_000 })
    .toBeGreaterThan(20);
  await page.waitForTimeout(1500);
  await page.keyboard.up("d");
  const stopped = await hearse(page);
  expect(stopped.x).toBeLessThanOrEqual(30 - 1.4 + 0.01);

  expect(problems).toEqual([]);
});
