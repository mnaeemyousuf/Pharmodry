import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { loadConfig } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { AuthController } from '../auth/auth.controller';
import { JwtAuthGuard, PermissionsGuard } from '../auth/auth.guards';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { EmailChannel, NotificationService } from '../notifications/notification.service';
import { SignatureService } from '../signatures/signature.service';
import { AuditController, NotificationsController, SignaturesController } from './core.controllers';
import { NumberingService, SettingsService, UserDirectory } from './core.services';

/** Cross-cutting services used by every domain module: identity, audit, e-signature, numbering, notifications. */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: loadConfig().jwtAccessSecret, signOptions: { algorithm: 'HS256', issuer: 'pharmodry' }, verifyOptions: { algorithms: ['HS256'], issuer: ['pharmodry', 'pharma360'] /* pre-rebrand tokens stay valid until expiry */ } }),
    }),
  ],
  controllers: [AuthController, AuditController, SignaturesController, NotificationsController],
  providers: [
    AuthService,
    PasswordService,
    AuditService,
    SignatureService,
    NumberingService,
    SettingsService,
    UserDirectory,
    NotificationService,
    EmailChannel,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [AuthService, PasswordService, AuditService, SignatureService, NumberingService, SettingsService, UserDirectory, NotificationService, JwtAuthGuard, PermissionsGuard],
})
export class CoreModule {}
