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
test("integrated forty-unit market demo supports matching, guarded approvals, map and report export", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Geographic Market Intelligence",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Geographic Market & Revenue Intelligence",
    }),
  ).toBeVisible();
  await expect(page.getByText(/40 synthetic apartments/)).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze market prices", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Forward pricing", exact: true })
    .click();
  await expect(
    page.getByRole("columnheader", {
      name: "Market guest-night median",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save for GM review" })
    .first()
    .click();
  await page
    .getByLabel("Management reason", { exact: true })
    .fill("Reviewed matching evidence and owner constraints");
  await page
    .getByLabel("Approved room-rate override (optional)")
    .fill("100000");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Approve internal proposal", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("guardrails");
  await page.getByLabel("Approved room-rate override (optional)").fill("");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Approve internal proposal", exact: true })
    .click();
  await expect(page.getByText(/Proposed room rate.*approved/)).toBeVisible();
  await page
    .getByRole("button", { name: "Geographic map", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Interactive geographic market map" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Comparable evidence", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Why each observation was included or excluded",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell").filter({ hasText: "SYNTHETIC Operator 0" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Prepare report snapshot and download",
      exact: true,
    })
    .click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/market-review\.html$/);
  await page
    .getByRole("combobox", { name: "Geographic scope", exact: true })
    .selectOption("building");
  await page
    .getByRole("button", { name: "Analyze market prices", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Forward pricing", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save for GM review" }),
  ).toHaveCount(0);
});

