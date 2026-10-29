// Qué pasa cuando un contrato de firma queda con TODAS las firmas:
//  1. Se resuelve el huésped (el elegido al crear el contrato, o el que tiene un acuerdo activo
//     en esa habitación) y el contrato firmado se VINCULA a su sección "Contratos" (misma
//     fila apuntando al mismo PDF del bucket `firmas`; no se copia el archivo).
//  2. Si el huésped ya tiene su estadía (acuerdo activo) en el sistema, se envía la copia firmada
//     por correo a los firmantes, al huésped y a los administradores. Si todavía no existe, NO se
//     envía: queda pendiente hasta que el admin lo dispare desde Firmas o desde el huésped.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { asuntoAcuerdoFirmado, nombreArchivoAcuerdo, primerNombre } from './asunto.ts'
import { ultimoDiaAcuerdo } from './calendario.ts'
import { enviarCorreo } from './correo.ts'
import { plantillaAcuerdoFirmado } from './plantilla-acuerdo.ts'

export type MotivoSinEnvio = 'no_completado' | 'sin_huesped' | 'sin_acuerdo' | 'ya_enviado' | 'error_envio'

export interface ResultadoCompletar {
  vinculado: boolean
  envio: { enviado: boolean; motivo?: MotivoSinEnvio; destinatarios?: string[]; asunto?: string }
}

interface ContratoFirma {
  id: string
  titulo: string
  habitacion: string | null
  ruta_firmado: string | null
  estado: string
  huesped_id: string | null
  creado_por: string | null
  correo_enviado_en: string | null
}

interface HuespedBasico {
  id: string
  correo: string
  nombres: string
  numero_habitacion: string
}

function bufferABase64(buffer: ArrayBuffer): string {
  let binario = ''
  for (const byte of new Uint8Array(buffer)) binario += String.fromCharCode(byte)
  return btoa(binario)
}

async function resolverHuesped(
  supabase: SupabaseClient,
  contrato: ContratoFirma,
  correoEstudiante: string | null,
): Promise<HuespedBasico | null> {
  if (contrato.huesped_id) {
    const { data } = await supabase
      .from('huespedes')
      .select('id, correo, nombres, numero_habitacion')
      .eq('id', contrato.huesped_id)
      .maybeSingle()
    return (data as HuespedBasico | null) ?? null
  }

  if (!contrato.habitacion) return null
  const { data } = await supabase
    .from('acuerdos')
    .select('huespedes!inner(id, correo, nombres, numero_habitacion, archivado)')
    .eq('estado', 'activo')
    .eq('huespedes.numero_habitacion', contrato.habitacion)
    .eq('huespedes.archivado', false)
    .limit(1)
  const candidato = (data?.[0] as unknown as { huespedes: HuespedBasico } | undefined)?.huespedes ?? null
  if (!candidato) return null

  // Si el firmante estudiante dio un correo distinto al del huésped de esa habitación, no se
  // vincula solo (podría ser otra persona): el admin lo vincula a mano.
  if (correoEstudiante && correoEstudiante.toLowerCase() !== candidato.correo.toLowerCase()) return null
  return candidato
}

export async function alCompletar(
  supabase: SupabaseClient,
  contratoId: string,
  opciones: { forzarEnvio?: boolean } = {},
): Promise<ResultadoCompletar> {
  const { data: contratoData } = await supabase
    .from('firma_contratos')
    .select('id, titulo, habitacion, ruta_firmado, estado, huesped_id, creado_por, correo_enviado_en')
    .eq('id', contratoId)
    .maybeSingle()
  const contrato = contratoData as ContratoFirma | null
  if (!contrato || contrato.estado !== 'completado' || !contrato.ruta_firmado) {
    return { vinculado: false, envio: { enviado: false, motivo: 'no_completado' } }
  }

  const { data: firmantesData } = await supabase
    .from('firma_firmantes')
    .select('nombre, rol, correo')
    .eq('contrato_id', contratoId)
  const firmantes = (firmantesData ?? []) as { nombre: string; rol: string; correo: string | null }[]
  const estudiante = firmantes.find((f) => f.rol === 'estudiante') ?? null

  // ----- 1. Vincular al huésped -----
  const huesped = await resolverHuesped(supabase, contrato, estudiante?.correo ?? null)
  let vinculado = false
  if (huesped) {
    if (contrato.huesped_id !== huesped.id) {
      await supabase.from('firma_contratos').update({ huesped_id: huesped.id }).eq('id', contratoId)
    }
    const { data: existente } = await supabase
      .from('contratos')
      .select('id')
      .eq('firma_contrato_id', contratoId)
      .maybeSingle()
    if (existente) {
      vinculado = true
    } else if (contrato.creado_por) {
      const { error } = await supabase.from('contratos').insert({
        huesped_id: huesped.id,
        archivo_url: contrato.ruta_firmado,
        nombre_archivo: `${contrato.titulo}.pdf`,
        subido_por: contrato.creado_por,
        bucket: 'firmas',
        firma_contrato_id: contratoId,
      })
      vinculado = !error
      if (error) console.error('No se pudo vincular el contrato firmado:', error)
    }
  }

  // ----- 2. Enviar la copia firmada -----
  if (!huesped) return { vinculado, envio: { enviado: false, motivo: 'sin_huesped' } }

  const { data: acuerdo } = await supabase
    .from('acuerdos')
    .select('fecha_ingreso, meses_acuerdo')
    .eq('huesped_id', huesped.id)
    .eq('estado', 'activo')
    .maybeSingle()
  if (!acuerdo) return { vinculado, envio: { enviado: false, motivo: 'sin_acuerdo' } }

  if (contrato.correo_enviado_en && !opciones.forzarEnvio) {
    return { vinculado, envio: { enviado: false, motivo: 'ya_enviado' } }
  }

  const { data: admins } = await supabase.from('admins').select('correo')
  const destinatarios = [
    ...new Set(
      [
        ...firmantes.map((f) => f.correo),
        huesped.correo,
        ...((admins ?? []) as { correo: string }[]).map((a) => a.correo),
      ]
        .filter((c): c is string => Boolean(c?.trim()))
        .map((c) => c.trim().toLowerCase()),
    ),
  ]

  const { data: archivo } = await supabase.storage.from('firmas').download(contrato.ruta_firmado)
  if (!archivo) return { vinculado, envio: { enviado: false, motivo: 'error_envio' } }

  const nombres = estudiante?.nombre ?? huesped.nombres
  const habitacion = contrato.habitacion ?? huesped.numero_habitacion
  const [anio, mes, dia] = acuerdo.fecha_ingreso.split('-').map(Number)
  const inicio = new Date(anio, mes - 1, dia)
  const fin = ultimoDiaAcuerdo(acuerdo.fecha_ingreso, acuerdo.meses_acuerdo)
  const asunto = asuntoAcuerdoFirmado({ nombres, habitacion, inicio, fin })

  const enviado = await enviarCorreo({
    to: destinatarios,
    subject: asunto,
    html: plantillaAcuerdoFirmado({ habitacion, nombre: primerNombre(nombres) }),
    attachments: [{ filename: nombreArchivoAcuerdo(nombres, habitacion), content: bufferABase64(await archivo.arrayBuffer()) }],
  })

  if (!enviado) return { vinculado, envio: { enviado: false, motivo: 'error_envio', asunto } }

  await supabase.from('firma_contratos').update({ correo_enviado_en: new Date().toISOString() }).eq('id', contratoId)
  return { vinculado, envio: { enviado: true, destinatarios, asunto } }
}
