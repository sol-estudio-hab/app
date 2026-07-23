import { useEffect, useState } from 'react'
import EstadoPagoBadge from '../components/EstadoPagoBadge'
import { ETIQUETA_ESTADO_MES, estadoDelMes, generarMesesAcuerdo, type EstadoMes } from '../lib/calendario'
import { exportarCsv } from '../lib/csv'
import { getSupabase } from '../lib/supabase'
import type { Acuerdo, Huesped, Pago } from '../types/dominio'

interface Fila {
  huesped: Huesped
  acuerdo: Acuerdo
  estadoMes: EstadoMes | null
  mesesVerificados: number
}

function mesActual(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

const ETIQUETAS_RESUMEN: { clave: EstadoMes; etiqueta: string; clase: string }[] = [
  { clave: 'verificado', etiqueta: 'Pagados', clase: 'bg-green-50 text-green-800' },
  { clave: 'en_revision', etiqueta: 'En revisión', clase: 'bg-amber-50 text-amber-800' },
  { clave: 'rechazado', etiqueta: 'Rechazados', clase: 'bg-red-50 text-red-800' },
  { clave: 'pendiente', etiqueta: 'Pendientes', clase: 'bg-slate-50 text-slate-700' },
  { clave: 'vencido', etiqueta: 'Vencidos', clase: 'bg-red-50 text-red-800' },
]

export default function Reportes() {
  const [mes, setMes] = useState(mesActual())
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      setFilas(null)
      setError(null)
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

      const filasCalculadas: Fila[] = []
      for (const huesped of huespedes) {
        const acuerdo = acuerdoPorHuesped.get(huesped.id)
        if (!acuerdo) continue
        const meses = generarMesesAcuerdo(acuerdo.fecha_ingreso, acuerdo.meses_acuerdo)
        const mesInfo = meses.find((m) => m.mes === mes)
        const pagoMes = mesInfo
          ? pagos.find((p) => p.acuerdo_id === acuerdo.id && p.mes_pagado === mes)
          : undefined
        const estadoMes = mesInfo ? estadoDelMes(mesInfo.vencimiento, pagoMes) : null
        const mesesVerificados = pagos.filter(
          (p) => p.acuerdo_id === acuerdo.id && p.estado === 'verificado',
        ).length
        filasCalculadas.push({ huesped, acuerdo, estadoMes, mesesVerificados })
      }
      setFilas(filasCalculadas)
    }
    cargar()
  }, [mes])

  const resumen = filas
    ? ETIQUETAS_RESUMEN.map(({ clave, etiqueta, clase }) => ({
        etiqueta,
        clase,
        valor: filas.filter((f) => f.estadoMes === clave).length,
      }))
    : null

  function exportar() {
    if (!filas) return
    exportarCsv(
      `reporte-${mes}.csv`,
      ['Habitación', 'Nombres', 'Correo', 'Estado del mes', 'Meses pagados', 'Meses del acuerdo'],
      filas.map((f) => [
        f.huesped.numero_habitacion,
        f.huesped.nombres,
        f.huesped.correo,
        f.estadoMes ? ETIQUETA_ESTADO_MES[f.estadoMes] : 'sin acuerdo ese mes',
        String(f.mesesVerificados),
        String(f.acuerdo.meses_acuerdo),
      ]),
    )
  }

  return (
    <section>
      <h1 className="text-xl font-bold text-marca-900">Reportes</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Mes
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
          />
        </label>
        <button
          type="button"
          onClick={exportar}
          disabled={!filas}
          className="rounded-lg bg-marca-700 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-800 disabled:opacity-60"
        >
          Descargar CSV
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {resumen && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {resumen.map(({ etiqueta, valor, clase }) => (
            <div key={etiqueta} className={`rounded-lg p-4 text-center ${clase}`}>
              <p className="text-2xl font-bold">{valor}</p>
              <p className="text-xs">{etiqueta}</p>
            </div>
          ))}
        </div>
      )}

      {filas && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Habitación</th>
                <th className="px-4 py-2">Nombres</th>
                <th className="px-4 py-2">Estado del mes</th>
                <th className="px-4 py-2">Avance del acuerdo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.huesped.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{f.huesped.numero_habitacion}</td>
                  <td className="px-4 py-2">{f.huesped.nombres}</td>
                  <td className="px-4 py-2">
                    {f.estadoMes ? <EstadoPagoBadge estado={f.estadoMes} /> : '—'}
                  </td>
                  <td className="px-4 py-2">
                    {f.mesesVerificados} de {f.acuerdo.meses_acuerdo}
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
