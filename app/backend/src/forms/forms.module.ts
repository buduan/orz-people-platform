import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [AccessModule, WorkspacesModule],
})
export class FormsModule {}
