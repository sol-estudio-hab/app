// Helper compartido para enviar mensajes de WhatsApp vía la Cloud API de
// Meta (WhatsApp Business Platform). A diferencia del correo, WhatsApp
// exige que el mensaje sea una PLANTILLA previamente aprobada por Meta —
// no se puede mandar texto libre a un huésped que no te haya escrito
// primero. El nombre en `template` debe coincidir exactamente con el
// nombre de la plantilla aprobada en Meta Business Manager.
//
// Requiere los secrets: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID.

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')!
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!

interface EnvioWhatsapp {
  /** Número tal como lo guardó el huésped (con o sin indicativo de país). */
  to: string
  /** Nombre exacto de la plantilla aprobada en Meta Business Manager. */
  template: string
  languageCode?: string
  /** Valores para las variables {{1}}, {{2}}, ... del cuerpo de la plantilla. */
  parametros?: string[]
}

/**
 * Normaliza un número de WhatsApp al formato que espera la Cloud API
 * (indicativo de país + número, sin espacios/guiones/"+"). Si el huésped
 * no incluyó el indicativo (los celulares colombianos tienen 10 dígitos
 * sin él), se le agrega el de Colombia (57) para que el envío no falle.
 */
export function normalizarNumeroWhatsapp(numero: string): string {
  const soloDigitos = numero.replace(/\D/g, '')
  return soloDigitos.length === 10 ? `57${soloDigitos}` : soloDigitos
}

export async function enviarWhatsapp(envio: EnvioWhatsapp, intentos = 2): Promise<boolean> {
  const body = {
    messaging_product: 'whatsapp',
    to: normalizarNumeroWhatsapp(envio.to),
    type: 'template',
    template: {
      name: envio.template,
      language: { code: envio.languageCode ?? 'es' },
      ...(envio.parametros?.length
        ? {
            components: [
              {
                type: 'body',
                parameters: envio.parametros.map((texto) => ({ type: 'text', text: texto })),
              },
            ],
          }
        : {}),
    },
  }

  for (let intento = 1; intento <= intentos; intento++) {
    const respuesta = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    if (respuesta.ok) return true
    console.error(`Intento ${intento} de envío de WhatsApp falló:`, await respuesta.text())
  }
  return false
}
