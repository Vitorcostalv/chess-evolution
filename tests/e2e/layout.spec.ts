import { test, expect } from "@playwright/test";

test("2D board fits the stage without covering clocks or controls after starting", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1150, height: 775 });
  await page.goto("/");
  await page.getByRole("button", { name: "Alternar 2D/3D" }).click();
  await page
    .getByRole("combobox", { name: "Modo", exact: true })
    .selectOption("local");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();

  for (const viewport of [
    { width: 1150, height: 775 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => {
        const stage = await page.locator(".board-stage").boundingBox();
        const board = await page
          .locator(".board-stage > .board-2d")
          .boundingBox();
        const toolbar = await page.locator(".board-toolbar").boundingBox();
        const clocks = await page.locator(".board-clocks").boundingBox();
        if (!stage || !board || !toolbar || !clocks) return false;
        return (
          board.x >= stage.x - 1 &&
          board.y >= stage.y - 1 &&
          board.x + board.width <= stage.x + stage.width + 1 &&
          board.y + board.height <= stage.y + stage.height + 1 &&
          board.y >= clocks.y + clocks.height &&
          board.y + board.height <= toolbar.y &&
          Math.abs(board.width - board.height) < 1
        );
      }, `board contained at ${viewport.width}x${viewport.height}`)
      .toBe(true);
    await expect(page.locator(".board-2d .square")).toHaveCount(64);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }

  await page.setViewportSize({ width: 1150, height: 775 });
  await page.getByRole("button", { name: "e2 branca p", exact: true }).click();
  await page.getByRole("button", { name: "e4 vazia", exact: true }).click();
  await expect(page.locator(".move-list")).toContainText("e4");
  await expect(page.locator(".board-section")).toHaveAttribute(
    "data-transition",
    "false",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/board-2d-contained.png" });
});
