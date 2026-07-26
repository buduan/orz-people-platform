import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { OtpService } from './otp.service';
import { MfaService } from './mfa.service';
import { PasskeyService } from './passkey.service';
import { ReauthenticationService } from './reauthentication.service';
import { SessionModule } from './session.module';

@Module({
  imports: [NotificationsModule, UsersModule, AuditModule, SessionModule],
  controllers: [AuthController],
  providers: [
    AuthRateLimitService,
    AuthService,
    MfaService,
    OtpService,
    PasskeyService,
    ReauthenticationService,
  ],
  exports: [
    AuthService,
    MfaService,
    OtpService,
    PasskeyService,
    ReauthenticationService,
    SessionModule,
  ],
})
export class AuthModule {}
