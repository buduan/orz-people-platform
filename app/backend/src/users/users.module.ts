import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../auth/session.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule, SessionModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
