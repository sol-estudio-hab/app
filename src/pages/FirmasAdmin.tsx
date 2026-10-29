import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EnlaceFirmante from '../components/firmas/EnlaceFirmante'
import PanelFirma from '../components/firmas/PanelFirma'
import {
  ETIQUETA_ESTADO_FIRMA,
  type FirmaContrato,
  type FirmaFirmante,
  ROL_ARRENDADOR,
} from '../lib/firmas'
import { invocarFuncion } from '../lib/funciones'
import { type HuespedVigente, cargarHuespedesVigentes } from '../lib/huespedesVigentes'
import { getSupabase } from '../lib/supabase'

type ContratoConFirmantes = FirmaContrato & {
  firma_firmantes: Pick<FirmaFirmante, 'id' | 'token' | 'nombre' | 'rol' | 'firmado_en'>[]
  huespedes: { nombres: string; numero_habitacion: string } | null
}

interface RespuestaCopia {
  vinculado: boolean
  envio: { enviado: boolean; destinatarios?: string[]; asunto?: string }
  mensaje: string | null
}

const CLASE_ESTADO: Record<FirmaContrato['estado'], string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  parcial: 'bg-amber-100 text-amber-800',
  completado: 'bg-green-100 text-green-800',
}

export default function FirmasAdmin() {
  const [contratos, setContratos] = useState<ContratoConFirmantes[] | null>(null)
  const [vinculados, setVinculados] = useState<Set<string>>(new Set())
  const [huespedes, setHuespedes] = useState<HuespedVigente[]>([])
  const [eleccion, setEleccion] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [modal, setModal] = useState<{ firmanteId: string; nombre: string } | null>(null)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  async function cargar() {
    const supabase = getSupabase()
    const [contratosRes, vinculosRes] = await Promise.all([
      supabase
        .from('firma_contratos')
        .select('*, firma_firmantes(id, token, nombre, rol, firmado_en), huespedes(nombres, numero_habitacion)')
        .order('creado_en', { ascending: false }),
      supabase.from('contratos').select('firma_contrato_id').not('firma_contrato_id', 'is', null),
    ])
    if (contratosRes.error) {
      setError('No se pudo cargar la lista de contratos.')
      return
    }
    setContratos((contratosRes.data as ContratoConFirmantes[]) ?? [])
    setVinculados(
      new Set(((vinculosRes.data ?? []) as { firma_contrato_id: string }[]).map((v) => v.firma_contrato_id)),
    )
  }

  useEffect(() => {
    cargar()
    cargarHuespedesVigentes().then(setHuespedes)
  }, [])

  async function abrirPdf(ruta: string) {
    setError(null)
    const { data, error: errorFirma } = await getSupabase().storage.from('firmas').createSignedUrl(ruta, 60)
    if (errorFirma || !data) {
      setError('No se pudo abrir el PDF.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function firmarArrendador(firmaPng: string) {
    if (!modal) return
    setOcupado('firma')
    setErrorModal(null)
    const { datos, error: errorFirma } = await invocarFuncion<{ ok: boolean; completado: boolean }>('firma-admin', {
      firmanteId: modal.firmanteId,
      firmaPng,
    })
    setOcupado(null)
    if (!datos?.ok) {
      setErrorModal(errorFirma ?? 'No se pudo registrar la firma.')
      return
    }
    setModal(null)
    setAviso(
      datos.completado
        ? 'Firma registrada. Con esta quedó el contrato completo: se vinculó al huésped (si ya existe) y, si su estadía está en el sistema, se envió la copia por correo.'
        : 'Firma del arrendador registrada.',
    )
    await cargar()
  }

  async function vincular(contrato: ContratoConFirmantes) {
    const huespedId = eleccion[contrato.id]
    if (!huespedId) return
    setError(null)
    setAviso(null)
    setOcupado(contrato.id)
    const { error: errorVincular } = await getSupabase()
      .from('firma_contratos')
      .update({ huesped_id: huespedId })
      .eq('id', contrato.id)
    if (errorVincular) {
      setError('No se pudo vincular al huésped.')
      setOcupado(null)
      return
    }
    if (contrato.estado === 'completado') {
      const { datos, error: errorCopia } = await invocarFuncion<RespuestaCopia>('firma-copia', {
        contratoId: contrato.id,
      })
      if (errorCopia) setError(errorCopia)
      else setAviso(datos?.envio.enviado ? 'Vinculado y copia enviada por correo.' : `Vinculado. ${datos?.mensaje ?? ''}`)
    } else {
      setAviso('Huésped vinculado. Al completarse las firmas se agregará a sus contratos.')
    }
    setOcupado(null)
    await cargar()
  }

  async function enviarCopia(contrato: ContratoConFirmantes) {
    setError(null)
    setAviso(null)
    setOcupado(contrato.id)
    const { datos, error: errorCopia } = await invocarFuncion<RespuestaCopia>('firma-copia', {
      contratoId: contrato.id,
      forzar: true,
    })
    setOcupado(null)
    if (errorCopia) {
      setError(errorCopia)
      return
    }
    setAviso(`Copia enviada a: ${datos?.envio.destinatarios?.join(', ')}.`)
    await cargar()
  }

  async function eliminar(contrato: ContratoConFirmantes) {
    const advertencia = vinculados.has(contrato.id)
      ? ' También se quitará de la sección de Contratos del huésped (es el mismo archivo).'
      : ''
    if (
      !window.confirm(
        `¿Eliminar «${contrato.titulo}»? Se borran el PDF, las firmas y los enlaces, y no se puede deshacer.${advertencia}`,
      )
    ) {
      return
    }
    setError(null)
    setOcupado(contrato.id)
    const supabase = getSupabase()
    const { data: borrados, error: errorBorrar } = await supabase
      .from('firma_contratos')
      .delete()
      .eq('id', contrato.id)
      .select('id')
    if (errorBorrar || !borrados?.length) {
      setError('No se pudo eliminar el contrato.')
    } else {
      const rutas = [contrato.ruta_original, contrato.ruta_firmado].filter((r): r is string => Boolean(r))
      await supabase.storage.from('firmas').remove(rutas)
    }
    setOcupado(null)
    await cargar()
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-marca-900">Firmas de contratos</h1>
        <Link
          to="/admin/firmas/nueva"
          className="rounded-lg bg-marca-700 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-800"
        >
          Nuevo contrato
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {aviso && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}
      {!contratos && !error && <p className="mt-6 text-slate-500">Cargando…</p>}
      {contratos?.length === 0 && <p className="mt-6 text-slate-500">Todavía no hay contratos para firmar.</p>}

      <div className="mt-4 flex flex-col gap-3">
        {contratos?.map((contrato) => {
          const completado = contrato.estado === 'completado'
          const vinculado = vinculados.has(contrato.id)
          return (
            <div key={contrato.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{contrato.titulo}</p>
                  <p className="text-xs text-slate-500">
                    {contrato.habitacion ? `Habitación ${contrato.habitacion} · ` : ''}
                    Creado el {new Date(contrato.creado_en).toLocaleDateString('es')}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CLASE_ESTADO[contrato.estado]}`}>
                  {ETIQUETA_ESTADO_FIRMA[contrato.estado]}
                </span>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 p-2 text-sm">
                {contrato.huespedes ? (
                  <p className="text-slate-700">
                    Huésped:{' '}
                    <strong>
                      H{contrato.huespedes.numero_habitacion} — {contrato.huespedes.nombres}
                    </strong>
                    {vinculado && <span className="text-green-700"> · Ya está en sus contratos (mismo archivo)</span>}
                    {!vinculado && !completado && (
                      <span className="text-slate-500"> · Se agregará a sus contratos al completarse</span>
                    )}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-600">Sin huésped vinculado</span>
                    <select
                      value={eleccion[contrato.id] ?? ''}
                      onChange={(e) => setEleccion((s) => ({ ...s, [contrato.id]: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">Elegir huésped…</option>
                      {huespedes.map((h) => (
                        <option key={h.id} value={h.id}>
                          H{h.numero_habitacion} — {h.nombres}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => vincular(contrato)}
                      disabled={!eleccion[contrato.id] || ocupado === contrato.id}
                      className="rounded-lg border border-marca-700 px-3 py-1 text-sm font-semibold text-marca-700 hover:bg-marca-50 disabled:opacity-60"
                    >
                      Vincular
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {contrato.firma_firmantes.map((f) => (
                  <div key={f.id} className="rounded-lg border border-slate-100 p-2">
                    <p className="text-sm text-slate-800">
                      {f.nombre} <span className="capitalize text-slate-500">({f.rol})</span> ·{' '}
                      {f.firmado_en ? (
                        <span className="text-green-700">Firmó el {new Date(f.firmado_en).toLocaleString('es')}</span>
                      ) : (
                        <span className="text-amber-700">Pendiente de firma</span>
                      )}
                    </p>
                    {!f.firmado_en && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {f.rol === ROL_ARRENDADOR && (
                          <button
                            type="button"
                            onClick={() => {
                              setErrorModal(null)
                              setModal({ firmanteId: f.id, nombre: f.nombre })
                            }}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
                          >
                            Cargar firma (imagen)
                          </button>
                        )}
                        <EnlaceFirmante nombre={f.nombre} token={f.token} habitacion={contrato.habitacion} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {completado && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-900">
                  {contrato.correo_enviado_en ? (
                    <p>Copia firmada enviada por correo el {new Date(contrato.correo_enviado_en).toLocaleString('es')}.</p>
                  ) : (
                    <p>
                      Copia por correo pendiente: se envía sola cuando el contrato está vinculado a un huésped con su
                      estadía en el sistema, o puedes enviarla tú.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => enviarCopia(contrato)}
                    disabled={ocupado === contrato.id}
                    className="mt-2 rounded-lg bg-green-700 px-3 py-1.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                  >
                    {ocupado === contrato.id
                      ? 'Enviando…'
                      : contrato.correo_enviado_en
                        ? 'Reenviar copia por correo'
                        : 'Enviar copia por correo'}
                  </button>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {contrato.ruta_firmado && (
                  <button
                    type="button"
                    onClick={() => abrirPdf(contrato.ruta_firmado!)}
                    className="rounded-lg bg-marca-700 px-3 py-1.5 font-semibold text-white hover:bg-marca-800"
                  >
                    {completado ? 'Descargar PDF firmado' : 'Descargar PDF (firmas hasta ahora)'}
                  </button>
                )}
                <button type="button" onClick={() => abrirPdf(contrato.ruta_original)} className="text-marca-700 underline">
                  Ver original
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(contrato)}
                  disabled={ocupado === contrato.id}
                  className="ml-auto text-red-600 underline disabled:opacity-60"
                >
                  Eliminar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <PanelFirma
          titulo={`Firma de ${modal.nombre}`}
          descripcion="Se estampará en su recuadro del PDF. Puedes dibujarla o subir una imagen (foto o escaneo)."
          recordarClave="sol-firma-arrendador"
          guardando={ocupado === 'firma'}
          error={errorModal}
          onAplicar={firmarArrendador}
          onCancelar={() => setModal(null)}
        />
      )}
    </section>
  )
}
