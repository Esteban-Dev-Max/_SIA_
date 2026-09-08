import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Cliente de correo (SMTP). Usa variables de entorno SMTP_HOST, SMTP_PORT,
// SMTP_SECURE, SMTP_USER, SMTP_PASS y SMTP_FROM (opcional, de dónde sale).
// Si no hay SMTP configurado no envía nada y devuelve { enviado: false } para
// que el emisor decida el respaldo (p. ej. loguear el enlace en consola en
// desarrollo). Se exporta como objeto mutable para poder espiarlo en tests.
// ---------------------------------------------------------------------------

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;

export const mailer = {
  /** Envía un correo. Devuelve { enviado } (false si no hay SMTP configurado). */
  async enviar({ para, asunto, html }) {
    if (!SMTP_HOST || !SMTP_USER) {
      console.warn(`[mailer deshabilitado] (${asunto}) -> ${para}`);
      return { enviado: false };
    }
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transport.sendMail({
      from: SMTP_FROM || `"SIA" <${SMTP_USER}>`,
      to: para,
      subject: asunto,
      html,
    });
    return { enviado: true };
  },
};