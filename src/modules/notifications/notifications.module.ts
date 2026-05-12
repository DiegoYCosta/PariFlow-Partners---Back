import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';
import { NotificationOutboxWorker } from './notification-outbox.worker';
import { SmtpEmailSender } from './smtp-email.sender';
import { WhatsAppCloudSender } from './whatsapp-cloud.sender';

@Module({
  imports: [PrismaModule],
  providers: [NotificationOutboxWorker, SmtpEmailSender, WhatsAppCloudSender],
  exports: [NotificationOutboxWorker, SmtpEmailSender, WhatsAppCloudSender]
})
export class NotificationsModule {}
