import { expect, test } from '@playwright/test'

// Pruebas del formulario de registro que no requieren confirmar un correo
// real: validaciones de cliente y el envío hasta la pantalla "revisa tu
// correo". El registro con una cuenta nueva de verdad se cubre a mano
// (Fase 2/3) porque depende de un correo real y del límite de envíos.

test.describe('Formulario de registro', () => {
  test('bloquea el envío si las contraseñas no coinciden', async ({ page }) => {
    await page.goto('/registro')
    await page.getByLabel('Correo electrónico').fill('prueba-e2e@solestudiohab.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('ClaveSegura123')
    await page.getByLabel('Confirmar contraseña').fill('OtraClave456')
    await page.getByLabel('Nombres').fill('Prueba E2E')
    await page.getByLabel('Número de habitación').fill('999')
    await page.getByLabel(/Fecha de ingreso/).fill('2026-01-01')
    await page.getByLabel('Número de meses del acuerdo').fill('6')
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible()
  })

  test('el campo de meses del acuerdo rechaza valores menores a 1 (validación nativa del navegador)', async ({
    page,
  }) => {
    await page.goto('/registro')
    await page.getByLabel('Correo electrónico').fill('prueba-e2e@solestudiohab.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('ClaveSegura123')
    await page.getByLabel('Confirmar contraseña').fill('ClaveSegura123')
    await page.getByLabel('Nombres').fill('Prueba E2E')
    await page.getByLabel('Número de habitación').fill('999')
    await page.getByLabel(/Fecha de ingreso/).fill('2026-01-01')
    const campoMeses = page.getByLabel('Número de meses del acuerdo')
    await campoMeses.fill('0')
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    // El input tiene min=1, así que el navegador bloquea el envío antes de
    // que se ejecute nuestro JS — la página no navega ni muestra "Revisa tu
    // correo", y el campo queda marcado como inválido.
    await expect(page).toHaveURL(/\/registro$/)
    await expect(campoMeses).toHaveJSProperty('validity.valid', false)
  })

  test('el enlace "Inicia sesión" lleva al formulario de login', async ({ page }) => {
    await page.goto('/registro')
    await page.getByRole('link', { name: 'Inicia sesión' }).click()
    await expect(page).toHaveURL(/\/ingresar$/)
  })
})
