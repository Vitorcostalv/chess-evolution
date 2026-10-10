import { test, expect } from "@playwright/test";
test("3D renders, accessible game plays and heuristic worker replies", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("REALTIME 3D")).toBeVisible();
  await page.screenshot({
    path: "test-results/arena-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Alternar 2D/3D" }).click();
  await page.getByRole("button", { name: "e2 branca p", exact: true }).click();
  await page.getByRole("button", { name: "e4 vazia", exact: true }).click();
  await expect(page.locator(".move-list")).toContainText("e4");
  await expect(page.locator(".move-list b")).toHaveCount(2);
  await expect
    .poll(() => page.locator(".move-list b").nth(1).textContent(), {
      timeout: 30000,
    })
    .not.toBe("");
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.locator(".move-list b")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeVisible();
});
test("remote mode stays disabled and rejects foreign origins", async ({
  request,
}) => {
  const status = await request.get("/api/remote/status");
  expect((await status.json()).enabled).toBe(false);
  const foreign = await request.post("/api/remote/session", {
    headers: { origin: "https://example.invalid" },
  });
  expect(foreign.status()).toBe(403);
});
test("real training changes weights and survives reload; evaluation does not invent promotion", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Inicializar modelo" }).click();
  await expect(
    page.getByRole("button", { name: "Iniciar treino" }),
  ).toBeEnabled({ timeout: 60000 });
  await page
    .getByRole("spinbutton", { name: "Partidas", exact: true })
    .fill("2");
  await page.getByRole("spinbutton", { name: "Simulações / jogada" }).fill("4");
  await page
    .getByRole("spinbutton", { name: "Limite de meias-jogadas" })
    .fill("8");
  await page.getByRole("spinbutton", { name: "Épocas" }).fill("1");
  await page.getByRole("button", { name: "Iniciar treino" }).click();
  await expect(
    page.getByText(
      "Treinamento concluído. Candidata preservada; promoção exige avaliação competitiva.",
    ),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".metric").nth(1).locator("strong")).toHaveText(
    "1",
  );
  await page.reload();
  await expect(page.locator(".metric").nth(1).locator("strong")).toHaveText(
    "1",
  );
  await page
    .getByRole("combobox")
    .filter({ has: page.locator('option[value="2"]') })
    .last()
    .selectOption("2");
  await page.getByRole("button", { name: "Avaliar candidata" }).click();
  await expect(page.getByText("RESULTADO DA AVALIAÇÃO")).toBeVisible({
    timeout: 90000,
  });
  await expect(page.getByText("SEM PROMOÇÃO", { exact: true })).toBeVisible();
  await page.goto("/games");
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.goto("/tournaments");
  const participants = page.getByRole("checkbox");
  await participants.nth(0).check();
  await participants.nth(1).check();
  await page.getByRole("spinbutton").fill("16");
  await page.getByRole("button", { name: "Iniciar torneio" }).click();
  await expect(
    page.getByText("2/2 partidas registradas.", { exact: false }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
test("pause, cancel and resume keep a consistent training checkpoint", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Inicializar modelo" }).click();
  await expect(
    page.getByRole("button", { name: "Iniciar treino" }),
  ).toBeEnabled({ timeout: 60000 });
  await page.getByRole("spinbutton", { name: "Simulações / jogada" }).fill("4");
  await page
    .getByRole("spinbutton", { name: "Limite de meias-jogadas" })
    .fill("16");
  await page.getByRole("spinbutton", { name: "Épocas" }).fill("4");
  await page.getByRole("spinbutton", { name: "Tamanho do lote" }).fill("2");
  await page.getByRole("button", { name: "Iniciar treino" }).click();
  await expect(
    page.getByText(/Checkpoint consistente após lote 1;/),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByText("PAUSADO", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retomar checkpoint" }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Retomar checkpoint" }).click();
  await expect(
    page.getByText(
      "Treinamento concluído. Candidata preservada; promoção exige avaliação competitiva.",
    ),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".metric").nth(1).locator("strong")).toHaveText(
    "32",
  );
});
test("mobile 2D game reaches checkmate and PGN library persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Alternar 2D/3D" }).click();
  await page
    .getByRole("combobox", { name: "Modo", exact: true })
    .selectOption("local");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  for (const [from, to] of [
    ["f2", "f3"],
    ["e7", "e5"],
    ["g2", "g4"],
    ["d8", "h4"],
  ]) {
    await page.getByRole("button", { name: new RegExp(`^${from} `) }).click();
    await page.getByRole("button", { name: new RegExp(`^${to} `) }).click();
    await expect(page.locator(".board-section")).toHaveAttribute(
      "data-transition",
      "false",
    );
  }
  await expect(page.locator(".result-banner")).toContainText("Xeque-mate");
  await page.screenshot({
    path: "test-results/arena-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Partidas", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("Xeque-mate");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
