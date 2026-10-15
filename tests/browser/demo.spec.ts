import { test, expect } from "@playwright/test";
test("demo revenue shows every distribution channel and real-data mode cannot be activated", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("DEMO DATA — NOT ACTUAL PROPERTY PERFORMANCE"),
  ).toBeVisible();
  await page.getByText("Revenue Intelligence", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Revenue Intelligence", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Expedia", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Commission uses the rate recorded"),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Real Property Data", exact: true })
    .click();
  await expect(
    page.getByText("DEMO DATA — NOT ACTUAL PROPERTY PERFORMANCE"),
  ).toBeVisible();
});
test("cloud sign-in renders without exposing company data or accepting role switching", async ({
  page,
}) => {
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        cloudMode: true,
        firebase: {
          apiKey: "test-api-key",
          authDomain: "demo-test.firebaseapp.com",
          projectId: "demo-test",
        },
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Company sign-in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "User Role" })).toHaveCount(
    0,
  );
});
test("operations board shows arrivals, drafts, contact completion and editable service rules", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html");
  await expect(
    page.getByRole("heading", { name: "Arrivals (1)" }),
  ).toBeVisible();
  await expect(page.getByText("No PMS connected")).toBeVisible();
  await page.getByRole("button", { name: "Prepare message" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Message draft" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue(/101/);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Record contact completed" })
    .first()
    .click();
  await expect(page.getByText(/GST · completed/)).toBeVisible();
  await page
    .getByRole("button", { name: "Edit templates and SLA rules" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Service-policy editor" }),
  ).toBeVisible();
  await page.getByLabel("Operations date").fill("");
  await expect(
    page.getByRole("heading", {
      name: "Next-day operations and guest-service SLA",
    }),
  ).toBeVisible();
});
test("distribution directory adds a new channel to the revenue matrix", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html");
  await page.getByRole("button", { name: "Revenue fixture" }).click();
  await page.getByLabel("Channel name", { exact: true }).fill("TripAdvisor");
  await page.getByLabel("Source aliases (comma separated)").fill("TA");
  await page.getByRole("button", { name: "Add channel", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "TripAdvisor", exact: true }),
  ).toBeVisible();
});
