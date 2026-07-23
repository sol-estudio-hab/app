// Helper compartido para enviar correos vía Resend con reintento.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const CORREO_REMITENTE = Deno.env.get('CORREO_REMITENTE') ?? 'onboarding@resend.dev'

interface EnvioCorreo {
  to: string[]
  subject: string
  html: string
  attachments?: { filename: string; content: string }[]
}

export async function enviarCorreo(envio: EnvioCorreo, intentos = 2): Promise<boolean> {
  for (let intento = 1; intento <= intentos; intento++) {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: CORREO_REMITENTE, ...envio }),
    })
    if (respuesta.ok) return true
    console.error(`Intento ${intento} de envío de correo falló:`, await respuesta.text())
  }
  return false
}
