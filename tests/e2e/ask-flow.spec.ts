import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Ask Flow and Blueprint Review", () => {
  test("allows typing a prompt, inspecting blueprint, editing field, and starting run", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Verify main headline is visible
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Ask in plain English");

    // Verify composer textarea is present
    const textarea = page.getByRole("textbox", { name: /REQUEST/i });
    await expect(textarea).toBeVisible();

    // Use an example chip to fill prompt
    const exampleChip = page.getByRole("button", {
      name: /junior developer jobs in lucknow/i,
    });
    if (await exampleChip.isVisible()) {
      await exampleChip.click();
    } else {
      await textarea.fill("Job openings for junior developers in Lucknow");
    }

    // Submit request to generate blueprint
    const submitBtn = page.getByRole("button", { name: /Generate blueprint/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Blueprint drawer/panel should appear with dialog role
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify entity or fields are rendered
    await expect(dialog.getByText(/Job ?Opening/i).first()).toBeVisible();

    // Edit a field: find edit button for Salary
    const editSalaryBtn = dialog.getByRole("button", { name: /Edit Salary/i });
    if (await editSalaryBtn.isVisible()) {
      await editSalaryBtn.click();
      const labelInput = dialog.getByLabel(/Field Label/i);
      await labelInput.fill("Annual Salary");
      const saveBtn = dialog.getByRole("button", { name: /Save field/i });
      await saveBtn.click();
      await expect(dialog.getByText("Annual Salary")).toBeVisible();
    }

    // Start collection run
    const startBtn = dialog.getByRole("button", { name: /Start collecting/i });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // Verify URL transitions to /w/[workflowId]/runs/[runId]
    await expect(page).toHaveURL(/\/w\/[a-zA-Z0-9_-]+\/runs\/[a-zA-Z0-9_-]+/, {
      timeout: 10000,
    });

    const runHeading = page.getByRole("heading", { name: /Collection Run/i });
    await expect(runHeading).toBeVisible();

    // Allow route transition to settle
    await page.waitForTimeout(350);

    // Run axe accessibility audit on the landing page/dialog
    const scanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const seriousViolations = scanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );

    expect(seriousViolations).toEqual([]);
  });
});
