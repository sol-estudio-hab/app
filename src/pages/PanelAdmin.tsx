import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EstadoPagoBadge from '../components/EstadoPagoBadge'
import { estadoDelMes, generarMesesAcuerdo, type EstadoMes } from '../lib/calendario'
import { getSupabase } from '../lib/supabase'
import type { Acuerdo, Huesped, Pago } from '../types/dominio'

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
