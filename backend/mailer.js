// Outgoing email (sign-in codes). Any SMTP service works; a Gmail account with an app password is free
// (SMTP_HOST=smtp.gmail.com, SMTP_PORT=465). Off until SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM are set.
const nodemailer = require('nodemailer');

function mailConfiguration(env = process.env) {
  const port = Number(env.SMTP_PORT || 465);
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP_PORT');
  return { host: env.SMTP_HOST, port, user: env.SMTP_USER, pass: env.SMTP_PASS, from: env.MAIL_FROM };
}

/** Returns { send({ to, subject, text }) } or null when email is not configured. Tests pass config.mailTransport. */
function createMailer(config) {
  const transport = config.mailTransport || (config.smtp && nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465, requireTLS: config.smtp.port !== 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000
  }));
  if (!transport) return null;
  return { send: ({ to, subject, text }) => transport.sendMail({ from: config.smtp?.from || 'HFA SilverStrong <no-reply@example.invalid>', to, subject, text }) };
}

/** ch••••••••@gmail.com: enough to recognise the address, not enough to learn it. */
const maskEmail = email => {
  const [name, domain] = String(email || '').split('@');
  return domain ? `${name.slice(0, 2)}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}` : '';
};

module.exports = { mailConfiguration, createMailer, maskEmail };
