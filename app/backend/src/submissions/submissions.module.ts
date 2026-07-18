import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { FormsModule } from '../forms/forms.module';

@Module({
  imports: [AccessModule, FormsModule],
})
export class SubmissionsModule {}
