import nodemailer from 'nodemailer';
import type { Logger } from 'pino';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export function createMailer(
  config: { from: string; host?: string; port: number; user?: string; password?: string },
  logger: Logger,
  production: boolean,
): Mailer {
  if (config.host && config.user && config.password) {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
    return {
      async send(mail) {
        await transport.sendMail({ from: config.from, ...mail });
      },
    };
  }

  // Without SMTP settings, development prints the mail (including links) to the log.
  // Production never logs mail contents, since they contain single-use tokens.
  return {
    async send(mail) {
      if (production) {
        logger.error(
          { to: '[redacted]', subject: mail.subject },
          'Email not sent: SMTP not configured',
        );
        return;
      }
      logger.info(`\n--- Email to ${mail.to} ---\nSubject: ${mail.subject}\n\n${mail.text}\n---`);
    },
  };
}
