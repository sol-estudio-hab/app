import { expect, test } from '@playwright/test'

// Usa la cuenta de administrador de prueba real (ver README / .env).

const ADMIN_EMAIL = process.env.ADMIN_PRUEBA_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PRUEBA_PASSWORD

test.describe('Administrador — panel y reportes', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Faltan ADMIN_PRUEBA_EMAIL/PASSWORD en .env')

  test.beforeEach(async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByLabel('Correo electrónico').fill(ADMIN_EMAIL!)
    await page.getByLabel('Contraseña').fill(ADMIN_PASSWORD!)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('link', { name: 'Panel admin' })).toBeVisible({ timeout: 15_000 })
  })

  test('el panel admin lista huéspedes y permite entrar al detalle', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Panel administrador' })).toBeVisible()
    await page.getByRole('link', { name: 'Ver detalle' }).first().click()
    await expect(page.getByText('Guardar cambios')).toBeVisible()
  })

  test('verificar un pago cargado lo marca como "Pagado" y bloquea su edición', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('link', { name: 'Ver detalle' }).first().click()
    // Espera a que termine de cargar el detalle antes de mirar si hay un
    // botón "Verificar" — isVisible() no reintenta como toBeVisible().
    await expect(page.getByText('Guardar cambios')).toBeVisible()

    const botonesVerificar = page.getByRole('button', { name: 'Verificar' })
    const cantidadInicial = await botonesVerificar.count()
    test.skip(cantidadInicial === 0, 'No hay ningún pago en estado "cargado" para verificar ahora mismo')

    await botonesVerificar.first().click()
    await expect(page.getByText('Pagado').first()).toBeVisible()
    // El locator se reevalúa en vivo: puede haber más de un pago "cargado"
    // a la vez, así que lo correcto es esperar un botón menos, no cero.
    await expect(botonesVerificar).toHaveCount(cantidadInicial - 1)
  })

  test('los reportes muestran el resumen del mes y permiten exportar CSV', async ({ page }) => {
    await page.goto('/admin/reportes')
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible()
    await expect(page.getByText('Pagados')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeEnabled()
  })
})
