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
