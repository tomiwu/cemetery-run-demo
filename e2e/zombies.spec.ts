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

  // Drive up the main road until a zombie is near, so that the screenshot shows one.
  await page.keyboard.down("ArrowUp");
  await expect
    .poll(
      async () => {
        const hearse = await page.evaluate(() => window.__game?.hearse());
        return (await zombies(page)).some(
          (zombie) =>
            Math.hypot(
              zombie.x - (hearse?.x ?? 0),
              zombie.z - (hearse?.z ?? 0),
            ) < 13,
        );
      },
      { timeout: 90_000 },
    )
    .toBe(true);
  // Keep driving toward the chapel, where the zombies meet, until at least 4 zombies are in the
  // near and middle view, so the screenshot shows a group.
  await expect
    .poll(
      async () => {
        const hearse = await page.evaluate(() => window.__game?.hearse());
        return (await zombies(page)).filter(
          (zombie) =>
            Math.hypot(
              zombie.x - (hearse?.x ?? 0),
              zombie.z - (hearse?.z ?? 0),
            ) < 18,
        ).length;
      },
      { timeout: 90_000 },
    )
    .toBeGreaterThanOrEqual(4);
  await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-zombies.png`,
  });

  expect(problems).toEqual([]);
});
