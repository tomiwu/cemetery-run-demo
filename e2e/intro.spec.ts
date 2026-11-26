import { expect, test, type Page } from "@playwright/test";

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

const state = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => window.__game?.state());

// Software WebGL is slow. Hold the intro at a fixed point, so a slow shot or tap cannot race it.
async function freezeIntroAt(page: Page, value: number): Promise<void> {
  await expect
    .poll(() => progress(page), { timeout: 30_000 })
    .toBeGreaterThan(0);
  await page.evaluate((v) => window.__game?.freezeIntro(v), value);
  await expect.poll(() => progress(page), { timeout: 30_000 }).toBe(value);
}

const progress = (page: Page): Promise<number> =>
  page.evaluate(() => window.__game?.introProgress() ?? 0);

test("the intro and the start screen show, then a tap starts the game", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const problems = problemsOf(page);
  await page.goto("?test=1");

  await expect(page.getByText("Tap to skip")).toBeVisible();
  await freezeIntroAt(page, 0.55);
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-intro.png`,
  });
  await page.evaluate(() => window.__game?.freezeIntro(null));

  // The intro ends by itself after about 6 s.
  await expect.poll(() => state(page), { timeout: 30_000 }).toBe("ready");
  await expect(
    page.getByRole("heading", { name: "Cemetery Run" }),
  ).toBeVisible();
  await expect(page.getByText("Tap to start")).toBeVisible();
  await expect(page.getByText("Drag anywhere to drive")).toBeVisible();
  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-ready.png`,
  });

  await page.mouse.click(40, 80);
  await expect.poll(() => state(page), { timeout: 1000 }).toBe("playing");
  await expect(page.getByText("Tap to start")).toBeHidden();
  await expect(page.getByText("Tap to skip")).toBeHidden();

  expect(problems).toEqual([]);
});

test("a tap during the intro gives the state ready in less than 1 s", async ({
  page,
}) => {
  const problems = problemsOf(page);
  await page.goto("?test=1");

  await freezeIntroAt(page, 0.4);
  expect(await state(page)).toBe("intro");
  await page.mouse.click(40, 80);
  await expect.poll(() => state(page), { timeout: 1000 }).toBe("ready");
  await expect(page.getByText("Tap to start")).toBeVisible();

  expect(problems).toEqual([]);
});
