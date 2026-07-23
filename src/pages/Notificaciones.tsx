import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSupabase } from '../lib/supabase'
import type { Notificacion } from '../types/dominio'

const ETIQUETAS: Record<string, string> = {
  recordatorio: 'Recordatorio de pago',
  mora: 'Aviso de mora',
  confirmacion: 'Pago recibido',
  fin_acuerdo: 'Fin de acuerdo',
  aviso_basura: 'Sacar la basura',
}

export default function Notificaciones() {
  const { huesped } = useAuth()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    if (!huesped) return
    const { data } = await getSupabase()
      .from('notificaciones')
      .select('*')
      .eq('huesped_id', huesped.id)
      .eq('canal', 'app')
      .order('enviado_en', { ascending: false })
    setNotificaciones((data as Notificacion[]) ?? [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huesped?.id])

  async function marcarLeida(id: string) {
    await getSupabase().from('notificaciones').update({ leido: true }).eq('id', id)
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leido: true } : n)))
  }

  if (!huesped) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold text-marca-900">Notificaciones</h1>
        <p className="mt-3 text-slate-600">Esta cuenta no tiene notificaciones.</p>
      </section>
    )
  }

  if (cargando) return <p className="mt-8 text-center text-slate-500">Cargando…</p>

  return (
    <section>
      <h1 className="text-xl font-bold text-marca-900">Notificaciones</h1>

      {notificaciones.length === 0 && (
        <p className="mt-4 text-slate-600">No tienes notificaciones todavía.</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {notificaciones.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => !n.leido && marcarLeida(n.id)}
            className={`rounded-lg border px-4 py-3 text-left text-sm ${
              n.leido ? 'border-slate-200 bg-white' : 'border-marca-300 bg-marca-50'
            }`}
          >
            <p className="font-semibold text-slate-900">
              {ETIQUETAS[n.tipo] ?? n.tipo}
              {n.mes_referencia ? ` — ${n.mes_referencia}` : ''}
            </p>
            <p className="text-xs text-slate-500">{new Date(n.enviado_en).toLocaleString('es')}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
