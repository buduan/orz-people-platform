import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [AccessModule, SubmissionsModule],
})
export class WorkflowsModule {}
