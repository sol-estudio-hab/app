// Sol Estudio Hab — Edge Function: notificar-contrato-huesped
//
// Se dispara mediante un Database Webhook de Supabase (tabla `contratos`,
// evento INSERT). Cuando el admin carga un contrato, le avisa al huésped
// por correo con el contrato adjunto, y en un correo APARTE (para no
// mezclar temas) el reglamento de convivencia — un documento fijo, el
// mismo para todos, que vive en contratos/reglamento/reglamento-convivencia.*
// Si el admin todavía no lo ha subido, ese segundo correo simplemente se
// omite (no es un error).
//
// Requiere los secrets: RESEND_API_KEY, CORREO_REMITENTE (ya existen).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarCorreo } from '../_shared/correo.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface PayloadWebhook {
  type: 'INSERT'
  table: string
  record: {
    id: string
    huesped_id: string
    archivo_url: string
    nombre_archivo: string
  }
}

function bufferABase64(buffer: ArrayBuffer): string {
  let binario = ''
  for (const byte of new Uint8Array(buffer)) binario += String.fromCharCode(byte)
  return btoa(binario)
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as PayloadWebhook
    if (payload.table !== 'contratos' || payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ omitido: true }), { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: huesped, error: errorHuesped } = await supabase
      .from('huespedes')
      .select('correo, nombres')
      .eq('id', payload.record.huesped_id)
      .single()
    if (errorHuesped || !huesped) throw new Error('Huésped no encontrado')

    const { data: archivoContrato, error: errorDescarga } = await supabase.storage
      .from('contratos')
      .download(payload.record.archivo_url)
    if (errorDescarga || !archivoContrato) throw new Error('No se pudo leer el contrato cargado')

    const enviadoContrato = await enviarCorreo({
      to: [huesped.correo],
      subject: 'Tu contrato de arriendo — Sol Estudio Hab',
      html: `<p>Hola ${huesped.nombres},</p>
             <p>Adjuntamos tu contrato de arriendo. Guárdalo para tus registros.</p>`,
      attachments: [
        { filename: payload.record.nombre_archivo, content: bufferABase64(await archivoContrato.arrayBuffer()) },
      ],
    })

    let enviadoReglamento = false
    const { data: archivoReglamento } = await supabase.storage
      .from('contratos')
      .download('reglamento/reglamento-convivencia.pdf')
    if (archivoReglamento) {
      enviadoReglamento = await enviarCorreo({
        to: [huesped.correo],
        subject: 'Reglamento de convivencia — Sol Estudio Hab',
        html: `<p>Hola ${huesped.nombres},</p>
               <p>Te compartimos el reglamento de convivencia de Sol Estudio Hab.</p>`,
        attachments: [
          { filename: 'Reglamento de convivencia.pdf', content: bufferABase64(await archivoReglamento.arrayBuffer()) },
        ],
      })
    }

    return new Response(JSON.stringify({ enviadoContrato, enviadoReglamento }), { status: 200 })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
