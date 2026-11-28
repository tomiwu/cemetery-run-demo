import { expect, test, type Page } from "@playwright/test";

const state = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => window.__game?.state());

const score = (page: Page): Promise<number> =>
  page.evaluate(() => window.__game?.score() ?? -1);

/** Skip the intro, wait for the models, then tap to start. */
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

test("driving into a zombie pops it and adds 1 to the score", async ({
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
  // The score is in the HUD, top centre.
  const hud = page.locator(".hud-score");
  await expect(hud).toHaveText("Score 0");
  const box = await hud.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeCloseTo(width / 2, -1);
  expect(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".hud-score") as Element)
          .fontFamily,
    ),
  ).toContain("Nunito Sans");

  // A zombie 4 m ahead, then a drag forward. Software WebGL runs slower than real time, so
  // hold the drag until the score changes (about 1 s of game time).
  await page.evaluate(() => {
    window.__game?.placeZombieAhead();
  });
  const placed = await page.evaluate(
    () => window.__game?.zombies().map((zombie) => zombie.id) ?? [],
  );
  expect(placed.length).toBeGreaterThanOrEqual(1);
  const placedId = Math.max(...placed);
  const size = page.viewportSize();
  const cx = (size?.width ?? 400) / 2;
  const cy = (size?.height ?? 800) * 0.75;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 140, { steps: 6 });
  await expect
    .poll(() => score(page), { timeout: 60_000, intervals: [30] })
    .toBe(1);
  // The effect runs now: the leaves and dust fly for 0.7 s of game time. Wait for the peak.
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-pop.png`,
  });
  await page.mouse.up();

  await expect(hud).toHaveText("Score 1");
  // The popped zombie leaves the list.
  await expect
    .poll(() =>
      page.evaluate(
        (id) => window.__game?.zombies().some((zombie) => zombie.id === id),
        placedId,
      ),
    )
    .toBe(false);
  expect(await score(page)).toBe(1);
  expect(problems).toEqual([]);
});
