import { Module } from '@nestjs/common';

import { AccessService } from './access.service';
import { ActorContextService } from './actor-context.service';
import { AuthGuard } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [AuthModule, WorkspacesModule],
  providers: [ActorContextService, AccessService, AuthGuard, PermissionsGuard],
  exports: [ActorContextService, AccessService, AuthGuard, PermissionsGuard],
})
export class AccessModule {}
