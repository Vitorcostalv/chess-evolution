import { test, expect } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";

test("studio board remains playable in 3D, with camera and quality changes", async ({
  page,
}) => {
  // Software WebGL compiles each quality profile on CPU in CI.
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Modo", exact: true })
    .selectOption("local");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const canvas = page.locator("canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const { width, height, x, y } = bounds!;
  const camera = new OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    100,
  );
  camera.position.set(9, 12, 10);
  camera.zoom = Math.min(width, height) * 0.078;
  camera.lookAt(0, 0.3, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  async function clickPosition(position: Vector3) {
    const point = position.project(camera);
    await page.mouse.click(
      x + ((point.x + 1) * width) / 2,
      y + ((1 - point.y) * height) / 2,
    );
  }
  // Raycast the pawn itself, then an empty destination: covers real 3D input.
  await clickPosition(new Vector3(0.5, 0.8, 2.5));
  await clickPosition(new Vector3(0.5, 0.1, 0.5));
  await expect(page.locator(".move-list")).toContainText("e4");
  await page.waitForTimeout(700);
  await canvas.screenshot({ path: "test-results/board-studio.png" });
  await page.getByRole("button", { name: "Alternar câmera" }).click();
  await page.getByRole("button", { name: "Inverter tabuleiro" }).click();
  await expect(canvas).toBeVisible();
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await page.getByRole("combobox").nth(0).selectOption("low");
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(700);
  await page
    .locator("canvas")
    .screenshot({ path: "test-results/board-top-low.png" });
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await page.getByRole("combobox").nth(0).selectOption("high");
  await page.getByRole("combobox").nth(2).selectOption("isometric");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(1000);
  await page
    .locator("canvas")
    .screenshot({ path: "test-results/board-mobile-high.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
