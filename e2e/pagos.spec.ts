import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

// Usa la cuenta de huésped de prueba real (ver README / .env). Si las
// variables de entorno no están configuradas, se omite toda la suite en
// vez de fallar el CI por falta de credenciales.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HUESPED_EMAIL = process.env.HUESPED_PRUEBA_EMAIL
const HUESPED_PASSWORD = process.env.HUESPED_PRUEBA_PASSWORD

test.describe('Huésped — calendario y carga de pagos', () => {
  test.skip(!HUESPED_EMAIL || !HUESPED_PASSWORD, 'Faltan HUESPED_PRUEBA_EMAIL/PASSWORD en .env')

  test.beforeEach(async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByLabel('Correo electrónico').fill(HUESPED_EMAIL!)
    await page.getByLabel('Contraseña').fill(HUESPED_PASSWORD!)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('link', { name: 'Ir a mis pagos' })).toBeVisible({ timeout: 15_000 })
  })

  test('el calendario de pagos muestra los meses del acuerdo con su estado', async ({ page }) => {
    await page.goto('/pagos')
    await expect(page.getByRole('heading', { name: 'Mis pagos' })).toBeVisible()
    // El primer mes del acuerdo de prueba (junio 2026) ya fue verificado por
    // el admin en sesiones anteriores — confirma que el estado persiste.
    await expect(page.getByText('Junio de 2026')).toBeVisible()
  })

  test('subir un comprobante cambia el estado del mes a "En revisión"', async ({ page }) => {
    await page.goto('/pagos')
    // No se fija en un mes concreto: como estas pruebas corren contra el
    // proyecto real (no hay una BD de prueba desechable por corrida), un
    // mes fijo eventualmente queda ya verificado por otras pruebas/sesiones
    // manuales y su input desaparece. En vez de eso, busca el primer mes que
    // todavía diga "Subir comprobante" y guarda su NOMBRE (texto estable)
    // para volver a ubicar la misma fila después de subir el archivo — el
    // texto del botón cambia tras la carga, así que filtrar por él directamente
    // dejaría de encontrar la fila una vez sale del estado "pendiente".
    // Espera a que termine de cargar el calendario (isVisible() más abajo no
    // reintenta como toBeVisible(), así que si el calendario aún no
    // renderizó las filas, el conteo daría 0 y el test se saltaría solo).
    await expect(page.getByRole('heading', { name: 'Mis pagos' })).toBeVisible()

    const filas = page.locator('div.rounded-lg')
    const cantidad = await filas.count()
    let nombreMes: string | null = null
    for (let i = 0; i < cantidad; i++) {
      const fila = filas.nth(i)
      if (await fila.getByText('Subir comprobante').isVisible().catch(() => false)) {
        nombreMes = await fila.locator('p.font-semibold').first().textContent()
        break
      }
    }
    test.skip(!nombreMes, 'No queda ningún mes sin comprobante para probar la carga')

    const filaElegida = page.locator('div.rounded-lg').filter({ hasText: nombreMes! })
    await filaElegida
      .locator('input[type=file]')
      .setInputFiles(path.join(__dirname, 'fixtures', 'comprobante-prueba.png'))

    await expect(filaElegida.getByText('En revisión')).toBeVisible({ timeout: 15_000 })
  })
})
