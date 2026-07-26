import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthSettingsService } from './auth-settings.service';
import { SessionService } from './session.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthSettingsService, SessionService],
  exports: [AuthSettingsService, JwtModule, SessionService],
})
export class SessionModule {}
