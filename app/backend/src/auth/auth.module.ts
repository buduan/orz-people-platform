import { Module } from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoggingOtpSender, OTP_SENDER } from './otp-sender';

@Module({
  providers: [
    AuthService,
    { provide: OTP_SENDER, useClass: LoggingOtpSender },
  ],
  exports: [AuthService],
})
export class AuthModule {}
