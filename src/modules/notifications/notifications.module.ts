import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';
import { NotificationOutboxWorker } from './notification-outbox.worker';
import { SmtpEmailSender } from './smtp-email.sender';

@Module({
  imports: [PrismaModule],
  providers: [NotificationOutboxWorker, SmtpEmailSender],
  exports: [NotificationOutboxWorker, SmtpEmailSender]
})
export class NotificationsModule {}
