import { test, expect } from "@playwright/test";

test.describe("Panel superadmin · Instituciones", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("#email");
    await page.waitForTimeout(1500);
    await page.fill("#email", "superadmin@sia.edu.co");
    await page.fill("#password", "superadmin123");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL(/\/admin\/instituciones/);
  });

  test("crea una institución nueva y aparece en la lista", async ({ page }) => {
    const nombre = `E2E Test ${Date.now()}`;
    await page.getByRole("button", { name: "Nueva institución" }).click();
    await page.fill("#nombre", nombre);
    await page.getByRole("button", { name: "Crear institución" }).click();

    await expect(page.getByText("Institución creada")).toBeVisible();
    await expect(page.getByRole("cell").filter({ hasText: nombre })).toBeVisible();
  });

  test("abre el diálogo de edición precargado y guarda cambios", async ({ page }) => {
    const filaNombre = page.getByRole("cell").filter({ hasText: "Colegio Demostración SIA" });
    await expect(filaNombre.first()).toBeVisible();

    // Botón "Editar" de esa fila.
    await page
      .getByRole("row")
      .filter({ hasText: "Colegio Demostración SIA" })
      .getByRole("button", { name: "Editar" })
      .click();

    const nombreInput = page.locator("#nombre");
    await expect(nombreInput).toHaveValue("Colegio Demostración SIA");
    await nombreInput.fill("Colegio Demostración SIA (Editado E2E)");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // Revertimos el cambio para no ensuciar el seed, reeditando.
    await expect(
      page.getByRole("cell").filter({ hasText: "Colegio Demostración SIA (Editado E2E)" }).first(),
    ).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: "Colegio Demostración SIA (Editado E2E)" })
      .getByRole("button", { name: "Editar" })
      .click();
    await nombreInput.fill("Colegio Demostración SIA");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(filaNombre.first()).toBeVisible();
  });

  test("desactiva y reactiva una institución", async ({ page }) => {
    const fila = page.getByRole("row").filter({ hasText: "Colegio Demostración SIA" });
    await fila.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByText("Institución desactivada")).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: "Colegio Demostración SIA" }).getByText("Inactiva"),
    ).toBeVisible();

    // Reactivamos para dejar el seed intacto.
    await page
      .getByRole("row")
      .filter({ hasText: "Colegio Demostración SIA" })
      .getByRole("button", { name: "Activar" })
      .click();
    await expect(page.getByText("Institución activada")).toBeVisible();
  });
});
