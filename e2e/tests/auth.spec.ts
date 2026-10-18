import { test, expect } from "@playwright/test";

async function login(page, correo: string, password: string) {
  await page.goto("/login");
  // Espera la hidratación de React para que el submit no haga un GET nativo.
  await page.waitForSelector("#email");
  await page.waitForTimeout(1500);
  await page.fill("#email", correo);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}

test.describe("Autenticación", () => {
  test("muestra errores con credenciales inválidas", async ({ page }) => {
    await login(page, "admin@sia.edu.co", "clave-incorrecta");
    // El mensaje de error aparece como toast de sonner.
    await expect(page.getByText("Credenciales inválidas")).toBeVisible();
  });

  test("valida el formulario cuando falta la contraseña", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("#email");
    await page.waitForTimeout(1500);
    // Email válido (evita la validación nativa del navegador) y contraseña vacía.
    await page.fill("#email", "admin@sia.edu.co");
    await page.click("button[type=submit]");
    await expect(page.getByText("Ingresa tu contraseña")).toBeVisible();
  });

  test("inicia sesión como superadmin y accede a instituciones", async ({ page }) => {
    await login(page, "superadmin@sia.edu.co", "superadmin123");
    await expect(page).toHaveURL(/\/admin\/instituciones/);
    await expect(page.getByRole("heading", { name: "Instituciones" })).toBeVisible();
    // La institución demo está presente.
    await expect(page.getByText("Colegio Demostración SIA")).toBeVisible();
  });

  test("inicia sesión como admin y accede al panel admin", async ({ page }) => {
    await login(page, "admin@sia.edu.co", "admin123");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText(/Bienvenido/i).first()).toBeVisible();
  });

  test("redirige al login si la sesión no existe", async ({ page }) => {
    await page.goto("/admin/instituciones");
    await expect(page).toHaveURL(/\/login/);
  });
});
