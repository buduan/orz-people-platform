import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { SpecialDatasetsModule } from '../special-datasets/special-datasets.module';
import { FormSubmissionsService } from './form-submissions.service';

/**
 * Form 提交模块 —— 当前阶段不注册 HTTP Controller。
 * 依赖 DatasetsModule（行写入、Schema 校验）和 SpecialDatasetsModule
 * （Join Request 和 Activity 报名绑定）。
 */
@Module({
  imports: [AuditModule, DatasetsModule, SpecialDatasetsModule],
  providers: [FormSubmissionsService],
})
export class FormSubmissionsModule {}
