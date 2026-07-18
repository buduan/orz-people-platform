import { Module } from '@nestjs/common';

import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [WorkspacesModule],
})
export class AuditModule {}
