import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env';

type WhatsAppWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: unknown[];
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
          errors?: Array<{
            code?: number;
            title?: string;
            message?: string;
            error_data?: {
              details?: string;
            };
          }>;
        }>;
      };
    }>;
  }>;
};

@Controller('notifications/whatsapp/webhook')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  @Get()
  verify(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    const query = request.query as Record<string, string | string[] | undefined>;
    const mode = this.queryValue(query['hub.mode']);
    const token = this.queryValue(query['hub.verify_token']);
    const challenge = this.queryValue(query['hub.challenge']);

    if (!env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      this.logger.warn('Webhook WhatsApp sem verify token configurado.');
      return reply.status(HttpStatus.SERVICE_UNAVAILABLE).send('not_configured');
    }

    if (
      mode === 'subscribe' &&
      token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
      challenge
    ) {
      this.logger.log('Webhook WhatsApp verificado pela Meta.');
      return reply.status(HttpStatus.OK).send(challenge);
    }

    this.logger.warn('Tentativa invalida de verificacao do webhook WhatsApp.');
    return reply.status(HttpStatus.FORBIDDEN).send('forbidden');
  }

  @Post()
  receive(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    const body = request.body as WhatsAppWebhookBody;
    const { inboundMessages, statuses } = this.extractEvents(body);

    for (const status of statuses) {
      const recipient = this.maskPhone(status.recipient_id);
      const errors = status.errors ?? [];

      if (errors.length > 0 || status.status === 'failed') {
        const errorSummary = errors
          .map((error) =>
            [
              error.code,
              error.title,
              error.message,
              error.error_data?.details
            ]
              .filter(Boolean)
              .join(' | ')
          )
          .join('; ');

        this.logger.warn(
          `Status WhatsApp ${status.status ?? 'unknown'} para ${recipient}: ${errorSummary || 'sem detalhe'}`
        );
        continue;
      }

      this.logger.log(
        `Status WhatsApp ${status.status ?? 'unknown'} para ${recipient}.`
      );
    }

    if (inboundMessages > 0) {
      this.logger.log(
        `Webhook WhatsApp recebeu ${inboundMessages} mensagem(ns) de entrada.`
      );
    }

    return reply.status(HttpStatus.OK).send('EVENT_RECEIVED');
  }

  private extractEvents(body: WhatsAppWebhookBody) {
    const statuses: NonNullable<
      NonNullable<
        NonNullable<
          NonNullable<WhatsAppWebhookBody['entry']>[number]['changes']
        >[number]['value']
      >['statuses']
    > = [];
    let inboundMessages = 0;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        inboundMessages += change.value?.messages?.length ?? 0;
        statuses.push(...(change.value?.statuses ?? []));
      }
    }

    return { inboundMessages, statuses };
  }

  private queryValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private maskPhone(value?: string) {
    if (!value) {
      return 'destinatario desconhecido';
    }

    const digits = value.replace(/\D/g, '');
    if (digits.length <= 4) {
      return '****';
    }

    return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
  }
}
