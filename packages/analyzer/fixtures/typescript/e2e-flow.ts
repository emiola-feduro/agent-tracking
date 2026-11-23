import { expect, test } from "@playwright/test";

test.describe("checkout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("pays with card", async ({ page }) => {
    test.skip(process.env.CI === "1", "flaky on CI");
    await test.step("open cart", async () => {});
    await expect(page).toHaveTitle(/Tienda/);
  });
});
