/**
 * E2E tests proving Graph Network Search uses the global Application Locale.
 *
 * @covers /graph
 * @level functional
 */
import { test, expect, mockAllApis } from "../fixtures";

// @covers /graph -> global-locale
// @level functional
test.describe("Graph Network Search global locale", () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await mockAllApis(page);
    await page.route("**/api/locale/preference", (route) =>
      route.fulfill({ json: { locale: "zh-CN" } })
    );
  });

  test("does not render the old module-local language toggle", async ({
    authedPage: page,
  }) => {
    await page.goto("/graph");

    await expect(page.getByText("Customer Graph")).toBeVisible();

    // The old in-card toggle was a button whose text was exactly the
    // other-language name ("中文" in English, "English" in Chinese).
    await expect(
      page.getByRole("button", { name: "中文", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "English", exact: true })
    ).toHaveCount(0);

    // The global header switcher is still present.
    await expect(page.getByRole("button", { name: /Current language/i }).first()).toBeVisible();
  });

  test("renders graph labels in English by default", async ({
    authedPage: page,
  }) => {
    await page.goto("/graph");

    await expect(page.getByText("Customer Graph")).toBeVisible();
    await expect(page.getByText("Relationship search")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();

    await page.getByRole("tab", { name: "Table" }).click();
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "Customer ID" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Risk" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Account balance" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Link" })).toBeVisible();
  });

  test("updates graph labels immediately via the header language switcher", async ({
    authedPage: page,
  }) => {
    await page.goto("/graph");

    await expect(page.getByText("Customer Graph")).toBeVisible();

    await page.getByRole("button", { name: /Current language/i }).first().click();
    await page.getByRole("menuitem", { name: "简体中文" }).first().click();

    await expect(page.getByText("客户图谱")).toBeVisible();
    await expect(page.getByText("关系查询")).toBeVisible();
    await expect(page.getByRole("button", { name: "查询" })).toBeVisible();

    await page.getByRole("tab", { name: "表格" }).click();
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "客户 ID" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "风险" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "账户余额" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "关联" })).toBeVisible();

    // Source evidence values stay unchanged in Chinese locale.
    await expect(table.getByText("Li Na")).toBeVisible();
    await expect(table.getByText("NEIGHBOR_001")).toBeVisible();
    await expect(table.getByText("+86-138-0000-1234")).toBeVisible();
  });
});
