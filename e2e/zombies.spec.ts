import { expect, test, type Page } from "@playwright/test";

const state = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => window.__game?.state());

const zombies = (
  page: Page,
): Promise<{ id: number; x: number; z: number; state: string }[]> =>
  page.evaluate(() => window.__game?.zombies() ?? []);

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

test("zombies appear between the graves and walk to the chapel", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
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
  // Software WebGL counts less game time per second, so wait for the zombie, not for the clock.
  await expect
    .poll(async () => (await zombies(page)).length, { timeout: 90_000 })
    .toBeGreaterThanOrEqual(1);
  const first = (await zombies(page))[0];
  expect(first?.state).toBe("walking");
  // Let a few more zombies walk, then check that they move toward the chapel (north, -z).
  await expect
    .poll(async () => (await zombies(page)).length, { timeout: 90_000 })
    .toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(1500);
  const later = (await zombies(page)).find((zombie) => zombie.id === first?.id);
  expect(later).toBeDefined();
  expect(later?.z ?? 0).toBeLessThan((first?.z ?? 0) - 0.2);

  // Wait for a group of 4 zombies (the least that the shot needs; software WebGL on a slow
  // runner spawns slowly), then steer the hearse next to them, until at least 4 zombies
  // are inside the camera frame. The hearse stays about 8 m south of the group.
  await expect
    .poll(async () => (await zombies(page)).length, { timeout: 90_000 })
    .toBeGreaterThanOrEqual(4);
  let held = "";
  const hold = async (key: string): Promise<void> => {
    if (key !== held) {
      if (held !== "") {
        await page.keyboard.up(held);
      }
      if (key !== "") {
        await page.keyboard.down(key);
      }
      held = key;
    }
  };
  await expect
    .poll(
      async () => {
        const inView = await page.evaluate(
          () => window.__game?.zombiesInView() ?? 0,
        );
        if (inView >= 4) {
          await hold("");
          return inView;
        }
        const hearse = await page.evaluate(() => window.__game?.hearse());
        const group = await zombies(page);
        const meanZ =
          group.reduce((sum, zombie) => sum + zombie.z, 0) /
          Math.max(group.length, 1);
        const gap = (hearse?.z ?? 0) - meanZ;
        await hold(gap > 10 ? "ArrowUp" : gap < 6 ? "ArrowDown" : "");
        return inView;
      },
      { timeout: 150_000, intervals: [200] },
    )
    .toBeGreaterThanOrEqual(4);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-zombies.png`,
  });

  expect(problems).toEqual([]);
});
