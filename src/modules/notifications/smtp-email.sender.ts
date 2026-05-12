import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';

type EmailMessage = {
  to: string;
  subject?: string | null;
  text: string;
};

@Injectable()
export class SmtpEmailSender {
  private readonly logger = new Logger(SmtpEmailSender.name);
  private transporter?: Transporter;

  isConfigured() {
    return Boolean(
      env.SMTP_HOST &&
        env.SMTP_USER &&
        env.SMTP_PASSWORD &&
        this.fromAddress()
    );
  }

  async send(message: EmailMessage) {
    if (!this.isConfigured()) {
      throw new Error('SMTP nao configurado.');
    }

    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: this.fromAddress(),
      to: message.to,
      subject: message.subject || 'PariFlow Partners',
      text: message.text
    });
  }

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD
      }
    });

    this.logger.log(
      `SMTP configurado em ${env.SMTP_HOST}:${env.SMTP_PORT} secure=${env.SMTP_SECURE}.`
    );

    return this.transporter;
  }

  private fromAddress() {
    return env.SMTP_FROM ?? env.SMTP_USER;
  }
}
