import { expect, test } from "@playwright/test";

test("smoke: page loads, hidden from search, canvas draws", async ({
  page,
}, testInfo) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`page: ${error.message}`);
  });

  await page.goto("?test=1");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect(box?.height ?? 0).toBeGreaterThan(0);

  await expect
    .poll(() => page.evaluate(() => window.__game?.state()))
    .toBe("intro");

  await page.screenshot({
    path: `test-results/screens/${testInfo.project.name}-smoke.png`,
    fullPage: true,
  });

  expect(problems).toEqual([]);
});
