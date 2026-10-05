import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import EstadoPagoBadge from '../components/EstadoPagoBadge'
import {
  TAMANO_MAXIMO_BYTES,
  TIPOS_PERMITIDOS,
  extensionDeRuta,
  extensionParaMime,
} from '../lib/archivos'
import { estadoDelMes, estadoDeposito, formatearMes, generarMesesAcuerdo } from '../lib/calendario'
import { getSupabase } from '../lib/supabase'
import type { Acuerdo, Contrato, Deposito, Huesped, Pago } from '../types/dominio'

export default function DetalleHuespedAdmin() {
  const { id } = useParams<{ id: string }>()
  const [huesped, setHuesped] = useState<Huesped | null>(null)
  const [acuerdo, setAcuerdo] = useState<Acuerdo | null>(null)
  const [historialAcuerdos, setHistorialAcuerdos] = useState<Acuerdo[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendoContrato, setSubiendoContrato] = useState(false)
  const [guardandoAcuerdo, setGuardandoAcuerdo] = useState(false)

  const [reactivandoId, setReactivandoId] = useState<string | null>(null)
  const [fechaIngresoReactivar, setFechaIngresoReactivar] = useState('')
  const [mesesAcuerdoReactivar, setMesesAcuerdoReactivar] = useState('')

  const [mostrandoNuevoAcuerdo, setMostrandoNuevoAcuerdo] = useState(false)
  const [fechaIngresoNuevo, setFechaIngresoNuevo] = useState('')
  const [mesesAcuerdoNuevo, setMesesAcuerdoNuevo] = useState('')

  const [nombres, setNombres] = useState('')
  const [numeroHabitacion, setNumeroHabitacion] = useState('')
  const [numeroWhatsapp, setNumeroWhatsapp] = useState('')
  const [activo, setActivo] = useState(true)
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [mesesAcuerdo, setMesesAcuerdo] = useState('')
  const [depositoPagoUnico, setDepositoPagoUnico] = useState(false)
  const [depositoValor, setDepositoValor] = useState('')

  const [rechazandoMes, setRechazandoMes] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [rechazandoCargue, setRechazandoCargue] = useState<1 | 2 | null>(null)
  const [motivoRechazoDeposito, setMotivoRechazoDeposito] = useState('')

  const [archivando, setArchivando] = useState(false)
  const [procesandoMes, setProcesandoMes] = useState<string | null>(null)
  const [procesandoCargue, setProcesandoCargue] = useState<1 | 2 | null>(null)
  const [moviendoMes, setMoviendoMes] = useState<string | null>(null)
  const [mesDestino, setMesDestino] = useState('')

  async function cargar() {
    if (!id) return
    const supabase = getSupabase()
    const [huespedRes, acuerdosRes] = await Promise.all([
      supabase.from('huespedes').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('acuerdos')
        .select('*')
        .eq('huesped_id', id)
        .order('creado_en', { ascending: false }),
    ])
    if (huespedRes.error) {
      setError(huespedRes.error.message)
      setCargando(false)
      return
    }
    const h = huespedRes.data as Huesped | null
    const todosLosAcuerdos = (acuerdosRes.data as Acuerdo[]) ?? []
    const a = todosLosAcuerdos.find((x) => x.estado === 'activo') ?? null
    setHuesped(h)
    setAcuerdo(a)
    setHistorialAcuerdos(todosLosAcuerdos.filter((x) => x.id !== a?.id))
    if (h) {
      setNombres(h.nombres)
      setNumeroHabitacion(h.numero_habitacion)
      setNumeroWhatsapp(h.numero_whatsapp ?? '')
      setActivo(h.activo)
      const contratosRes = await supabase
        .from('contratos')
        .select('*')
        .eq('huesped_id', h.id)
        .order('creado_en', { ascending: false })
      setContratos((contratosRes.data as Contrato[]) ?? [])
    }
    if (a) {
      setFechaIngreso(a.fecha_ingreso)
      setMesesAcuerdo(String(a.meses_acuerdo))
      setDepositoPagoUnico(a.deposito_pago_unico)
      setDepositoValor(a.deposito_valor != null ? String(a.deposito_valor) : '')
      const [pagosRes, depositosRes] = await Promise.all([
        supabase.from('pagos').select('*').eq('acuerdo_id', a.id),
        supabase.from('depositos').select('*').eq('acuerdo_id', a.id),
      ])
      setPagos((pagosRes.data as Pago[]) ?? [])
      setDepositos((depositosRes.data as Deposito[]) ?? [])
    } else {
      setPagos([])
      setDepositos([])
    }
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Recarga solo lo relacionado con acuerdos (usada por reactivar/crear
  // acuerdo). A diferencia de cargar(), NO pisa nombres/habitación/WhatsApp
  // del huésped por si el admin tiene cambios sin guardar en ese formulario.
  async function cargarAcuerdos() {
    if (!id) return
    const supabase = getSupabase()
    const acuerdosRes = await supabase
      .from('acuerdos')
      .select('*')
      .eq('huesped_id', id)
      .order('creado_en', { ascending: false })
    const todosLosAcuerdos = (acuerdosRes.data as Acuerdo[]) ?? []
    const a = todosLosAcuerdos.find((x) => x.estado === 'activo') ?? null
    setAcuerdo(a)
    setHistorialAcuerdos(todosLosAcuerdos.filter((x) => x.id !== a?.id))
    setActivo(true)
    if (a) {
      setFechaIngreso(a.fecha_ingreso)
      setMesesAcuerdo(String(a.meses_acuerdo))
      setDepositoPagoUnico(a.deposito_pago_unico)
      setDepositoValor(a.deposito_valor != null ? String(a.deposito_valor) : '')
      const [pagosRes, depositosRes] = await Promise.all([
        supabase.from('pagos').select('*').eq('acuerdo_id', a.id),
        supabase.from('depositos').select('*').eq('acuerdo_id', a.id),
      ])
      setPagos((pagosRes.data as Pago[]) ?? [])
      setDepositos((depositosRes.data as Deposito[]) ?? [])
    } else {
      setPagos([])
      setDepositos([])
    }
  }

  async function guardarHuesped() {
    if (!huesped) return
    setError(null)

    if (acuerdo) {
      const meses = Number(mesesAcuerdo)
      if (!Number.isInteger(meses) || meses <= 0) {
        setError('El número de meses del acuerdo debe ser un entero mayor a 0.')
        return
      }
      if (depositoValor.trim() && (!Number.isInteger(Number(depositoValor)) || Number(depositoValor) < 0)) {
        setError('El valor del depósito debe ser un número entero mayor o igual a 0.')
        return
      }
    }

    setGuardando(true)
    const supabase = getSupabase()
    const { error: errorHuesped } = await supabase
      .from('huespedes')
      .update({
        nombres,
        numero_habitacion: numeroHabitacion,
        numero_whatsapp: numeroWhatsapp.trim() || null,
        activo,
      })
      .eq('id', huesped.id)

    let errorAcuerdo: string | null = null
    if (acuerdo) {
      const resultado = await supabase
        .from('acuerdos')
        .update({
          fecha_ingreso: fechaIngreso,
          meses_acuerdo: Number(mesesAcuerdo),
          deposito_pago_unico: depositoPagoUnico,
          deposito_valor: depositoValor.trim() ? Number(depositoValor) : null,
        })
        .eq('id', acuerdo.id)
      errorAcuerdo = resultado.error?.message ?? null
    }

    setGuardando(false)
    if (errorHuesped || errorAcuerdo) {
      setError('No se pudieron guardar los cambios.')
      return
    }
    await cargar()
  }

  function iniciarReactivacion(acuerdoAReactivar: Acuerdo) {
    setError(null)
    setMostrandoNuevoAcuerdo(false)
    setReactivandoId(acuerdoAReactivar.id)
    setFechaIngresoReactivar(acuerdoAReactivar.fecha_ingreso)
    setMesesAcuerdoReactivar(String(acuerdoAReactivar.meses_acuerdo))
  }

  async function confirmarReactivacion(acuerdoAReactivar: Acuerdo) {
    if (!huesped) return
    setError(null)
    const meses = Number(mesesAcuerdoReactivar)
    if (!fechaIngresoReactivar) {
      setError('La fecha de ingreso es obligatoria.')
      return
    }
    if (!Number.isInteger(meses) || meses <= 0) {
      setError('El número de meses del acuerdo debe ser un entero mayor a 0.')
      return
    }

    setGuardandoAcuerdo(true)
    const supabase = getSupabase()
    const { error: errorAcuerdo } = await supabase
      .from('acuerdos')
      .update({
        estado: 'activo',
        fecha_ingreso: fechaIngresoReactivar,
        meses_acuerdo: meses,
      })
      .eq('id', acuerdoAReactivar.id)
    const { error: errorHuesped } = await supabase
      .from('huespedes')
      .update({ activo: true, archivado: false, archivado_en: null })
      .eq('id', huesped.id)

    setGuardandoAcuerdo(false)
    if (errorAcuerdo || errorHuesped) {
      setError('No se pudo reactivar el acuerdo.')
      return
    }
    setHuesped({ ...huesped, activo: true, archivado: false, archivado_en: null })
    setReactivandoId(null)
    await cargarAcuerdos()
  }

  async function crearNuevoAcuerdo() {
    if (!huesped) return
    setError(null)
    const meses = Number(mesesAcuerdoNuevo)
    if (!fechaIngresoNuevo) {
      setError('La fecha de ingreso es obligatoria.')
      return
    }
    if (!Number.isInteger(meses) || meses <= 0) {
      setError('El número de meses del acuerdo debe ser un entero mayor a 0.')
      return
    }

    setGuardandoAcuerdo(true)
    const supabase = getSupabase()
    const { error: errorInsertar } = await supabase.from('acuerdos').insert({
      huesped_id: huesped.id,
      fecha_ingreso: fechaIngresoNuevo,
      meses_acuerdo: meses,
    })
    const { error: errorHuesped } = await supabase
      .from('huespedes')
      .update({ activo: true, archivado: false, archivado_en: null })
      .eq('id', huesped.id)

    setGuardandoAcuerdo(false)
    if (errorInsertar || errorHuesped) {
      setError('No se pudo crear el nuevo acuerdo.')
      return
    }
    setHuesped({ ...huesped, activo: true, archivado: false, archivado_en: null })
    setMostrandoNuevoAcuerdo(false)
    setFechaIngresoNuevo('')
    setMesesAcuerdoNuevo('')
    await cargarAcuerdos()
  }

  async function archivarHuesped() {
    if (!huesped) return
    setError(null)
    if (
      !window.confirm(
        `¿Archivar a ${huesped.nombres}? Se finalizará su acuerdo activo, la habitación ${huesped.numero_habitacion} quedará libre y no recibirá más correos, avisos ni WhatsApp. El historial se conserva y podrás restaurarlo después.`,
      )
    ) {
      return
    }
    setArchivando(true)
    const { error: errorArchivar } = await getSupabase().rpc('archivar_huesped', {
      p_huesped_id: huesped.id,
    })
    setArchivando(false)
    if (errorArchivar) {
      setError('No se pudo archivar al huésped.')
      return
    }
    await cargar()
  }

  async function restaurarHuesped() {
    if (!huesped) return
    setError(null)
    setArchivando(true)
    const { error: errorRestaurar } = await getSupabase().rpc('restaurar_huesped', {
      p_huesped_id: huesped.id,
    })
    setArchivando(false)
    if (errorRestaurar) {
      setError('No se pudo restaurar al huésped.')
      return
    }
    await cargar()
  }

  async function verComprobante(archivoUrl: string) {
    const { data, error: errorFirma } = await getSupabase()
      .storage.from('comprobantes')
      .createSignedUrl(archivoUrl, 60)
    if (errorFirma || !data) {
      setError('No se pudo abrir el comprobante.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function verContrato(archivoUrl: string) {
    const { data, error: errorFirma } = await getSupabase()
      .storage.from('contratos')
      .createSignedUrl(archivoUrl, 60)
    if (errorFirma || !data) {
      setError('No se pudo abrir el contrato.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function subirContrato(archivo: File) {
    if (!huesped) return
    setError(null)
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      setError('Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF.')
      return
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setError('El archivo supera el tamaño máximo de 10 MB.')
      return
    }

    setSubiendoContrato(true)
    const supabase = getSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSubiendoContrato(false)
      return
    }

    const extension = extensionParaMime(archivo.type)
    const ruta = `${huesped.id}/${crypto.randomUUID()}.${extension}`

    const { error: errorSubida } = await supabase.storage
      .from('contratos')
      .upload(ruta, archivo, { contentType: archivo.type })

    if (errorSubida) {
      setError('No se pudo subir el contrato. Intenta de nuevo.')
      setSubiendoContrato(false)
      return
    }

    const { error: errorGuardar } = await supabase.from('contratos').insert({
      huesped_id: huesped.id,
      archivo_url: ruta,
      nombre_archivo: archivo.name,
      subido_por: user.id,
    })

    if (errorGuardar) setError('No se pudo registrar el contrato.')

    setSubiendoContrato(false)
    await cargar()
  }

  // Recarga solo pagos y depósitos (no pisa ediciones sin guardar del formulario).
  async function recargarPagos() {
    if (!acuerdo) return
    const supabase = getSupabase()
    const [pagosRes, depositosRes] = await Promise.all([
      supabase.from('pagos').select('*').eq('acuerdo_id', acuerdo.id),
      supabase.from('depositos').select('*').eq('acuerdo_id', acuerdo.id),
    ])
    setPagos((pagosRes.data as Pago[]) ?? [])
    setDepositos((depositosRes.data as Deposito[]) ?? [])
  }

  function archivoValido(archivo: File): boolean {
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      setError('Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF.')
      return false
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setError('El archivo supera el tamaño máximo de 10 MB.')
      return false
    }
    return true
  }

  // Carga un comprobante en nombre del huésped (p. ej. pago en efectivo).
  // Queda verificado de inmediato: el administrador es quien lo carga.
  async function subirComprobanteAdmin(mes: string, pagoExistente: Pago | undefined, archivo: File) {
    if (!huesped || !acuerdo) return
    setError(null)
    if (!archivoValido(archivo)) return
    if (
      pagoExistente?.archivo_url &&
      !window.confirm('Este mes ya tiene un comprobante. ¿Deseas reemplazarlo?')
    ) {
      return
    }

    setProcesandoMes(mes)
    const supabase = getSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setProcesandoMes(null)
      return
    }

    const ruta = `${huesped.id}/${mes}.${extensionParaMime(archivo.type)}`
    const { error: errorSubida } = await supabase.storage
      .from('comprobantes')
      .upload(ruta, archivo, { upsert: true, contentType: archivo.type })
    if (errorSubida) {
      setError('No se pudo subir el archivo. Intenta de nuevo.')
      setProcesandoMes(null)
      return
    }

    const ahora = new Date().toISOString()
    const datosPago = {
      archivo_url: ruta,
      estado: 'verificado' as const,
      fecha_carga: ahora,
      verificado_por: user.id,
      fecha_verificacion: ahora,
      observaciones: 'Cargado por el administrador.',
    }
    const { error: errorGuardar } = pagoExistente
      ? await supabase.from('pagos').update(datosPago).eq('id', pagoExistente.id)
      : await supabase.from('pagos').insert({ acuerdo_id: acuerdo.id, mes_pagado: mes, ...datosPago })

    if (errorGuardar) setError('No se pudo registrar el pago.')
    else if (pagoExistente?.archivo_url && pagoExistente.archivo_url !== ruta) {
      await supabase.storage.from('comprobantes').remove([pagoExistente.archivo_url])
    }

    setProcesandoMes(null)
    await recargarPagos()
  }

  async function eliminarPago(pago: Pago) {
    setError(null)
    const aviso = pago.estado === 'verificado' ? 'Este pago ya está verificado. ' : ''
    if (
      !window.confirm(
        `${aviso}Se eliminará el pago de ${formatearMes(pago.mes_pagado)} junto con su comprobante y el mes quedará sin pago registrado. ¿Continuar?`,
      )
    ) {
      return
    }
    setProcesandoMes(pago.mes_pagado)
    const supabase = getSupabase()
    const { data: borradas, error: errorBorrar } = await supabase
      .from('pagos')
      .delete()
      .eq('id', pago.id)
      .select('id')
    if (errorBorrar || !borradas?.length) {
      setError('No se pudo eliminar el pago.')
    } else if (pago.archivo_url) {
      await supabase.storage.from('comprobantes').remove([pago.archivo_url])
    }
    setProcesandoMes(null)
    await recargarPagos()
  }

  // Mueve un comprobante (y su estado) de un mes a otro: el mes de origen
  // queda sin pago y el mes de destino conserva el comprobante movido.
  async function moverPago(pago: Pago, destino: string) {
    if (!huesped) return
    setError(null)
    if (!destino) {
      setError('Selecciona el mes al que quieres mover el comprobante.')
      return
    }
    const pagoDestino = pagos.find((p) => p.mes_pagado === destino)
    if (pagoDestino && (pagoDestino.archivo_url || pagoDestino.estado === 'verificado')) {
      setError(`${formatearMes(destino)} ya tiene un pago registrado. Elimínalo primero para poder mover este.`)
      return
    }
    if (
      !window.confirm(
        `¿Mover el comprobante de ${formatearMes(pago.mes_pagado)} a ${formatearMes(destino)}? ${formatearMes(pago.mes_pagado)} quedará sin pago registrado.`,
      )
    ) {
      return
    }

    setProcesandoMes(pago.mes_pagado)
    const supabase = getSupabase()
    const rutaAnterior = pago.archivo_url
    const rutaNueva = rutaAnterior ? `${huesped.id}/${destino}.${extensionDeRuta(rutaAnterior)}` : null

    if (rutaAnterior && rutaNueva) {
      const { error: errorMover } = await supabase.storage
        .from('comprobantes')
        .move(rutaAnterior, rutaNueva)
      if (errorMover) {
        setError('No se pudo mover el archivo. Es posible que ya exista un archivo en el mes de destino.')
        setProcesandoMes(null)
        return
      }
    }

    if (pagoDestino) await supabase.from('pagos').delete().eq('id', pagoDestino.id)

    const { data: actualizadas, error: errorActualizar } = await supabase
      .from('pagos')
      .update({ mes_pagado: destino, archivo_url: rutaNueva })
      .eq('id', pago.id)
      .select('id')
    if (errorActualizar || !actualizadas?.length) {
      if (rutaAnterior && rutaNueva) {
        await supabase.storage.from('comprobantes').move(rutaNueva, rutaAnterior)
      }
      setError('No se pudo mover el comprobante.')
    }

    setMoviendoMes(null)
    setMesDestino('')
    setProcesandoMes(null)
    await recargarPagos()
  }

  async function subirDepositoAdmin(
    numeroCargue: 1 | 2,
    depositoExistente: Deposito | undefined,
    archivo: File,
  ) {
    if (!huesped || !acuerdo) return
    setError(null)
    if (!archivoValido(archivo)) return
    if (
      depositoExistente?.archivo_url &&
      !window.confirm(`El cargue ${numeroCargue} ya tiene un comprobante. ¿Deseas reemplazarlo?`)
    ) {
      return
    }

    setProcesandoCargue(numeroCargue)
    const supabase = getSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setProcesandoCargue(null)
      return
    }

    const ruta = `${huesped.id}/deposito-${numeroCargue}.${extensionParaMime(archivo.type)}`
    const { error: errorSubida } = await supabase.storage
      .from('comprobantes')
      .upload(ruta, archivo, { upsert: true, contentType: archivo.type })
    if (errorSubida) {
      setError('No se pudo subir el archivo. Intenta de nuevo.')
      setProcesandoCargue(null)
      return
    }

    const ahora = new Date().toISOString()
    const datosDeposito = {
      archivo_url: ruta,
      estado: 'verificado' as const,
      fecha_carga: ahora,
      verificado_por: user.id,
      fecha_verificacion: ahora,
      observaciones: 'Cargado por el administrador.',
    }
    const { error: errorGuardar } = depositoExistente
      ? await supabase.from('depositos').update(datosDeposito).eq('id', depositoExistente.id)
      : await supabase
          .from('depositos')
          .insert({ acuerdo_id: acuerdo.id, numero_cargue: numeroCargue, ...datosDeposito })

    if (errorGuardar) setError('No se pudo registrar el depósito.')
    else if (depositoExistente?.archivo_url && depositoExistente.archivo_url !== ruta) {
      await supabase.storage.from('comprobantes').remove([depositoExistente.archivo_url])
    }

    setProcesandoCargue(null)
    await recargarPagos()
  }

  async function eliminarDepositoAdmin(deposito: Deposito) {
    setError(null)
    const aviso = deposito.estado === 'verificado' ? 'Este cargue ya está verificado. ' : ''
    if (
      !window.confirm(
        `${aviso}Se eliminará el cargue ${deposito.numero_cargue} del depósito junto con su comprobante. ¿Continuar?`,
      )
    ) {
      return
    }
    setProcesandoCargue(deposito.numero_cargue)
    const supabase = getSupabase()
    const { data: borradas, error: errorBorrar } = await supabase
      .from('depositos')
      .delete()
      .eq('id', deposito.id)
      .select('id')
    if (errorBorrar || !borradas?.length) {
      setError('No se pudo eliminar el cargue del depósito.')
    } else if (deposito.archivo_url) {
      await supabase.storage.from('comprobantes').remove([deposito.archivo_url])
    }
    setProcesandoCargue(null)
    await recargarPagos()
  }

  async function verificarPago(pago: Pago) {
    setError(null)
    const {
      data: { user },
    } = await getSupabase().auth.getUser()
    if (!user) return
    const { error: errorVerificar } = await getSupabase()
      .from('pagos')
      .update({
        estado: 'verificado',
        verificado_por: user.id,
        fecha_verificacion: new Date().toISOString(),
      })
      .eq('id', pago.id)
    if (errorVerificar) setError('No se pudo verificar el pago.')
    await cargar()
  }

  async function confirmarRechazo(pago: Pago) {
    setError(null)
    const {
      data: { user },
    } = await getSupabase().auth.getUser()
    if (!user) return
    const { error: errorRechazar } = await getSupabase()
      .from('pagos')
      .update({
        estado: 'rechazado',
        verificado_por: user.id,
        fecha_verificacion: new Date().toISOString(),
        observaciones: motivoRechazo || 'Comprobante rechazado por el administrador.',
      })
      .eq('id', pago.id)
    if (errorRechazar) setError('No se pudo rechazar el pago.')
    setRechazandoMes(null)
    setMotivoRechazo('')
    await cargar()
  }

  async function verificarDeposito(deposito: Deposito) {
    setError(null)
    const {
      data: { user },
    } = await getSupabase().auth.getUser()
    if (!user) return
    const { error: errorVerificar } = await getSupabase()
      .from('depositos')
      .update({
        estado: 'verificado',
        verificado_por: user.id,
        fecha_verificacion: new Date().toISOString(),
      })
      .eq('id', deposito.id)
    if (errorVerificar) setError('No se pudo verificar el depósito.')
    await cargar()
  }

  async function confirmarRechazoDeposito(deposito: Deposito) {
    setError(null)
    const {
      data: { user },
    } = await getSupabase().auth.getUser()
    if (!user) return
    const { error: errorRechazar } = await getSupabase()
      .from('depositos')
      .update({
        estado: 'rechazado',
        verificado_por: user.id,
        fecha_verificacion: new Date().toISOString(),
        observaciones: motivoRechazoDeposito || 'Comprobante rechazado por el administrador.',
      })
      .eq('id', deposito.id)
    if (errorRechazar) setError('No se pudo rechazar el depósito.')
    setRechazandoCargue(null)
    setMotivoRechazoDeposito('')
    await cargar()
  }

  if (cargando) return <p className="mt-8 text-center text-slate-500">Cargando…</p>
  if (!huesped) return <p className="mt-8 text-center text-slate-500">Huésped no encontrado.</p>

  const meses = acuerdo ? generarMesesAcuerdo(acuerdo.fecha_ingreso, acuerdo.meses_acuerdo) : []

  return (
    <section>
      <h1 className="text-xl font-bold text-marca-900">{huesped.nombres}</h1>
      <p className="text-sm text-slate-600">{huesped.correo}</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {huesped.archivado && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-100 p-3">
          <p className="text-sm text-slate-700">
            Huésped archivado
            {huesped.archivado_en &&
              ` el ${new Date(huesped.archivado_en).toLocaleDateString('es')}`}
            . No recibe correos ni avisos y su habitación está libre.
          </p>
          <button
            type="button"
            onClick={restaurarHuesped}
            disabled={archivando}
            className="rounded-lg border border-marca-700 px-3 py-1.5 text-sm font-semibold text-marca-700 hover:bg-marca-50 disabled:opacity-60"
          >
            {archivando ? 'Restaurando…' : 'Restaurar'}
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nombres
          <input
            value={nombres}
            onChange={(e) => setNombres(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Número de habitación
          <input
            value={numeroHabitacion}
            onChange={(e) => setNumeroHabitacion(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Número de WhatsApp
          <input
            type="tel"
            value={numeroWhatsapp}
            onChange={(e) => setNumeroWhatsapp(e.target.value)}
            placeholder="Sin registrar"
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
          />
        </label>

        {acuerdo && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Fecha de ingreso (define el día de pago)
              <input
                type="date"
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Meses del acuerdo
              <input
                type="number"
                min={1}
                value={mesesAcuerdo}
                onChange={(e) => setMesesAcuerdo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
              />
            </label>
          </>
        )}

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Cuenta activa
        </label>

        <button
          type="button"
          onClick={guardarHuesped}
          disabled={guardando}
          className="rounded-lg bg-marca-700 px-4 py-2 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60 sm:col-span-2 sm:w-fit"
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {!huesped.archivado && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-white p-4">
          <div>
            <h2 className="font-semibold text-slate-900">Archivar huésped</h2>
            <p className="text-xs text-slate-500">
              Úsalo cuando el huésped se retira antes de tiempo: finaliza su acuerdo, libera la
              habitación y deja de enviarle correos, avisos y WhatsApp. El historial se conserva.
            </p>
          </div>
          <button
            type="button"
            onClick={archivarHuesped}
            disabled={archivando}
            className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {archivando ? 'Archivando…' : 'Archivar'}
          </button>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Contratos</h2>
          <label className="cursor-pointer rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800">
            {subiendoContrato ? 'Subiendo…' : 'Cargar contrato'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              disabled={subiendoContrato}
              onChange={(evento) => {
                const archivo = evento.target.files?.[0]
                evento.target.value = ''
                if (archivo) subirContrato(archivo)
              }}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Al cargar un contrato se le avisa automáticamente al huésped por correo, con el
          contrato adjunto y el reglamento de convivencia en un correo aparte. El correo incluye un
          botón para que confirme que lo leyó y lo acepta; cuando lo confirma, te llega un aviso a
          tu correo de administrador.
        </p>

        {contratos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin contratos cargados todavía.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {contratos.map((contrato) => (
              <li
                key={contrato.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{contrato.nombre_archivo}</p>
                  <p className="text-xs text-slate-500">
                    Cargado el {new Date(contrato.creado_en).toLocaleDateString('es')}
                  </p>
                  {contrato.confirmado_leido ? (
                    <p className="text-xs font-medium text-emerald-600">
                      Confirmado por el huésped el{' '}
                      {contrato.confirmado_en && new Date(contrato.confirmado_en).toLocaleDateString('es')}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600">Aún no confirmado por el huésped</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => verContrato(contrato.archivo_url)}
                  className="text-sm text-marca-700 underline"
                >
                  Ver contrato
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {acuerdo && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Depósito de garantía</h2>

          <label className="mt-2 flex flex-col gap-1 text-sm font-medium text-slate-700 sm:max-w-xs">
            Valor real del depósito (COP)
            <input
              type="number"
              min={0}
              step={1}
              value={depositoValor}
              onChange={(e) => setDepositoValor(e.target.value)}
              placeholder="Ej: 500000"
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Regístralo manualmente cuando el comprobante cargado no refleje el valor real del
            depósito (por ejemplo, si el huésped subió un pago mixto de arriendo + depósito).
          </p>

          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={depositoPagoUnico}
              onChange={(e) => setDepositoPagoUnico(e.target.checked)}
            />
            El depósito se pagó completo en el cargue 1 (ocultar el cargue 2 al huésped)
          </label>
          {(depositoPagoUnico !== acuerdo.deposito_pago_unico ||
            depositoValor !== (acuerdo.deposito_valor != null ? String(acuerdo.deposito_valor) : '')) && (
            <p className="mt-1 text-xs text-amber-600">
              Recuerda hacer clic en &quot;Guardar cambios&quot; para aplicar este cambio.
            </p>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(depositoPagoUnico ? ([1] as const) : ([1, 2] as const)).map((numeroCargue) => {
              const deposito = depositos.find((d) => d.numero_cargue === numeroCargue)
              const estado = estadoDeposito(deposito?.estado)
              return (
                <div
                  key={numeroCargue}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Cargue {numeroCargue}</p>
                    <EstadoPagoBadge estado={estado} />
                  </div>

                  {deposito?.archivo_url && (
                    <button
                      type="button"
                      onClick={() => verComprobante(deposito.archivo_url!)}
                      className="w-fit text-sm text-marca-700 underline"
                    >
                      Ver comprobante
                    </button>
                  )}

                  {deposito?.estado === 'cargado' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => verificarDeposito(deposito)}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        Verificar
                      </button>
                      {rechazandoCargue === numeroCargue ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={motivoRechazoDeposito}
                            onChange={(e) => setMotivoRechazoDeposito(e.target.value)}
                            placeholder="Motivo del rechazo"
                            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => confirmarRechazoDeposito(deposito)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Confirmar rechazo
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRechazandoCargue(numeroCargue)}
                          className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                  )}

                  {deposito?.estado === 'rechazado' && deposito.observaciones && (
                    <p className="text-xs text-red-600">Motivo: {deposito.observaciones}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-lg border border-marca-700 px-3 py-1.5 text-sm font-semibold text-marca-700 hover:bg-marca-50">
                      {procesandoCargue === numeroCargue
                        ? 'Procesando…'
                        : deposito?.archivo_url
                          ? 'Reemplazar comprobante'
                          : 'Cargar comprobante'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        disabled={procesandoCargue !== null}
                        onChange={(evento) => {
                          const archivo = evento.target.files?.[0]
                          evento.target.value = ''
                          if (archivo) subirDepositoAdmin(numeroCargue, deposito, archivo)
                        }}
                      />
                    </label>
                    {deposito && (
                      <button
                        type="button"
                        onClick={() => eliminarDepositoAdmin(deposito)}
                        disabled={procesandoCargue !== null}
                        className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {acuerdo ? (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Puedes cargar comprobantes en nombre del huésped (por ejemplo, pagos en efectivo: quedan
            verificados al cargarlos), eliminarlos o moverlos de un mes a otro.
          </p>
          {meses.map(({ mes, vencimiento }) => {
            const pago = pagos.find((p) => p.mes_pagado === mes)
            const estado = estadoDelMes(vencimiento, pago)
            return (
              <div key={mes} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{formatearMes(mes)}</p>
                    <p className="text-xs text-slate-500">
                      Vence el {vencimiento.toLocaleDateString('es')}
                    </p>
                  </div>
                  <EstadoPagoBadge estado={estado} />
                </div>

                {pago?.archivo_url && (
                  <button
                    type="button"
                    onClick={() => verComprobante(pago.archivo_url!)}
                    className="w-fit text-sm text-marca-700 underline"
                  >
                    Ver comprobante
                  </button>
                )}

                {pago?.estado === 'cargado' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => verificarPago(pago)}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Verificar
                    </button>
                    {rechazandoMes === mes ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={motivoRechazo}
                          onChange={(e) => setMotivoRechazo(e.target.value)}
                          placeholder="Motivo del rechazo"
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => confirmarRechazo(pago)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Confirmar rechazo
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRechazandoMes(mes)}
                        className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Rechazar
                      </button>
                    )}
                  </div>
                )}

                {pago?.estado === 'rechazado' && pago.observaciones && (
                  <p className="text-xs text-red-600">Motivo: {pago.observaciones}</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-lg border border-marca-700 px-3 py-1.5 text-sm font-semibold text-marca-700 hover:bg-marca-50">
                    {procesandoMes === mes
                      ? 'Procesando…'
                      : pago?.archivo_url
                        ? 'Reemplazar comprobante'
                        : 'Cargar comprobante'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      disabled={procesandoMes !== null}
                      onChange={(evento) => {
                        const archivo = evento.target.files?.[0]
                        evento.target.value = ''
                        if (archivo) subirComprobanteAdmin(mes, pago, archivo)
                      }}
                    />
                  </label>
                  {pago && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null)
                          setMesDestino('')
                          setMoviendoMes(moviendoMes === mes ? null : mes)
                        }}
                        disabled={procesandoMes !== null}
                        className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Mover a otro mes
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarPago(pago)}
                        disabled={procesandoMes !== null}
                        className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>

                {pago && moviendoMes === mes && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                    <select
                      value={mesDestino}
                      onChange={(e) => setMesDestino(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">Mover a…</option>
                      {meses
                        .filter((m) => m.mes !== mes)
                        .map((m) => {
                          const ocupado = pagos.some(
                            (p) =>
                              p.mes_pagado === m.mes && (p.archivo_url || p.estado === 'verificado'),
                          )
                          return (
                            <option key={m.mes} value={m.mes} disabled={ocupado}>
                              {formatearMes(m.mes)}
                              {ocupado ? ' (ya tiene pago)' : ''}
                            </option>
                          )
                        })}
                    </select>
                    <button
                      type="button"
                      onClick={() => moverPago(pago, mesDestino)}
                      disabled={procesandoMes !== null || !mesDestino}
                      className="rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800 disabled:opacity-60"
                    >
                      Confirmar movimiento
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoviendoMes(null)}
                      className="text-sm text-slate-600 underline"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-slate-600">Este huésped no tiene un acuerdo activo.</p>

          {historialAcuerdos.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              <h2 className="font-semibold text-slate-900">Acuerdos anteriores</h2>
              {historialAcuerdos.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-slate-700">
                      <p>
                        Desde el {new Date(`${a.fecha_ingreso}T00:00:00`).toLocaleDateString('es')}
                        {' · '}
                        {a.meses_acuerdo} {a.meses_acuerdo === 1 ? 'mes' : 'meses'}
                        {' · '}
                        <span className="capitalize">{a.estado}</span>
                      </p>
                    </div>
                    {reactivandoId !== a.id && (
                      <button
                        type="button"
                        onClick={() => iniciarReactivacion(a)}
                        className="rounded-lg border border-marca-700 px-3 py-1.5 text-sm font-semibold text-marca-700 hover:bg-marca-50"
                      >
                        Corregir y reactivar
                      </button>
                    )}
                  </div>

                  {reactivandoId === a.id && (
                    <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-500">
                        Usa esto cuando el acuerdo terminó por un dato mal ingresado (por ejemplo,
                        menos meses de los firmados). Ajusta lo que haga falta y reactívalo — es el
                        mismo acuerdo, no uno nuevo.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Fecha de ingreso
                          <input
                            type="date"
                            value={fechaIngresoReactivar}
                            onChange={(e) => setFechaIngresoReactivar(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Meses del acuerdo
                          <input
                            type="number"
                            min={1}
                            value={mesesAcuerdoReactivar}
                            onChange={(e) => setMesesAcuerdoReactivar(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => confirmarReactivacion(a)}
                          disabled={guardandoAcuerdo}
                          className="rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800 disabled:opacity-60"
                        >
                          {guardandoAcuerdo ? 'Guardando…' : 'Guardar y reactivar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReactivandoId(null)}
                          disabled={guardandoAcuerdo}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-slate-200 pt-4">
            {!mostrandoNuevoAcuerdo ? (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setReactivandoId(null)
                  setMostrandoNuevoAcuerdo(true)
                }}
                className="rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800"
              >
                Crear nuevo acuerdo
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-500">
                  Usa esto cuando el acuerdo anterior terminó correctamente y el huésped renueva —
                  se guarda como un acuerdo nuevo, sin perder el historial del anterior.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Fecha de ingreso
                    <input
                      type="date"
                      value={fechaIngresoNuevo}
                      onChange={(e) => setFechaIngresoNuevo(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Meses del acuerdo
                    <input
                      type="number"
                      min={1}
                      value={mesesAcuerdoNuevo}
                      onChange={(e) => setMesesAcuerdoNuevo(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={crearNuevoAcuerdo}
                    disabled={guardandoAcuerdo}
                    className="rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800 disabled:opacity-60"
                  >
                    {guardandoAcuerdo ? 'Creando…' : 'Crear acuerdo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrandoNuevoAcuerdo(false)}
                    disabled={guardandoAcuerdo}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
