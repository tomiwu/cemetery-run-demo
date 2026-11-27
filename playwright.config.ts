import { defineConfig, devices } from "@playwright/test";

const URL = "http://localhost:4173/cemetery-run-demo/";
const isCI = process.env["CI"] !== undefined && process.env["CI"] !== "";

const iphone = { ...devices["iPhone 14"], browserName: "chromium" as const };
// `defaultBrowserType` is not allowed in a project `use` block.
delete (iphone as { defaultBrowserType?: string }).defaultBrowserType;

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  forbidOnly: isCI,
  // One retry in CI only: software WebGL on a shared runner sometimes misses a short timing window.
  // A test that fails twice fails the job.
  retries: isCI ? 1 : 0,
  // Software WebGL on a shared CI runner loads the page slowly (2026-11-27: e2e took 10-12 min
  // instead of 5 min). Longer test and default expect timeouts in CI. Explicit short timeouts
  // (the "less than 1 s" checks) stay as they are.
  timeout: isCI ? 120_000 : 30_000,
  expect: { timeout: isCI ? 15_000 : 5_000 },
  // Software WebGL is CPU bound. Fewer parallel workers stop the short 1 s checks from missing their window.
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command:
      "npm run build && npm run preview -- --port 4173 --strictPort --bypass-lock",
    url: URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
  use: {
    baseURL: URL,
    launchOptions: {
      args: [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  projects: [
    { name: "pixel7", use: { ...devices["Pixel 7"] } },
    { name: "iphone14", use: iphone },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
  ],
});
