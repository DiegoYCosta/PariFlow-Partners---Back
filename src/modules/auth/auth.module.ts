import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../../config/env';
import { FirebaseAdminService } from '../../infra/firebase/firebase-admin.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InternalAuthGuard } from './guards/internal-auth.guard';
import { PrivilegedAccessGuard } from './guards/privileged-access.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: false,
      secret: env.JWT_ACCESS_SECRET
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    InternalAuthGuard,
    PrivilegedAccessGuard,
    FirebaseAdminService
  ],
  exports: [InternalAuthGuard, PrivilegedAccessGuard, JwtModule]
})
export class AuthModule {}
