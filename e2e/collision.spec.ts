import { expect, test, type Page } from "@playwright/test";

const state = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => window.__game?.state());

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

test("a hearse at 30 degrees to the wall keeps its speed and slides along the wall", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const problems = problemsOf(page);
  await startGame(page);
  // The south wall east of the gate. Heading 60 degrees: 30 degrees from the wall plane.
  const result = await page.evaluate(() => {
    const game = window.__game;
    if (!game) {
      throw new Error("The test hook is missing.");
    }
    const heading = Math.PI / 3;
    const input = { x: Math.sin(heading), y: -Math.cos(heading) };
    game.placeHearse(8, 39.3, heading, 10);
    let steps = 0;
    while (game.lastBump() === null && steps < 120) {
      game.advance(1 / 60, input);
      steps += 1;
    }
    const hit = game.hearse();
    const knock = hit.knock ?? { x: 0, z: 0 };
    const groundSpeed = Math.hypot(
      Math.sin(hit.heading) * hit.speed + knock.x,
      Math.cos(hit.heading) * hit.speed + knock.z,
    );
    const bump = game.lastBump();
    const samples: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      game.advance(1 / 60, input);
      samples.push(game.hearse().speed);
    }
    const end = game.hearse();
    return {
      bumpCount: bump?.count ?? 0,
      impact: bump?.impact ?? 0,
      groundSpeed,
      alongWall: end.x - hit.x,
      endZ: end.z,
      minSpeed: Math.min(...samples),
      bumpsAfter: game.lastBump()?.count ?? 0,
    };
  });
  expect(result.bumpCount).toBe(1);
  expect(result.groundSpeed).toBeGreaterThanOrEqual(7.5);
  expect(result.alongWall).toBeGreaterThan(3);
  // The hearse never stops and never goes into the wall (45 m is the wall face).
  expect(result.minSpeed).toBeGreaterThan(0);
  expect(result.endZ).toBeLessThanOrEqual(45 - 1 + 1e-6);
  // A scrape is one contact: no second bump.
  expect(result.bumpsAfter).toBe(1);
  expect(problems).toEqual([]);
});

test("a hearse at 10 m/s breaks a grave, keeps 75 % of its speed and drives on", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const problems = problemsOf(page);
  await startGame(page);
  const graves = await page.evaluate(() => window.__game?.graves() ?? []);
  expect(graves.length).toBeGreaterThan(50);
  expect(graves.every((grave) => grave.state === "standing")).toBe(true);

  // A grave in the first row of the west field, from the north (heading 0 drives toward +z).
  const target = graves.find((grave) => grave.id === 0);
  if (target === undefined) {
    throw new Error("No grave.");
  }
  const result = await page.evaluate((grave) => {
    const game = window.__game;
    if (!game) {
      throw new Error("The test hook is missing.");
    }
    const input = { x: 0, y: -1 };
    game.placeHearse(grave.x, grave.z - 5, 0, 10);
    let steps = 0;
    while (
      game.graves().find((item) => item.id === grave.id)?.state !== "broken" &&
      steps < 120
    ) {
      game.advance(1 / 60, input);
      steps += 1;
    }
    const atBreak = game.hearse();
    game.advance(0.3, input);
    const after = game.hearse();
    return {
      broken: game.graves().find((item) => item.id === grave.id)?.state,
      speedAtBreak: atBreak.speed,
      movedOn: after.z - atBreak.z,
      bump: game.lastBump(),
    };
  }, target);
  expect(result.broken).toBe("broken");
  expect(result.speedAtBreak).toBeCloseTo(7.5, 1);
  expect(result.movedOn).toBeGreaterThan(1.5);
  expect(result.bump).toBeNull();
  // A second break for the picture: the hearse drives away from the camera (heading PI, toward
  // -z), so that the pieces show beside it. The picture is taken at once, while they fly.
  await page.evaluate((grave) => {
    const game = window.__game;
    if (!game) {
      throw new Error("The test hook is missing.");
    }
    const other = game
      .graves()
      .find((item) => item.state === "standing" && item.id !== grave.id);
    if (other === undefined) {
      throw new Error("No standing grave.");
    }
    game.placeHearse(other.x, other.z + 5, Math.PI, 10);
    let steps = 0;
    const before = game.graves().filter((item) => item.state === "broken");
    while (
      game.graves().filter((item) => item.state === "broken").length ===
        before.length &&
      steps < 120
    ) {
      game.advance(1 / 60, { x: 0, y: 1 });
      steps += 1;
    }
  }, target);
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-grave-break.png`,
  });

  // A touch at 2 m/s does not break a grave.
  const slow = await page.evaluate(() => {
    const game = window.__game;
    if (!game) {
      throw new Error("The test hook is missing.");
    }
    const other = game.graves().find((item) => item.state === "standing");
    if (other === undefined) {
      throw new Error("No standing grave.");
    }
    game.placeHearse(other.x - 0.3, other.z - 5, 0, 2);
    game.advance(2.5, { x: 0, y: -0.2 });
    return game.graves().find((item) => item.id === other.id)?.state;
  });
  expect(slow).toBe("standing");
  expect(problems).toEqual([]);
});
