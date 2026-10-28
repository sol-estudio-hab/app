import { type ReactNode, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LogoGirasol from '../components/firmas/LogoGirasol'
import PanelFirma from '../components/firmas/PanelFirma'
import VisorPdf from '../components/firmas/VisorPdf'
import { type CampoFirma, campoARectPantalla } from '../lib/firmas'
import { invocarFuncion } from '../lib/funciones'

interface Sesion {
  yaFirmado: boolean
  titulo: string
  habitacion?: string | null
  nombre: string
  rol?: string
  campos?: CampoFirma[]
  urlPdf: string
}

type Pantalla =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'sesion'; sesion: Sesion }
  | { tipo: 'enviado'; urlPdf: string | null }

const FUENTES =
  'https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Montserrat:wght@400;500;600&display=swap'

const TITULO_FONT = { fontFamily: 'Fraunces, Georgia, serif' }

/** Pantalla pública de firma (/firmar?t=<token>): marca de Sol Estudio HAB, pensada para celular. */
export default function Firmar() {
  const [parametros] = useSearchParams()
  const token = parametros.get('t')

  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: 'cargando' })
  const [firma, setFirma] = useState<string | null>(null)
  const [dibujando, setDibujando] = useState(false)
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Firma de documento — Sol Estudio HAB'
    if (!document.querySelector('link[data-fuentes-firma]')) {
      const enlace = document.createElement('link')
      enlace.rel = 'stylesheet'
      enlace.href = FUENTES
      enlace.dataset.fuentesFirma = 'true'
      document.head.appendChild(enlace)
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setPantalla({ tipo: 'error', mensaje: 'Enlace inválido o vencido' })
      return
    }
    let cancelado = false
    invocarFuncion<Sesion>('firma-sesion', { token }).then(({ datos, error }) => {
      if (cancelado) return
      setPantalla(
        datos ? { tipo: 'sesion', sesion: datos } : { tipo: 'error', mensaje: error ?? 'Enlace inválido o vencido' },
      )
    })
    return () => {
      cancelado = true
    }
  }, [token])

  async function enviar() {
    if (!token || !firma || !acepto) return
    setEnviando(true)
    setErrorEnvio(null)
    const { datos, error } = await invocarFuncion<{ ok: boolean; urlPdf: string | null }>('firma-enviar', {
      token,
      firmaPng: firma,
      acepto: true,
    })
    setEnviando(false)
    if (!datos?.ok) {
      setErrorEnvio(error ?? 'No se pudo enviar tu firma. Intenta de nuevo.')
      return
    }
    setPantalla({ tipo: 'enviado', urlPdf: datos.urlPdf })
  }

  return (
    <div
      className="min-h-dvh bg-[#FAF3EB] text-[#1f2a25]"
      style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}
    >
      <header className="bg-[#055741] text-white shadow">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <LogoGirasol />
          <span className="text-xl font-bold" style={TITULO_FONT}>
            Sol Estudio HAB
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-48">
        {pantalla.tipo === 'cargando' && <p className="py-16 text-center text-slate-600">Cargando…</p>}

        {pantalla.tipo === 'error' && (
          <Mensaje titulo={pantalla.mensaje}>
            Verifica que abriste el enlace completo que te enviamos o pídele uno nuevo al administrador.
          </Mensaje>
        )}

        {pantalla.tipo === 'enviado' && (
          <Mensaje titulo="¡Listo! Tu firma quedó registrada.">
            Gracias, ya puedes cerrar esta página.
            {pantalla.urlPdf && <Descarga url={pantalla.urlPdf} />}
          </Mensaje>
        )}

        {pantalla.tipo === 'sesion' && pantalla.sesion.yaFirmado && (
          <Mensaje titulo="Este documento ya fue firmado">
            {pantalla.sesion.nombre}, tu firma en «{pantalla.sesion.titulo}» ya está registrada.
            <Descarga url={pantalla.sesion.urlPdf} />
          </Mensaje>
        )}

        {pantalla.tipo === 'sesion' && !pantalla.sesion.yaFirmado && (
          <>
            <h1 className="text-2xl font-bold text-[#055741]" style={TITULO_FONT}>
              {pantalla.sesion.titulo}
            </h1>
            <p className="mt-1 text-base">
              Firmante: <strong>{pantalla.sesion.nombre}</strong>
              {pantalla.sesion.rol && <span className="capitalize"> ({pantalla.sesion.rol})</span>}
            </p>
            <p className="mb-4 mt-2 rounded-lg bg-white p-3 text-sm text-slate-700 shadow-sm">
              Desplázate para leer el acuerdo. Cuando termines, toca el recuadro dorado para firmar.
            </p>

            <VisorPdf
              url={pantalla.sesion.urlPdf}
              renderCapa={({ numero, escala, altoPts }) =>
                (pantalla.sesion.campos ?? [])
                  .filter((campo) => campo.pagina === numero)
                  .map((campo, i) => {
                    const r = campoARectPantalla(campo, escala, altoPts)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setDibujando(true)}
                        aria-label="Tocar para firmar"
                        className="absolute flex items-center justify-center overflow-hidden rounded border-2 border-dashed border-[#D4A437] bg-[#D4A437]/25 text-xs font-semibold text-[#7a5a0c]"
                        style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                      >
                        {firma ? (
                          <img src={firma} alt="Tu firma" className="h-full w-full object-contain" />
                        ) : (
                          'Firma aquí'
                        )}
                      </button>
                    )
                  })
              }
            />
          </>
        )}
      </main>

      {pantalla.tipo === 'sesion' && !pantalla.sesion.yaFirmado && (
        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D4A437]/40 bg-[#FAF3EB] shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={acepto}
                onChange={(e) => setAcepto(e.target.checked)}
                className="mt-0.5 h-6 w-6 shrink-0 accent-[#055741]"
              />
              <span>He leído el acuerdo y acepto firmarlo</span>
            </label>

            {errorEnvio && <p className="text-sm font-medium text-red-700">{errorEnvio}</p>}

            {firma ? (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDibujando(true)}
                  className="rounded-xl border border-[#055741] px-3 py-3.5 text-base font-semibold text-[#055741]"
                >
                  Cambiar firma
                </button>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={!acepto || enviando}
                  className="col-span-2 rounded-xl bg-[#055741] px-3 py-3.5 text-base font-semibold text-white disabled:opacity-40"
                >
                  {enviando ? 'Enviando…' : 'Enviar firma'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDibujando(true)}
                className="rounded-xl bg-[#D4A437] px-3 py-3.5 text-base font-bold text-[#3b2a05]"
              >
                Firmar
              </button>
            )}
          </div>
        </footer>
      )}

      {dibujando && (
        <PanelFirma
          onCancelar={() => setDibujando(false)}
          onAplicar={(png) => {
            setFirma(png)
            setDibujando(false)
          }}
        />
      )}
    </div>
  )
}

function Mensaje({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 text-center shadow">
      <h1 className="text-2xl font-bold text-[#055741]" style={TITULO_FONT}>
        {titulo}
      </h1>
      <div className="mt-3 text-base text-slate-700">{children}</div>
    </section>
  )
}

function Descarga({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 block rounded-xl bg-[#055741] px-4 py-3.5 text-base font-semibold text-white"
    >
      Descargar mi copia
    </a>
  )
}
