import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EstadoPagoBadge from '../components/EstadoPagoBadge'
import { TAMANO_MAXIMO_BYTES } from '../lib/archivos'
import { estadoDelMes, generarMesesAcuerdo, type EstadoMes } from '../lib/calendario'
import { getSupabase } from '../lib/supabase'
import type { Acuerdo, Huesped, Pago } from '../types/dominio'

const RUTA_REGLAMENTO = 'reglamento/reglamento-convivencia.pdf'

interface FilaHuesped {
  huesped: Huesped
  estadoMesActual: EstadoMes | null
}

function mesActualComoTexto(hoy: Date): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

export default function PanelAdmin() {
  const [filas, setFilas] = useState<FilaHuesped[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subiendoReglamento, setSubiendoReglamento] = useState(false)
  const [mensajeReglamento, setMensajeReglamento] = useState<string | null>(null)

  async function subirReglamento(archivo: File) {
    setMensajeReglamento(null)
    if (archivo.type !== 'application/pdf') {
      setMensajeReglamento('El reglamento debe ser un archivo PDF.')
      return
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setMensajeReglamento('El archivo supera el tamaño máximo de 10 MB.')
      return
    }
    setSubiendoReglamento(true)
    const { error: errorSubida } = await getSupabase()
      .storage.from('contratos')
      .upload(RUTA_REGLAMENTO, archivo, { upsert: true, contentType: 'application/pdf' })
    setSubiendoReglamento(false)
    setMensajeReglamento(
      errorSubida ? 'No se pudo subir el reglamento. Intenta de nuevo.' : 'Reglamento actualizado.',
    )
  }

  useEffect(() => {
    async function cargar() {
      const supabase = getSupabase()
      const [huespedesRes, acuerdosRes] = await Promise.all([
        supabase.from('huespedes').select('*').order('numero_habitacion'),
        supabase.from('acuerdos').select('*').eq('estado', 'activo'),
      ])
      if (huespedesRes.error) {
        setError(huespedesRes.error.message)
        return
      }
      const huespedes = (huespedesRes.data as Huesped[]) ?? []
      const acuerdos = (acuerdosRes.data as Acuerdo[]) ?? []
      const acuerdoPorHuesped = new Map(acuerdos.map((a) => [a.huesped_id, a]))
      const idsAcuerdos = acuerdos.map((a) => a.id)

      const pagosRes = idsAcuerdos.length
        ? await supabase.from('pagos').select('*').in('acuerdo_id', idsAcuerdos)
        : { data: [] as Pago[] }
      const pagos = (pagosRes.data as Pago[]) ?? []

      const hoy = new Date()
      const mesActual = mesActualComoTexto(hoy)

      const filasCalculadas = huespedes.map((huesped) => {
        const acuerdo = acuerdoPorHuesped.get(huesped.id)
        if (!acuerdo) return { huesped, estadoMesActual: null }
        const meses = generarMesesAcuerdo(acuerdo.fecha_ingreso, acuerdo.meses_acuerdo)
        const mesInfo = meses.find((m) => m.mes === mesActual)
        if (!mesInfo) return { huesped, estadoMesActual: null }
        const pago = pagos.find((p) => p.acuerdo_id === acuerdo.id && p.mes_pagado === mesActual)
        return { huesped, estadoMesActual: estadoDelMes(mesInfo.vencimiento, pago) }
      })

      setFilas(filasCalculadas)
    }
    cargar()
  }, [])

  return (
    <section>
      <h1 className="text-xl font-bold text-marca-900">Panel administrador</h1>
      <p className="mt-1 text-sm text-slate-600">Estado de pago del mes actual por huésped.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="font-semibold text-slate-900">Reglamento de convivencia</h2>
          <p className="text-xs text-slate-500">
            Documento único que se envía junto con cada contrato que se cargue a un huésped.
          </p>
          {mensajeReglamento && <p className="mt-1 text-xs text-slate-600">{mensajeReglamento}</p>}
        </div>
        <label className="cursor-pointer rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800">
          {subiendoReglamento ? 'Subiendo…' : 'Cargar / reemplazar'}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={subiendoReglamento}
            onChange={(evento) => {
              const archivo = evento.target.files?.[0]
              evento.target.value = ''
              if (archivo) subirReglamento(archivo)
            }}
          />
        </label>
      </div>

      {filas && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Habitación</th>
                <th className="px-4 py-2">Nombres</th>
                <th className="px-4 py-2">Correo</th>
                <th className="px-4 py-2">Cuenta</th>
                <th className="px-4 py-2">Mes actual</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filas.map(({ huesped, estadoMesActual }) => (
                <tr key={huesped.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{huesped.numero_habitacion}</td>
                  <td className="px-4 py-2">{huesped.nombres}</td>
                  <td className="px-4 py-2">{huesped.correo}</td>
                  <td className="px-4 py-2">{huesped.activo ? 'Activa' : 'Inactiva'}</td>
                  <td className="px-4 py-2">
                    {estadoMesActual ? <EstadoPagoBadge estado={estadoMesActual} /> : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/admin/huespedes/${huesped.id}`}
                      className="text-marca-700 underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
