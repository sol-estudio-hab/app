// Sol Estudio Hab — Edge Function: cron-resumen-mora-admin
//
// Job cada 2 días (ver README para la programación con pg_cron). Envía a
// todos los administradores (tabla `admins`) una tabla de control con los
// huéspedes que están en mora: habitación, nombre, mes y fecha de carga
// de su último pago cargado en el sistema (para saber hace cuánto no
// suben comprobante).
//
// "En mora" usa la misma regla que el panel admin (estadoActualAcuerdo):
// el primer mes sin verificar en orden cronológico. Así, si el huésped
// sigue debiendo un mes anterior, se cuenta como en mora aunque el mes
// calendario actual todavía no haya vencido.
//
// Requiere los secrets: CRON_SECRET, RESEND_API_KEY, CORREO_REMITENTE
// (ya existen).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarCorreo } from '../_shared/correo.ts'
import { estadoActualAcuerdo, generarMesesAcuerdo } from '../_shared/calendario.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const ZONA_HORARIA = 'America/Bogota'

interface Acuerdo {
  id: string
  fecha_ingreso: string
  meses_acuerdo: number
  huespedes: { nombres: string; numero_habitacion: string }
}

interface Pago {
  acuerdo_id: string
  mes_pagado: string
  estado: string
  fecha_carga: string | null
}

function hoyEnZonaHoraria(): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return new Date(`${partes}T00:00:00`)
}

function ultimoPagoCargado(acuerdoId: string, pagos: Pago[]): { mes: string; fecha: string } | null {
  const cargados = pagos
    .filter((p) => p.acuerdo_id === acuerdoId && p.fecha_carga)
    .sort((a, b) => new Date(b.fecha_carga!).getTime() - new Date(a.fecha_carga!).getTime())
  if (cargados.length === 0) return null
  return { mes: cargados[0].mes_pagado, fecha: cargados[0].fecha_carga! }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const hoy = hoyEnZonaHoraria()

    const { data: acuerdosData, error: errorAcuerdos } = await supabase
      .from('acuerdos')
      .select('id, fecha_ingreso, meses_acuerdo, huespedes!inner(nombres, numero_habitacion, activo)')
      .eq('estado', 'activo')
      .eq('huespedes.activo', true)
    if (errorAcuerdos) throw new Error(errorAcuerdos.message)

    const acuerdos = (acuerdosData ?? []) as unknown as Acuerdo[]
    const idsAcuerdos = acuerdos.map((a) => a.id)

    const { data: pagosData } = idsAcuerdos.length
      ? await supabase
          .from('pagos')
          .select('acuerdo_id, mes_pagado, estado, fecha_carga')
          .in('acuerdo_id', idsAcuerdos)
      : { data: [] as Pago[] }
    const pagos = (pagosData ?? []) as Pago[]

    const enMora = acuerdos
      .map((acuerdo) => {
        const meses = generarMesesAcuerdo(acuerdo.fecha_ingreso, acuerdo.meses_acuerdo)
        const estado = estadoActualAcuerdo(
          meses,
          (mes) => pagos.find((p) => p.acuerdo_id === acuerdo.id && p.mes_pagado === mes),
          hoy,
        )
        return { acuerdo, estado }
      })
      .filter((f) => f.estado === 'vencido')
      .map(({ acuerdo }) => {
        const ultimo = ultimoPagoCargado(acuerdo.id, pagos)
        return {
          habitacion: acuerdo.huespedes.numero_habitacion,
          nombre: acuerdo.huespedes.nombres,
          ultimoMes: ultimo?.mes ?? null,
          ultimaFecha: ultimo?.fecha ?? null,
        }
      })
      .sort((a, b) => a.habitacion.localeCompare(b.habitacion))

    const { data: admins } = await supabase.from('admins').select('correo')
    const correosAdmin = (admins ?? []).map((a: { correo: string }) => a.correo)
    if (correosAdmin.length === 0) throw new Error('No hay administradores registrados')

    const filasHtml = enMora.length
      ? enMora
          .map(
            (f) => `<tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${f.habitacion}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${f.nombre}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${f.ultimoMes ?? 'Sin pagos cargados'}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${
                f.ultimaFecha ? new Date(f.ultimaFecha).toLocaleString('es') : '—'
              }</td>
            </tr>`,
          )
          .join('')
      : `<tr><td colspan="4" style="padding:8px;">No hay huéspedes en mora en este momento.</td></tr>`

    const html = `
      <p>Resumen de control de mora — Sol Estudio Hab (${hoy.toLocaleDateString('es')})</p>
      <table style="border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif;font-size:14px;">
        <thead>
          <tr style="background-color:#0f766e;color:#ffffff;text-align:left;">
            <th style="padding:8px;">Habitación</th>
            <th style="padding:8px;">Nombre</th>
            <th style="padding:8px;">Último pago cargado</th>
            <th style="padding:8px;">Fecha de carga</th>
          </tr>
        </thead>
        <tbody>${filasHtml}</tbody>
      </table>
      <p style="color:#64748b;font-size:12px;margin-top:12px;">
        "Último pago cargado" es el mes y la fecha en que se subió el comprobante más reciente
        (aprobado o pendiente de revisión) de ese huésped, sin importar si corresponde al mes en
        mora.
      </p>
    `

    const enviado = await enviarCorreo({
      to: correosAdmin,
      subject: `Resumen de mora — ${enMora.length} huésped(es) — Sol Estudio Hab`,
      html,
    })

    return new Response(JSON.stringify({ enviado, enMora: enMora.length }), { status: 200 })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
