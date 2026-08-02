import { Module } from '@nestjs/common';

import { RelationValidationService } from './relation-validation.service';

/**
 * 共享基础设施模块。
 * 提供跨领域共用的工具服务。
 */
@Module({
  providers: [RelationValidationService],
  exports: [RelationValidationService],
})
export class CommonModule {}
