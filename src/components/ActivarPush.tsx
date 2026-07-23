import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { activarNotificacionesPush, pushSoportado, tieneSuscripcionPush } from '../lib/push'

/**
 * Sin UI a propósito: activa las notificaciones push en segundo plano para
 * cualquier huésped con acuerdo vigente, sin pedirle que haga nada. El único
 * diálogo que puede ver es el permiso nativo del navegador (no se puede
 * evitar por diseño de los navegadores) — no hay botón ni aviso propio.
 * Si el huésped ya decidió (aceptó o rechazó) antes, no se le vuelve a
 * preguntar. Cuando el acuerdo deja de estar vigente, simplemente se deja
 * de intentar (los cron ya filtran por huésped activo de todas formas).
 */
export default function ActivarPush() {
  const { huesped, acuerdoActivo } = useAuth()
  const yaIntentado = useRef(false)

  useEffect(() => {
    if (!huesped || !acuerdoActivo) return
    if (!pushSoportado()) return
    if (yaIntentado.current) return
    yaIntentado.current = true

    tieneSuscripcionPush().then((yaSuscrito) => {
      if (!yaSuscrito) void activarNotificacionesPush(huesped.id)
    })
  }, [huesped, acuerdoActivo])

  return null
}
