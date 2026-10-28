// pdf.js se carga solo cuando se necesita (pantalla de firma y editor de casillas), para
// no sumar su peso al resto de la app. Se usa la build "legacy" para que también funcione
// en celulares con navegadores más viejos.

let promesa: Promise<typeof import('pdfjs-dist')> | null = null

export function cargarPdfjs() {
  promesa ??= (async () => {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })()
  return promesa
}
