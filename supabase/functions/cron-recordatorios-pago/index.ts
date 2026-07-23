// Sol Estudio Hab — Edge Function: cron-recordatorios-pago
//
// Job diario (ver README para la programación con pg_cron). Recorre los
// acuerdos activos y, por cada mes sin comprobante cargado/verificado:
//   - día de pago + 2 días  → notificación "recordatorio"
//   - día de pago + 6 días  → notificación "mora"
// Además, si ya se cumplieron los meses del acuerdo, lo marca como
// finalizado, desactiva al huésped y envía el aviso de fin de acuerdo.
//
// Requiere los secrets: CRON_SECRET, RESEND_API_KEY, CORREO_REMITENTE,
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (ver README).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { enviarCorreo } from '../_shared/correo.ts'
import { enviarPushAHuesped } from '../_shared/push.ts'
import { fechaFinAcuerdo, generarMesesAcuerdo, mismaFecha, sumarDias } from '../_shared/calendario.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const ZONA_HORARIA = 'America/Bogota'

interface Acuerdo {
  id: string
  huesped_id: string
  fecha_ingreso: string
  meses_acuerdo: number
  huespedes: { correo: string; nombres: string; numero_habitacion: string }
}

interface Pago {
  acuerdo_id: string
  mes_pagado: string
  estado: string
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

function yaCubierto(mes: string, acuerdoId: string, pagos: Pago[]): boolean {
  const pago = pagos.find((p) => p.acuerdo_id === acuerdoId && p.mes_pagado === mes)
  return Boolean(pago && (pago.estado === 'cargado' || pago.estado === 'verificado'))
}

async function registrarYNotificar(
  supabase: SupabaseClient,
  huespedId: string,
  correoHuesped: string,
  tipo: 'recordatorio' | 'mora' | 'fin_acuerdo',
  mesReferencia: string | null,
  asunto: string,
  html: string,
  push: { title: string; body: string },
) {
  await supabase
    .from('notificaciones')
    .insert({ huesped_id: huespedId, tipo, canal: 'app', mes_referencia: mesReferencia })

  const claimCorreo = await supabase
    .from('notificaciones')
    .insert({ huesped_id: huespedId, tipo, canal: 'correo', mes_referencia: mesReferencia })
    .select('id')
    .single()
  if (!claimCorreo.error) {
    await enviarCorreo({ to: [correoHuesped], subject: asunto, html })
  }

  const claimPush = await supabase
    .from('notificaciones')
    .insert({ huesped_id: huespedId, tipo, canal: 'push', mes_referencia: mesReferencia })
    .select('id')
    .single()
  if (!claimPush.error) {
    await enviarPushAHuesped(supabase, huespedId, push)
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const hoy = hoyEnZonaHoraria()

  const { data: acuerdosData, error: errorAcuerdos } = await supabase
    .from('acuerdos')
    .select(
      'id, huesped_id, fecha_ingreso, meses_acuerdo, huespedes!inner(correo, nombres, numero_habitacion, activo)',
    )
    .eq('estado', 'activo')
    .eq('huespedes.activo', true)

  if (errorAcuerdos) {
    console.error(errorAcuerdos)
    return new Response(JSON.stringify({ error: errorAcuerdos.message }), { status: 500 })
  }

  const acuerdos = (acuerdosData ?? []) as unknown as Acuerdo[]
  const idsAcuerdos = acuerdos.map((a) => a.id)

  const { data: pagosData } = idsAcuerdos.length
    ? await supabase.from('pagos').select('acuerdo_id, mes_pagado, estado').in('acuerdo_id', idsAcuerdos)
    : { data: [] as Pago[] }
  const pagos = (pagosData ?? []) as Pago[]

  let recordatorios = 0
  let moras = 0
  let finesDeAcuerdo = 0

  for (const acuerdo of acuerdos) {
    const meses = generarMesesAcuerdo(acuerdo.fecha_ingreso, acuerdo.meses_acuerdo)

    for (const { mes, vencimiento } of meses) {
      if (yaCubierto(mes, acuerdo.id, pagos)) continue

      if (mismaFecha(sumarDias(vencimiento, 2), hoy)) {
        await registrarYNotificar(
          supabase,
          acuerdo.huesped_id,
          acuerdo.huespedes.correo,
          'recordatorio',
          mes,
          `Recordatorio de pago — Sol Estudio Hab (${mes})`,
          `<p>Hola ${acuerdo.huespedes.nombres},</p>
           <p>Este es un recordatorio: el pago del arriendo de la habitación ${acuerdo.huespedes.numero_habitacion} correspondiente a <strong>${mes}</strong> venció el ${vencimiento.toLocaleDateString('es')}.</p>
           <p>Si ya realizaste el pago, ingresa a la app y sube tu comprobante. Si aún no lo has hecho, por favor ponte al día lo antes posible.</p>`,
          { title: 'Recordatorio de pago', body: `Tu pago de ${mes} está pendiente de comprobante.` },
        )
        recordatorios++
      }

      if (mismaFecha(sumarDias(vencimiento, 6), hoy)) {
        await registrarYNotificar(
          supabase,
          acuerdo.huesped_id,
          acuerdo.huespedes.correo,
          'mora',
          mes,
          `Aviso de mora — Sol Estudio Hab (${mes})`,
          `<p>Hola ${acuerdo.huespedes.nombres},</p>
           <p>Tu pago de arriendo de la habitación ${acuerdo.huespedes.numero_habitacion} correspondiente a <strong>${mes}</strong> está en mora (venció el ${vencimiento.toLocaleDateString('es')}).</p>
           <p>Por favor realiza el pago y sube tu comprobante en la app lo antes posible. Si ya pagaste, sube el comprobante para regularizar tu cuenta.</p>`,
          { title: 'Pago en mora', body: `Tu pago de ${mes} sigue sin comprobante. Por favor regulariza tu cuenta.` },
        )
        moras++
      }
    }

    const fin = fechaFinAcuerdo(acuerdo.fecha_ingreso, acuerdo.meses_acuerdo)
    if (hoy >= fin) {
      await supabase.from('acuerdos').update({ estado: 'finalizado' }).eq('id', acuerdo.id)
      await supabase.from('huespedes').update({ activo: false }).eq('id', acuerdo.huesped_id)
      await registrarYNotificar(
        supabase,
        acuerdo.huesped_id,
        acuerdo.huespedes.correo,
        'fin_acuerdo',
        null,
        'Tu acuerdo de arriendo ha finalizado — Sol Estudio Hab',
        `<p>Hola ${acuerdo.huespedes.nombres},</p>
         <p>Tu acuerdo de arriendo de la habitación ${acuerdo.huespedes.numero_habitacion} llegó a su fin.</p>
         <p>Si deseas renovar, por favor contacta al administrador para registrar el nuevo acuerdo (nueva fecha de ingreso y número de meses).</p>`,
        { title: 'Tu acuerdo finalizó', body: '¿Vas a renovar? Contacta al administrador.' },
      )
      finesDeAcuerdo++
    }
  }

  return new Response(JSON.stringify({ recordatorios, moras, finesDeAcuerdo }), { status: 200 })
})
