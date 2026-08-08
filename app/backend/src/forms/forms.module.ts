import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { FormDefinitionValidatorService } from './form-definition-validator.service';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

/**
 * Form 定义与管理 HTTP 模块。
 * 依赖 DatasetsModule 获取字段定义和目标 Dataset 信息，
 * 导出的 Service 供 FormSubmissions 模块注入使用。
 */
@Module({
  imports: [AuditModule, DatasetsModule],
  controllers: [FormsController],
  providers: [FormsService, FormDefinitionValidatorService],
  exports: [FormsService, FormDefinitionValidatorService],
})
export class FormsModule {}
