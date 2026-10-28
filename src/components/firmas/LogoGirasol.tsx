/**
 * MARCADOR DE POSICIÓN del logo de girasol de Sol Estudio HAB.
 * Para usar el logo real: guarda la imagen en `public/logo-girasol.png` y reemplaza el
 * contenido de este componente por `<img src="/logo-girasol.png" alt="" className={className} />`.
 */
export default function LogoGirasol({ className = 'h-9 w-9' }: { className?: string }) {
  const petalos = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {petalos.map((grados) => (
        <ellipse
          key={grados}
          cx="24"
          cy="9"
          rx="4"
          ry="8"
          fill="#D4A437"
          transform={`rotate(${grados} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="8" fill="#5b3a1a" />
    </svg>
  )
}
