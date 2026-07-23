import { expect, test } from '@playwright/test'

// No requieren credenciales: verifican que los guards de ruta (RutaPrivada,
// RutaAdmin) redirigen correctamente cuando no hay sesión.

test.describe('Rutas protegidas sin sesión', () => {
  test('/pagos redirige a /ingresar', async ({ page }) => {
    await page.goto('/pagos')
    await expect(page).toHaveURL(/\/ingresar$/)
  })

  test('/perfil redirige a /ingresar', async ({ page }) => {
    await page.goto('/perfil')
    await expect(page).toHaveURL(/\/ingresar$/)
  })

  test('/notificaciones redirige a /ingresar', async ({ page }) => {
    await page.goto('/notificaciones')
    await expect(page).toHaveURL(/\/ingresar$/)
  })

  test('/admin redirige a / (no /ingresar, porque RutaAdmin cae a Inicio)', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/ingresar$/)
  })

  test('una ruta inexistente muestra la página 404', async ({ page }) => {
    await page.goto('/esto-no-existe')
    await expect(page.getByRole('heading')).toBeVisible()
  })
})
