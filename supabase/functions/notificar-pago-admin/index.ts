// Sol Estudio Hab — Edge Function: notificar-pago-admin
//
// Se dispara mediante un Database Webhook de Supabase (tabla `pagos`,
// eventos INSERT y UPDATE). Cuando un huésped carga un comprobante,
// envía un correo al/los administrador(es) con el archivo adjunto,
// el mes pagado y los datos del huésped. Registra el envío exitoso
// en la tabla `notificaciones` para trazabilidad.
//
// Variables de entorno requeridas (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY     API key de Resend (https://resend.com)
//   CORREO_REMITENTE   Correo verificado en Resend para el campo "from"
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los provee Supabase automáticamente.

import { createClient } from 'npm:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const CORREO_REMITENTE = Deno.env.get('CORREO_REMITENTE') ?? 'onboarding@resend.dev'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface PayloadWebhook {
  type: 'INSERT' | 'UPDATE'
  table: string
  record: {
    id: string
    acuerdo_id: string
    mes_pagado: string
    archivo_url: string | null
    estado: string
  }
  old_record: { estado: string } | null
}

function debeNotificar(payload: PayloadWebhook): boolean {
  if (payload.record.estado !== 'cargado') return false
  if (payload.type === 'INSERT') return true
  return payload.old_record?.estado !== 'cargado'
}

async function enviarConReintento(cuerpo: unknown, intentos = 2): Promise<boolean> {
  for (let intento = 1; intento <= intentos; intento++) {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    })
    if (respuesta.ok) return true
    console.error(`Intento ${intento} de envío falló:`, await respuesta.text())
  }
  return false
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as PayloadWebhook
    if (payload.table !== 'pagos' || !debeNotificar(payload)) {
      return new Response(JSON.stringify({ omitido: true }), { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: acuerdo } = await supabase
      .from('acuerdos')
      .select('huesped_id')
      .eq('id', payload.record.acuerdo_id)
      .single()
    if (!acuerdo) throw new Error('Acuerdo no encontrado')

    const { data: huesped } = await supabase
      .from('huespedes')
      .select('nombres, correo, numero_habitacion')
      .eq('id', acuerdo.huesped_id)
      .single()
    if (!huesped) throw new Error('Huésped no encontrado')

    const { data: admins } = await supabase.from('admins').select('correo')
    const correosAdmin = (admins ?? []).map((a: { correo: string }) => a.correo)
    if (correosAdmin.length === 0) throw new Error('No hay administradores registrados')

    let adjunto: { filename: string; content: string } | null = null
    if (payload.record.archivo_url) {
      const { data: archivo } = await supabase.storage
        .from('comprobantes')
        .download(payload.record.archivo_url)
      if (archivo) {
        const bytes = new Uint8Array(await archivo.arrayBuffer())
        let binario = ''
        for (const byte of bytes) binario += String.fromCharCode(byte)
        adjunto = {
          filename: payload.record.archivo_url.split('/').pop() ?? 'comprobante',
          content: btoa(binario),
        }
      }
    }

    const enviado = await enviarConReintento({
      from: CORREO_REMITENTE,
      to: correosAdmin,
      subject: `Nuevo comprobante de pago — Habitación ${huesped.numero_habitacion} — ${payload.record.mes_pagado}`,
      html: `
        <p>Se cargó un comprobante de pago en Sol Estudio Hab:</p>
        <ul>
          <li><strong>Huésped:</strong> ${huesped.nombres}</li>
          <li><strong>Correo:</strong> ${huesped.correo}</li>
          <li><strong>Habitación:</strong> ${huesped.numero_habitacion}</li>
          <li><strong>Mes pagado:</strong> ${payload.record.mes_pagado}</li>
        </ul>
      `,
      attachments: adjunto ? [adjunto] : undefined,
    })

    if (enviado) {
      await supabase.from('notificaciones').insert({
        huesped_id: acuerdo.huesped_id,
        tipo: 'confirmacion',
        canal: 'correo',
        mes_referencia: payload.record.mes_pagado,
      })
    } else {
      console.error('No se pudo enviar el correo al administrador tras los reintentos.')
    }

    return new Response(JSON.stringify({ enviado }), { status: 200 })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
