import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { env } from '../../config/env';

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app?: App;

  isConfigured(): boolean {
    return Boolean(
      env.FIREBASE_PROJECT_ID &&
        env.FIREBASE_CLIENT_EMAIL &&
        env.FIREBASE_PRIVATE_KEY
    );
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Firebase Admin nao esta configurado neste ambiente.'
      );
    }

    return getAuth(this.getOrCreateApp()).verifyIdToken(idToken);
  }

  private getOrCreateApp(): App {
    if (this.app) {
      return this.app;
    }

    const existingApp = getApps()[0];

    if (existingApp) {
      this.app = existingApp;
      return existingApp;
    }

    this.logger.log('Inicializando Firebase Admin SDK.');

    this.app = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });

    return this.app;
  }
}
