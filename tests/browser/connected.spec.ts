import { test, expect } from "@playwright/test";
test("management answers expose inspectable source versions and connector limitations", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html");
  await page
    .getByRole("button", { name: "Evidence fixture", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Management questions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Answer from source records", exact: true })
    .click();
  await expect(
    page.getByText("SYNTHETIC apartment 101 arrival", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Native PMS is not connected.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect source", exact: true })
    .click();
  await expect(
    page.getByText(
      "Current source version — compare with the answer's captured version",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("SYNTHETIC fixture", { exact: true }),
  ).toBeVisible();
});
test("owner summary requires preview and changing report dates invalidates that approval preview", async ({
  page,
}) => {
  await page.goto("/tests/browser/harness.html");
  await page
    .getByRole("button", { name: "Evidence fixture", exact: true })
    .click();
  await page.getByRole("button", { name: "Owners", exact: true }).click();
  await page
    .getByRole("button", { name: "Load owners sources", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Owner apartment", exact: true }).selectOption("u1");
  await page.getByLabel("Report date", { exact: true }).fill("2026-10-15");
  const approve = page.getByRole("button", {
    name: "Approve and release summary",
    exact: true,
  });
  await expect(approve).toBeDisabled();
  await page
    .getByRole("button", { name: "Preview owner summary", exact: true })
    .click();
  await expect(
    page.getByText("SYNTHETIC preview — not profit.", { exact: true }),
  ).toBeVisible();
  await expect(approve).toBeEnabled();
  await page.getByLabel("Report date", { exact: true }).fill("2026-10-16");
  await expect(approve).toBeDisabled();
  await page
    .getByRole("button", { name: "Preview owner summary", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await approve.click();
  await expect(approve).toBeDisabled();
});
