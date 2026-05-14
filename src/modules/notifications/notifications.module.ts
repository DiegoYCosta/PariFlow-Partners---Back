import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';
import { NotificationOutboxWorker } from './notification-outbox.worker';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { SmtpEmailSender } from './smtp-email.sender';
import { TwilioSmsSender } from './twilio-sms.sender';
import { WhatsAppCloudSender } from './whatsapp-cloud.sender';

@Module({
  imports: [PrismaModule],
  controllers: [WhatsAppWebhookController],
  providers: [
    NotificationOutboxWorker,
    SmtpEmailSender,
    TwilioSmsSender,
    WhatsAppCloudSender
  ],
  exports: [
    NotificationOutboxWorker,
    SmtpEmailSender,
    TwilioSmsSender,
    WhatsAppCloudSender
  ]
})
export class NotificationsModule {}
