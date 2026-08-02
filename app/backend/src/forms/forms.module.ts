import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { FormDefinitionValidatorService } from './form-definition-validator.service';
import { FormsService } from './forms.service';

/**
 * Form 定义模块 —— 当前阶段不注册 HTTP Controller。
 * 依赖 DatasetsModule 获取字段定义和目标 Dataset 信息，
 * 导出的 Service 供 FormSubmissions 模块注入使用。
 */
@Module({
  imports: [AuditModule, DatasetsModule],
  providers: [FormsService, FormDefinitionValidatorService],
  exports: [FormsService, FormDefinitionValidatorService],
})
export class FormsModule {}
