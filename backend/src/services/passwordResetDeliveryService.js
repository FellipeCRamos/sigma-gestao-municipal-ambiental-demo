const nodemailer = require('nodemailer');
const {
  IS_PRODUCTION,
  PASSWORD_RESET_DELIVERY,
  PASSWORD_RESET_EXPIRES_MINUTES,
} = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTransporter() {
  if (transporter) return transporter;

  const { smtp } = PASSWORD_RESET_DELIVERY;

  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user
      ? {
          user: smtp.user,
          pass: smtp.password,
        }
      : undefined,
    tls: {
      rejectUnauthorized: smtp.rejectUnauthorized,
    },
  });

  return transporter;
}

function buildResetUrl(tipo, token) {
  const url = new URL(PASSWORD_RESET_DELIVERY.appPublicUrl);
  url.searchParams.set('view', tipo === 'interno' ? 'admin' : 'portal');
  url.searchParams.set('reset_token', token);
  return url.toString();
}

function buildMessage({ tipo, email, token }) {
  const resetUrl = buildResetUrl(tipo, token);
  const areaLabel = tipo === 'interno' ? 'area interna SMAD' : 'portal do tutor';
  const subject = `Recuperacao de senha - ${areaLabel}`;
  const text = [
    `Recebemos uma solicitacao de recuperacao de senha para ${areaLabel}.`,
    '',
    `Link: ${resetUrl}`,
    `Token: ${token}`,
    '',
    `O token expira em ${PASSWORD_RESET_EXPIRES_MINUTES} minutos.`,
    'Se voce nao solicitou esta recuperacao, ignore esta mensagem.',
  ].join('\n');
  const html = `
    <p>Recebemos uma solicitacao de recuperacao de senha para ${escapeHtml(areaLabel)}.</p>
    <p><a href="${escapeHtml(resetUrl)}">Abrir redefinicao de senha</a></p>
    <p><strong>Token:</strong> <code>${escapeHtml(token)}</code></p>
    <p>O token expira em ${PASSWORD_RESET_EXPIRES_MINUTES} minutos.</p>
    <p>Se voce nao solicitou esta recuperacao, ignore esta mensagem.</p>
  `;

  return { subject, text, html, resetUrl, to: email };
}

async function sendPasswordResetInstructions({ tipo, email, token, req = null }) {
  if (!email || !token) {
    return { delivered: false, mode: PASSWORD_RESET_DELIVERY.mode };
  }

  const message = buildMessage({ tipo, email, token });

  if (PASSWORD_RESET_DELIVERY.mode === 'disabled') {
    logger.warn('password_reset.delivery.disabled', {
      request_id: req?.requestId,
      tipo,
      email,
    });
    return { delivered: false, mode: 'disabled' };
  }

  if (PASSWORD_RESET_DELIVERY.mode === 'log') {
    if (!IS_PRODUCTION) {
      console.warn(JSON.stringify({
        event: 'password_reset.delivery.dev_token',
        tipo,
        email,
        token,
        reset_url: message.resetUrl,
      }));
    }

    return { delivered: false, mode: 'log' };
  }

  try {
    await getTransporter().sendMail({
      from: PASSWORD_RESET_DELIVERY.smtp.from,
      to: message.to,
      replyTo: PASSWORD_RESET_DELIVERY.smtp.replyTo || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    logger.info('password_reset.delivery.sent', {
      request_id: req?.requestId,
      tipo,
      email,
    });

    return { delivered: true, mode: 'smtp' };
  } catch (error) {
    logger.error('password_reset.delivery.error', {
      request_id: req?.requestId,
      tipo,
      email,
      message: error.message,
      code: error.code,
    });

    return { delivered: false, mode: 'smtp', error };
  }
}

module.exports = {
  buildResetUrl,
  sendPasswordResetInstructions,
};
