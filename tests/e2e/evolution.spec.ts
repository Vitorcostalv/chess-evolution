import { test, expect } from "@playwright/test";
async function move(
  page: import("@playwright/test").Page,
  from: string,
  to: string,
) {
  await page.getByRole("button", { name: new RegExp(`^${from} `) }).click();
  await page.getByRole("button", { name: new RegExp(`^${to} `) }).click();
  await expect(page.locator(".board-section").first()).toHaveAttribute(
    "data-transition",
    "false",
  );
}
test("themes persist, SVG artwork renders, and unavailable WebGL has an honest fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext as (
      type: string,
      options?: unknown,
    ) => RenderingContext | null;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: unknown,
    ) {
      if (type === "webgl2" || type === "webgl") return null;
      return original.call(this, type, options);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(page.getByText("ACCESSIBLE 2D")).toBeVisible();
  await expect(
    page.getByText("Este navegador não disponibilizou o 3D.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tentar 3D novamente" }).click();
  await expect(page.locator(".board-2d .svg-piece svg")).toHaveCount(32);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Mineral", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Animações", exact: true })
    .selectOption("off");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mineral", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Animações", exact: true }),
  ).toHaveValue("off");
  await page.screenshot({
    path: "test-results/appearance-panel.png",
    fullPage: true,
  });
  await page.goto("/");
  await expect(page.locator(".board-2d")).toHaveCSS("--chess-dark", "#4b6068");
});
test("animated local game, increment clock, mate, replay and worker review preserve the result", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Alternar 2D/3D" }).click();
  await page
    .getByRole("combobox", { name: "Modo", exact: true })
    .selectOption("local");
  await page
    .getByRole("combobox", { name: "Relógio", exact: true })
    .selectOption("180+2");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  for (const [a, b] of [
    ["f2", "f3"],
    ["e7", "e5"],
    ["g2", "g4"],
    ["d8", "h4"],
  ])
    await move(page, a, b);
  await expect(page.locator(".result-banner")).toContainText("Xeque-mate");
  await expect(page.locator(".board-clocks")).toContainText("03:");
  await page.getByRole("button", { name: "Primeira posição" }).click();
  await expect(
    page.getByRole("button", { name: "f2 branca p", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Próxima posição" }).click();
  await expect(
    page.getByRole("button", { name: "f3 branca p", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Última posição" }).click();
  await page
    .getByRole("combobox", { name: "Velocidade do replay", exact: true })
    .selectOption("200");
  await page
    .getByRole("button", { name: "Reproduzir replay", exact: true })
    .click();
  await expect(page.locator(".board-top")).toContainText("Revisão · 4/4");
  await page.getByRole("button", { name: "Sair da revisão" }).click();
  await expect(page.locator(".result-banner")).toContainText("0-1");
  await page.getByRole("button", { name: "Calcular revisão" }).click();
  await expect(
    page.getByText("Revisão concluída.", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByText("Jogada feita, sugestão e linhas calculadas").click();
  await expect(page.locator(".review-analysis tbody tr")).toHaveCount(5);
  await page.screenshot({
    path: "test-results/review-desktop.png",
    fullPage: true,
  });
});

test("2D special moves animate the right identities and retain captures until arrival", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByRole("spinbutton", { name: "Duração normal (ms)", exact: true })
    .fill("300");
  await page
    .getByRole("combobox", { name: "Modo do tabuleiro", exact: true })
    .selectOption("2d");
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Modo", exact: true })
    .selectOption("local");
  async function load(fen: string) {
    await page.locator("#fen-input").fill(fen);
    await page.getByRole("button", { name: /^Carregar/ }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  }
  await load("7k/8/8/3pP3/8/8/8/7K w - d6 0 1");
  await page.getByRole("button", { name: "e5 branca p", exact: true }).click();
  await page.getByRole("button", { name: "d6 vazia", exact: true }).click();
  await expect(page.locator('[data-exiting="true"]')).toHaveAttribute(
    "data-square",
    "d5",
  );
  await expect(page.locator(".board-section")).toHaveAttribute(
    "data-transition",
    "false",
  );
  await expect(page.locator('[data-exiting="true"]')).toHaveCount(0);
  await load("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const king = await page
      .locator('[data-square="e1"]')
      .getAttribute("data-piece-id"),
    rook = await page
      .locator('[data-square="h1"]')
      .getAttribute("data-piece-id");
  await move(page, "e1", "g1");
  await expect(page.locator('[data-square="g1"]')).toHaveAttribute(
    "data-piece-id",
    king!,
  );
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute(
    "data-piece-id",
    rook!,
  );
  await load("7k/P7/8/8/8/8/8/7K w - - 0 1");
  const pawn = await page
    .locator('[data-square="a7"]')
    .getAttribute("data-piece-id");
  await page.getByRole("button", { name: "a7 branca p", exact: true }).click();
  await page.getByRole("button", { name: "a8 vazia", exact: true }).click();
  await page.getByRole("button", { name: "Promover para cavalo" }).click();
  await expect(
    page.getByRole("button", { name: "a8 branca n", exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-square="a8"]')).toHaveAttribute(
    "data-piece-id",
    pawn!,
  );
});
test("position exercises stay separate from the arena and a real mate solves the puzzle", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Alternar 2D/3D" }).click();
  await page
    .getByRole("combobox", { name: "Modo", exact: true })
    .selectOption("local");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await move(page, "e2", "e4");
  await page.getByRole("link", { name: "Posições", exact: true }).click();
  await page.getByRole("button", { name: "f7 branca q", exact: true }).click();
  await page.getByRole("button", { name: "g7 vazia", exact: true }).click();
  await expect(
    page.getByText("Resolvido: xeque-mate verificado pelas regras."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar exercício" }).click();
  await expect(
    page.getByRole("button", { name: "f7 branca q", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "e4 branca p", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".move-list")).toContainText("e4");
});
test("AI stepping uses real search and a new local game ignores a stale reply", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Modo", exact: true })
    .selectOption("ai");
  await page
    .getByRole("combobox", { name: "Velocidade IA × IA", exact: true })
    .selectOption("0");
  await page.getByRole("button", { name: "Avançar um lance de IA" }).click();
  await expect(page.locator(".move-list b")).toHaveCount(2);
  await expect(page.locator(".move-list b").first()).not.toHaveText("");
  await expect(
    page.getByRole("button", { name: "Avançar um lance de IA" }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: "Análise", exact: true }).click();
  await expect(page.locator(".search-stats strong").nth(1)).not.toHaveText("—");
  await page.getByRole("tab", { name: "Configuração", exact: true }).click();
  await page.getByRole("button", { name: "Avançar um lance de IA" }).click();
  await page
    .getByRole("combobox", { name: "Modo", exact: true })
    .selectOption("local");
  await page.getByRole("button", { name: "Nova partida", exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(page.locator(".move-list b")).toHaveCount(0);
});

test("two trained generations compare actual equivalent evaluations and replay their games", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/lab");
  await page.getByRole("button", { name: "Inicializar modelo" }).click();
  await expect(
    page.getByRole("button", { name: "Iniciar treino" }),
  ).toBeEnabled({ timeout: 60000 });
  await page.getByRole("spinbutton", { name: "Simulações / jogada" }).fill("4");
  await page
    .getByRole("spinbutton", { name: "Limite de meias-jogadas" })
    .fill("8");
  await page.getByRole("spinbutton", { name: "Épocas", exact: true }).fill("1");
  await page
    .getByRole("combobox")
    .filter({ has: page.locator('option[value="2"]') })
    .last()
    .selectOption("2");
  for (let generation = 1; generation <= 2; generation++) {
    await page.getByRole("button", { name: "Iniciar treino" }).click();
    await expect(
      page.getByText(
        "Treinamento concluído. Candidata preservada; promoção exige avaliação competitiva.",
      ),
    ).toBeVisible({ timeout: 60000 });
    await expect(
      page.getByRole("button", { name: "Avaliar candidata" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Avaliar candidata" }).click();
    await expect(page.getByText("RESULTADO DA AVALIAÇÃO")).toBeVisible({
      timeout: 60000,
    });
    await expect(
      page.getByRole("button", { name: "Iniciar treino" }),
    ).toBeEnabled({ timeout: 60000 });
  }
  const values = await page
    .getByRole("combobox", { name: "Geração A" })
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => ({
        value: (option as HTMLOptionElement).value,
        text: option.textContent ?? "",
      })),
    );
  await page
    .getByRole("combobox", { name: "Geração A" })
    .selectOption(
      values.find((option) => option.text.includes("geração 1"))!.value,
    );
  await page
    .getByRole("combobox", { name: "Geração B" })
    .selectOption(
      values.find((option) => option.text.includes("geração 2"))!.value,
    );
  await expect(
    page.getByText("Mesma referência", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Assistir:/ })).toHaveCount(4);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  const endings = await page.evaluate(async () => {
    const request = indexedDB.open("chess-evolution");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const get = db.transaction("games").objectStore("games").getAll();
    const games = await new Promise<
      Array<{ mode: string; termination: string }>
    >((resolve) => {
      get.onsuccess = () => resolve(get.result);
    });
    db.close();
    return games
      .filter((game) => game.mode === "selfplay")
      .map((game) => game.termination);
  });
  expect(endings).toHaveLength(4);
  expect(endings.every((ending) => ending === "budget")).toBe(true);
  await page
    .getByRole("button", { name: /^Assistir:/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".result-banner")).toContainText(
    "Empate adjudicado",
  );
});
