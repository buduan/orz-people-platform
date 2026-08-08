import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { FormsModule } from '../forms/forms.module';
import { SpecialDatasetsModule } from '../special-datasets/special-datasets.module';
import { FormSubmissionRateLimitService } from './form-submission-rate-limit.service';
import { FormSubmissionsController } from './form-submissions.controller';
import { FormSubmissionsService } from './form-submissions.service';

/**
 * 依赖 DatasetsModule（行写入、Schema 校验）和 SpecialDatasetsModule
 * （Join Request 和 Activity 报名绑定）。
 */
@Module({
  imports: [AuditModule, CommonModule, DatasetsModule, FormsModule, SpecialDatasetsModule],
  controllers: [FormSubmissionsController],
  providers: [FormSubmissionsService, FormSubmissionRateLimitService],
})
export class FormSubmissionsModule {}
