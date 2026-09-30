import { test, expect } from "@playwright/test";

test.describe("Smoke test", () => {
  test("homepage loads and displays application title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Cairn/);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Cairn");
  });
});
