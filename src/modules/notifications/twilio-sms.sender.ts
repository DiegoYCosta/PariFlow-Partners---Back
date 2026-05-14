import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

type SmsMessage = {
  to: string;
  text: string;
};

@Injectable()
export class TwilioSmsSender {
  private readonly logger = new Logger(TwilioSmsSender.name);

  isConfigured() {
    return Boolean(
      env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_FROM
    );
  }

  async send(message: SmsMessage) {
    if (!this.isConfigured()) {
      throw new Error('Twilio SMS nao configurado.');
    }

    const accountSid = env.TWILIO_ACCOUNT_SID!;
    const body = new URLSearchParams({
      To: this.normalizeTo(message.to),
      From: env.TWILIO_SMS_FROM!,
      Body: message.text
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${accountSid}:${env.TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      }
    );

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `Twilio SMS respondeu ${response.status}: ${responseBody.slice(0, 400)}`
      );
    }

    this.logger.debug(`SMS aceito para ${message.to}.`);
  }

  private normalizeTo(value: string) {
    const digits = value.replace(/\D/g, '');
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    return `+${normalized}`;
  }
}
