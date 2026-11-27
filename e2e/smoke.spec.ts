import { expect, test } from "@playwright/test";

test("smoke: page loads, hidden from search, canvas draws", async ({
  page,
}, testInfo) => {
  // The polls below wait up to 30 s each (slow software WebGL in CI).
  test.setTimeout(120_000);
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`page: ${error.message}`);
  });

  await page.goto("?test=1&hold=0.5");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect(box?.height ?? 0).toBeGreaterThan(0);

  // `hold=0.5` holds the intro from the first frame (slow software WebGL in CI).
  await expect
    .poll(() => page.evaluate(() => window.__game !== undefined), {
      timeout: 30_000,
    })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__game?.state()), {
      timeout: 30_000,
    })
    .toBe("intro");

  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-smoke.png`,
    fullPage: true,
  });

  expect(problems).toEqual([]);
});
