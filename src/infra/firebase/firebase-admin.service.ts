import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
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

    try {
      return await getAuth(this.getOrCreateApp()).verifyIdToken(idToken);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : 'unknown';
      this.logger.warn(`Firebase ID Token recusado: ${code}`);
      throw new UnauthorizedException('Firebase ID Token invalido ou expirado.');
    }
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
