import { type ChangeEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import CapaCampos, { type CampoEditable } from '../components/firmas/CapaCampos'
import EnlaceFirmante from '../components/firmas/EnlaceFirmante'
import VisorPdf from '../components/firmas/VisorPdf'
import { TAMANO_MAXIMO_BYTES } from '../lib/archivos'
import { HABITACIONES } from '../lib/habitaciones'
import { getSupabase } from '../lib/supabase'

interface FirmanteForm {
  id: string
  nombre: string
  rol: string
  telefono: string
  correo: string
}

interface Creado {
  habitacion: string | null
  firmantes: { id: string; nombre: string; rol: string; token: string }[]
}

const COLORES = ['#055741', '#b45309', '#1d4ed8', '#9333ea', '#be123c', '#0e7490']
const CLASE_INPUT =
  'rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600'

function nuevoFirmante(rol: string): FirmanteForm {
  return { id: crypto.randomUUID(), nombre: '', rol, telefono: '', correo: '' }
}

export default function NuevaFirmaAdmin() {
  const [titulo, setTitulo] = useState('')
  const [habitacion, setHabitacion] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [datosPdf, setDatosPdf] = useState<ArrayBuffer | null>(null)
  const [firmantes, setFirmantes] = useState<FirmanteForm[]>(() => [
    nuevoFirmante('responsable'),
    nuevoFirmante('estudiante'),
  ])
  const [campos, setCampos] = useState<CampoEditable[]>([])
  const [activoId, setActivoId] = useState<string | null>(null)
  const [dibujar, setDibujar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [creado, setCreado] = useState<Creado | null>(null)

  const firmantesEditor = firmantes.map((f, i) => ({
    id: f.id,
    nombre: f.nombre || `Firmante ${i + 1}`,
    color: COLORES[i % COLORES.length],
  }))
  const idActivo = activoId ?? firmantes[0]?.id ?? null

  async function alElegirArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0]
    evento.target.value = ''
    if (!elegido) return
    setError(null)
    if (elegido.type !== 'application/pdf') {
      setError('El archivo debe ser un PDF.')
      return
    }
    if (elegido.size > TAMANO_MAXIMO_BYTES) {
      setError('El PDF supera el tamaño máximo de 10 MB.')
      return
    }
    setArchivo(elegido)
    setDatosPdf(await elegido.arrayBuffer())
    setCampos([])
  }

  function actualizarFirmante(id: string, cambios: Partial<FirmanteForm>) {
    setFirmantes((lista) => lista.map((f) => (f.id === id ? { ...f, ...cambios } : f)))
  }

  function quitarFirmante(id: string) {
    setFirmantes((lista) => lista.filter((f) => f.id !== id))
    setCampos((lista) => lista.filter((c) => c.firmanteId !== id))
    if (activoId === id) setActivoId(null)
  }

  async function crear() {
    setError(null)
    if (!titulo.trim()) return setError('El título es obligatorio.')
    if (!archivo) return setError('Sube el PDF del contrato.')
    if (firmantes.length === 0) return setError('Agrega al menos un firmante.')
    if (firmantes.some((f) => !f.nombre.trim())) return setError('Todos los firmantes necesitan un nombre.')
    const sinCasilla = firmantes.find((f) => !campos.some((c) => c.firmanteId === f.id))
    if (sinCasilla) {
      return setError(`Dibuja al menos una casilla de firma para ${sinCasilla.nombre.trim()}.`)
    }

    setGuardando(true)
    const supabase = getSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setGuardando(false)
      return setError('Tu sesión venció. Vuelve a iniciar sesión.')
    }

    const contratoId = crypto.randomUUID()
    const rutaOriginal = `original/${contratoId}.pdf`

    const { error: errorSubida } = await supabase.storage
      .from('firmas')
      .upload(rutaOriginal, archivo, { contentType: 'application/pdf' })
    if (errorSubida) {
      setGuardando(false)
      return setError('No se pudo subir el PDF. Intenta de nuevo.')
    }

    const deshacer = async () => {
      await supabase.from('firma_contratos').delete().eq('id', contratoId)
      await supabase.storage.from('firmas').remove([rutaOriginal])
    }

    const { error: errorContrato } = await supabase.from('firma_contratos').insert({
      id: contratoId,
      titulo: titulo.trim(),
      habitacion: habitacion || null,
      ruta_original: rutaOriginal,
      creado_por: user.id,
    })
    if (errorContrato) {
      await deshacer()
      setGuardando(false)
      return setError('No se pudo crear el contrato.')
    }

    const { data: firmantesCreados, error: errorFirmantes } = await supabase
      .from('firma_firmantes')
      .insert(
        firmantes.map((f) => ({
          id: f.id,
          contrato_id: contratoId,
          nombre: f.nombre.trim(),
          rol: f.rol,
          telefono: f.telefono.trim() || null,
          correo: f.correo.trim() || null,
        })),
      )
      .select('id, nombre, rol, token')

    const { error: errorCampos } = errorFirmantes
      ? { error: errorFirmantes }
      : await supabase.from('firma_campos').insert(
          campos.map((c) => ({
            firmante_id: c.firmanteId,
            pagina: c.pagina,
            x: c.x,
            y: c.y,
            ancho: c.ancho,
            alto: c.alto,
          })),
        )

    if (errorFirmantes || errorCampos || !firmantesCreados) {
      await deshacer()
      setGuardando(false)
      return setError('No se pudieron guardar los firmantes y las casillas.')
    }

    setGuardando(false)
    const orden = new Map(firmantes.map((f, i) => [f.id, i]))
    setCreado({
      habitacion: habitacion || null,
      firmantes: [...firmantesCreados].sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0)),
    })
  }

  if (creado) {
    return (
      <section>
        <h1 className="text-xl font-bold text-marca-900">Contrato listo para firmar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Envía a cada firmante su propio enlace. Cada enlace solo sirve para su firma.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {creado.firmantes.map((f) => (
            <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="font-semibold text-slate-900">
                {f.nombre} <span className="text-sm font-normal capitalize text-slate-500">({f.rol})</span>
              </p>
              <div className="mt-2">
                <EnlaceFirmante nombre={f.nombre} token={f.token} habitacion={creado.habitacion} />
              </div>
            </div>
          ))}
        </div>
        <Link to="/admin/firmas" className="mt-6 inline-block text-marca-700 underline">
          Ver la lista de contratos
        </Link>
      </section>
    )
  }

  return (
    <section>
      <h1 className="text-xl font-bold text-marca-900">Nuevo contrato para firmar</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sube el PDF, agrega a los firmantes y dibuja en el documento dónde firma cada uno.
      </p>

      <div className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Título
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Acuerdo de arrendamiento Habitación 105"
            className={CLASE_INPUT}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Habitación (opcional)
          <select value={habitacion} onChange={(e) => setHabitacion(e.target.value)} className={CLASE_INPUT}>
            <option value="">Sin habitación</option>
            {HABITACIONES.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          PDF del contrato (máx. 10 MB)
          <input type="file" accept="application/pdf" onChange={alElegirArchivo} className="text-sm font-normal" />
          {archivo && <span className="text-xs font-normal text-slate-500">{archivo.name}</span>}
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Firmantes</h2>
          <button
            type="button"
            onClick={() => setFirmantes((l) => [...l, nuevoFirmante('responsable')])}
            className="text-sm text-marca-700 underline"
          >
            + Agregar firmante
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {firmantes.map((f, i) => (
            <div key={f.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
                <span style={{ color: COLORES[i % COLORES.length] }}>● Nombre</span>
                <input
                  value={f.nombre}
                  onChange={(e) => actualizarFirmante(f.id, { nombre: e.target.value })}
                  className={CLASE_INPUT}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Rol
                <select
                  value={f.rol}
                  onChange={(e) => actualizarFirmante(f.id, { rol: e.target.value })}
                  className={CLASE_INPUT}
                >
                  <option value="responsable">Responsable</option>
                  <option value="estudiante">Estudiante</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                WhatsApp (opcional)
                <input
                  type="tel"
                  value={f.telefono}
                  onChange={(e) => actualizarFirmante(f.id, { telefono: e.target.value })}
                  className={CLASE_INPUT}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-3">
                Correo (opcional)
                <input
                  type="email"
                  value={f.correo}
                  onChange={(e) => actualizarFirmante(f.id, { correo: e.target.value })}
                  className={CLASE_INPUT}
                />
              </label>
              {firmantes.length > 1 && (
                <button
                  type="button"
                  onClick={() => quitarFirmante(f.id)}
                  className="self-end text-sm text-red-600 underline"
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {datosPdf && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Casillas de firma</h2>
          <p className="mt-1 text-xs text-slate-500">
            Elige el firmante y arrastra sobre la página para dibujar su casilla. Toca la × de una casilla
            para quitarla. Cada firmante necesita al menos una.
          </p>

          <div className="sticky top-0 z-10 -mx-4 mt-3 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
            {firmantesEditor.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActivoId(f.id)}
                className="rounded-full border-2 px-3 py-1 text-sm font-semibold"
                style={{
                  borderColor: f.color,
                  color: idActivo === f.id ? '#fff' : f.color,
                  backgroundColor: idActivo === f.id ? f.color : 'transparent',
                }}
              >
                {f.nombre}
                <span className="ml-1 text-xs font-normal">
                  ({campos.filter((c) => c.firmanteId === f.id).length})
                </span>
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={dibujar} onChange={(e) => setDibujar(e.target.checked)} />
              Modo dibujo (desactívalo para desplazarte con el dedo)
            </label>
          </div>

          <div className="mt-3">
            <VisorPdf
              datos={datosPdf}
              renderCapa={(info) => (
                <CapaCampos
                  info={info}
                  campos={campos}
                  firmantes={firmantesEditor}
                  activoId={idActivo}
                  dibujar={dibujar}
                  onAgregar={(pagina, campo) =>
                    idActivo &&
                    setCampos((l) => [...l, { id: crypto.randomUUID(), firmanteId: idActivo, pagina, ...campo }])
                  }
                  onQuitar={(id) => setCampos((l) => l.filter((c) => c.id !== id))}
                />
              )}
            />
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={crear}
        disabled={guardando}
        className="mt-4 rounded-lg bg-marca-700 px-5 py-3 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60"
      >
        {guardando ? 'Creando…' : 'Crear y generar enlaces'}
      </button>
    </section>
  )
}