test("readiness workflow shows 40 synthetic units, legal activation blockers, channel gaps and review report", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Compliance, Activation & OTA", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Property Readiness & Activation",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Apartment", { exact: true }).locator("option"),
  ).toHaveCount(40);
  await page
    .getByRole("button", { name: "Property Activation Center", exact: true })
    .click();
  await expect(
    page.getByText(
      "Jurisdiction-specific mandatory requirements must be reviewed and configured",
      { exact: false },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Requested property status", { exact: true })
    .selectOption("Active / Rentable");
  await page
    .getByLabel("Approval or status-change reason", { exact: true })
    .fill("Attempt activation without permit evidence");
  await page
    .getByRole("button", { name: "Record GM status decision", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Activation blocked");
  await page
    .getByRole("button", { name: "OTA Listing Readiness", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add channel checklist", exact: true })
    .click();
  await expect(
    page.getByText("Needs attention: Unverified amenity:", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Needs attention: Approved photo missing or below configured width: cover",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Airbnb title", { exact: true })
    .fill("Factual synthetic studio apartment");
  await page
    .getByRole("button", { name: "Save OTA readiness", exact: true })
    .click();
  await page
    .getByRole("button", { name: "General Manager Briefing", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Download internal readiness review",
      exact: true,
    })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "SYNTHETIC-Readiness-Review.html",
  );
  await expect(
    page.getByText("Airbnb: Not Started", { exact: false }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", {
      name: "Property Readiness & Activation",
      exact: true,
    }),
  ).toBeVisible();
});

test("accounting demo separates payments from revenue and keeps unknown Odoo disconnected", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Odoo Accounting & Financial Intelligence",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Odoo Accounting & Financial Intelligence",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "SYNTHETIC ACCOUNTING DEMONSTRATION — no real transactions",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.getByText("AED 400,000.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await expect(
    page.locator("summary").filter({ hasText: "SIM-PAY-" }),
  ).toHaveCount(40);
  await page
    .getByRole("button", { name: "Reconciliation", exact: true })
    .click();
  await expect(
    page.getByText("Payment document totals: AED 420000.00.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connection setup", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Check synchronization readiness",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("disabled");
  await page.getByRole("button", { name: "CSV import", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download blank CSV template", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "accounting-journal-headers.csv",
  );
  await expect(
    page.getByRole("button", {
      name: "Preview accounting import",
      exact: true,
    }),
  ).toBeDisabled();
});

test("report center uses white paper, distinct date periods and isolated printable content", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Reports Center", exact: true })
    .click();
  await page.getByLabel("Report date", { exact: true }).fill("2026-10-15");
  const paper = page.locator(".management-report");
  await expect(paper).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(paper).toContainText("SYNTHETIC DEMONSTRATION");
  await expect(paper).not.toContainText("GAAP / USALI Verified");
  await expect(paper).not.toContainText("Property Owner & Asset Board");
  await expect(paper).toContainText("1 Oct 2026 - 31 Oct 2026");
  const monthlyRevenue = await paper
    .locator(".report-kpi")
    .filter({ hasText: "Total revenue" })
    .innerText();
  await page.getByRole("button", { name: "Daily report", exact: true }).click();
  await expect(
    paper.getByRole("heading", { name: "Daily Operations Brief", exact: true }),
  ).toBeVisible();
  await expect(paper).toContainText("15 Oct 2026 - 15 Oct 2026");
  expect(
    await paper
      .locator(".report-kpi")
      .filter({ hasText: "Total revenue" })
      .innerText(),
  ).not.toBe(monthlyRevenue);
  await page
    .getByRole("button", { name: "Weekly report", exact: true })
    .click();
  await expect(paper).toContainText("9 Oct 2026 - 15 Oct 2026");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".report-toolbar")).toBeHidden();
  await expect(paper).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(
    page.getByRole("button", { name: "Reports Center", exact: true }),
  ).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export report CSV", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain(
    "SYNTHETIC-WEEKLY-2026-10-09",
  );
  await page.getByLabel("Report date", { exact: true }).fill("");
  await expect(
    page.getByRole("button", { name: "Print / Save PDF", exact: true }),
  ).toBeDisabled();
});

test("employee names drive document and task selectors while account IDs stay internal", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Compliance, Activation & OTA", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Team responsibilities", exact: true })
    .click();
  await page
    .getByLabel("Team member", { exact: true })
    .selectOption("synthetic-operations");
  await page
    .getByLabel("Employee display name", { exact: true })
    .fill("Alex Demo");
  await page
    .getByRole("button", { name: "Save employee name", exact: true })
    .click();
  await expect(
    page.getByText("Demo employee name saved for this session only.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Team member", { exact: true })
    .selectOption("synthetic-reservations");
  await page
    .getByLabel("Employee display name", { exact: true })
    .fill("Alex Demo");
  await page
    .getByRole("button", { name: "Save employee name", exact: true })
    .click();
  const options = page
    .getByLabel("Team member", { exact: true })
    .locator("option");
  await expect(options).toContainText([
    "Select a team member",
    "Demo General Manager",
    "Alex Demo · Revenue Manager · Seat 2",
    "Alex Demo · Read-Only Viewer · Seat 3",
  ]);
  await expect(options).not.toContainText([
    "synthetic-gm",
    "synthetic-reservations",
    "synthetic-operations",
  ]);
  await page
    .getByRole("button", { name: "PRO & Compliance Center", exact: true })
    .click();
  await page
    .getByText("Jurisdiction rules and renewal reminders", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add requirement", exact: true })
    .click();
  await page
    .getByLabel("Requirement name", { exact: true })
    .fill("Synthetic permit");
  await page
    .getByRole("button", { name: "Save jurisdiction rules", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add document record", exact: true })
    .click();
  await page
    .getByLabel("Responsible employee", { exact: true })
    .selectOption("synthetic-operations");
  await expect(
    page.getByLabel("Responsible employee", { exact: true }),
  ).toHaveValue("synthetic-operations");
  await page
    .getByRole("button", { name: "Save compliance records", exact: true })
    .click();
  await expect(
    page.getByLabel("Responsible employee", { exact: true }),
  ).toHaveValue("synthetic-operations");
  await page
    .getByRole("button", { name: "Property Activation Center", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add assigned task", exact: true })
    .click();
  await page
    .getByLabel("Task", { exact: true })
    .fill("Synthetic permit follow-up");
  await page.getByLabel("Due date", { exact: true }).fill("2026-01-01");
  await page
    .getByLabel("Assigned employee", { exact: true })
    .selectOption("synthetic-reservations");
  await page
    .getByRole("button", {
      name: "Save readiness checks and tasks",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Assigned employee", { exact: true }),
  ).toHaveValue("synthetic-reservations");
  await page
    .getByRole("button", { name: "General Manager Briefing", exact: true })
    .click();
  await expect(
    page.getByText(
      "Overdue: Synthetic permit follow-up · Alex Demo · Revenue Manager · Seat 2 · 2026-01-01",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "synthetic-reservations",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Compliance, Activation & OTA", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Team responsibilities", exact: true })
    .click();
  await expect(
    page.getByLabel("Team member", { exact: true }).locator("option"),
  ).toContainText([
    "Demo General Manager",
    "Demo Reservations Lead",
    "Demo Operations Lead",
  ]);
});

test("management centre combines evidence, per-property policies and immutable synthetic report versions", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Management Centre", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "General Manager priority list",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Responsible: Demo Operations Lead", { exact: false })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect evidence", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Source evidence — current recorded version",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Property settings", exact: true })
    .click();
  const units = await page
    .getByLabel("Property apartment", { exact: true })
    .locator("option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  await page.getByLabel("Check-in time", { exact: true }).fill("00:30");
  await page
    .getByLabel("Pre-arrival contact offset hours", { exact: true })
    .fill("-2");
  await page
    .getByLabel("Operating preferences", { exact: true })
    .fill("SYNTHETIC quiet arrival arrangement");
  await page
    .getByRole("button", { name: "Save property policy", exact: true })
    .click();
  await page
    .getByLabel("Property apartment", { exact: true })
    .selectOption(units[1]);
  await expect(page.getByLabel("Check-in time", { exact: true })).toHaveValue(
    "15:00",
  );
  await page
    .getByLabel("Property apartment", { exact: true })
    .selectOption(units[0]);
  await expect(page.getByLabel("Check-in time", { exact: true })).toHaveValue(
    "00:30",
  );
  await page
    .getByRole("button", { name: "Report history", exact: true })
    .click();
  await page
    .getByLabel("Report period", { exact: true })
    .selectOption("MONTHLY");
  await page
    .getByLabel("Report version date", { exact: true })
    .fill("2026-10-15");
  await page
    .getByRole("button", { name: "Save report version", exact: true })
    .click();
  await expect(
    page.getByText(
      "2026-10-01 to 2026-10-31 compared with 2026-09-01 to 2026-09-30",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save report version", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /^Open MONTHLY/ })).toHaveCount(
    2,
  );
  await page
    .getByRole("button", { name: "Private files", exact: true })
    .click();
  await expect(
    page.getByText(
      "Synthetic demonstration: file storage and virus scanning are disconnected.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Upload private evidence", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Staff access", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Create private invitation",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Staging", exact: true }).click();
  await expect(
    page.getByText("Not verified live.", { exact: false }),
  ).toBeVisible();
});
test("invited account sign-up is available without leaking the invitation fragment in the URL", async ({
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
  await page.goto("/#invite=" + "S".repeat(43));
  await expect(
    page.getByRole("button", { name: "Create invited account", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: "Management Centre", exact: true }),
  ).toHaveCount(0);
});
