import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from '@nestjs/common';
import {
  NotificationOutbox,
  NotificationOutboxChannel,
  NotificationOutboxStatus
} from '@prisma/client';
import { env } from '../../config/env';
import { PrismaService } from '../../infra/database/prisma.service';
import { SmtpEmailSender } from './smtp-email.sender';

@Injectable()
export class NotificationOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private missingSmtpLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtpEmailSender: SmtpEmailSender
  ) {}

  onModuleInit() {
    if (!env.NOTIFICATION_OUTBOX_WORKER_ENABLED) {
      this.logger.log('Worker de notificacoes desativado por configuracao.');
      return;
    }

    this.timer = setInterval(
      () => void this.processPending(),
      env.NOTIFICATION_OUTBOX_POLL_INTERVAL_MS
    );
    void this.processPending();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async processPending() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      this.prisma.assertConfigured();
      if (!this.smtpEmailSender.isConfigured()) {
        if (!this.missingSmtpLogged) {
          this.logger.warn(
            'SMTP nao configurado; mensagens de e-mail permanecerao pendentes na outbox.'
          );
          this.missingSmtpLogged = true;
        }
        return;
      }

      const now = new Date();
      const items = await this.prisma.notificationOutbox.findMany({
        where: {
          channel: NotificationOutboxChannel.EMAIL,
          status: NotificationOutboxStatus.PENDING,
          attempts: { lt: env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
        },
        take: env.NOTIFICATION_OUTBOX_BATCH_SIZE,
        orderBy: [{ queuedAt: 'asc' }, { id: 'asc' }]
      });

      for (const item of items) {
        await this.processItem(item);
      }
    } catch (error) {
      this.logger.error(
        `Falha no worker de notificacoes: ${this.errorMessage(error)}`
      );
    } finally {
      this.running = false;
    }
  }

  private async processItem(item: NotificationOutbox) {
    const claimed = await this.prisma.notificationOutbox.updateMany({
      where: {
        id: item.id,
        status: NotificationOutboxStatus.PENDING,
        attempts: item.attempts
      },
      data: {
        status: NotificationOutboxStatus.PROCESSING,
        lastAttemptAt: new Date()
      }
    });

    if (claimed.count !== 1) {
      return;
    }

    try {
      await this.smtpEmailSender.send({
        to: item.target,
        subject: item.subject,
        text: item.message
      });

      await this.prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: NotificationOutboxStatus.SENT,
          sentAt: new Date(),
          failedAt: null,
          failureReason: null
        }
      });
    } catch (error) {
      const attempts = item.attempts + 1;
      const failed = attempts >= env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS;

      await this.prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: failed
            ? NotificationOutboxStatus.FAILED
            : NotificationOutboxStatus.PENDING,
          attempts,
          failedAt: failed ? new Date() : null,
          nextAttemptAt: failed ? null : this.nextAttemptAt(attempts),
          failureReason: this.errorMessage(error).slice(0, 255)
        }
      });
    }
  }

  private nextAttemptAt(attempts: number) {
    const minutes = Math.min(30, 2 ** Math.max(0, attempts - 1));
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
