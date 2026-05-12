import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

type WhatsAppMessage = {
  to: string;
  text: string;
};

@Injectable()
export class WhatsAppCloudSender {
  private readonly logger = new Logger(WhatsAppCloudSender.name);

  isConfigured() {
    return Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN);
  }

  async send(message: WhatsAppMessage) {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp Cloud API nao configurada.');
    }

    const response = await fetch(this.messagesUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(this.messageBody(message))
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `WhatsApp Cloud API respondeu ${response.status}: ${body.slice(0, 400)}`
      );
    }

    this.logger.debug(`Mensagem WhatsApp aceita para ${message.to}.`);
  }

  private messagesUrl() {
    const baseUrl = env.WHATSAPP_API_BASE_URL.replace(/\/+$/, '');
    return `${baseUrl}/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  }

  private messageBody(message: WhatsAppMessage) {
    const to = this.normalizeTo(message.to);

    if (env.WHATSAPP_DEFAULT_TEMPLATE_NAME) {
      return {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: env.WHATSAPP_DEFAULT_TEMPLATE_NAME,
          language: {
            code: env.WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: message.text
                }
              ]
            }
          ]
        }
      };
    }

    return {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message.text
      }
    };
  }

  private normalizeTo(value: string) {
    const digits = value.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
  }
}
