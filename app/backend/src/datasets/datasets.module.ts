import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DatasetRowsService } from './dataset-rows.service';
import { DatasetSchemaService } from './dataset-schema.service';
import { DatasetsService } from './datasets.service';
import { MembersSyncService } from './members-sync.service';

/**
 * Dataset 核心领域模块 —— 当前阶段不注册 HTTP Controller。
 * 所有 Service 均导出，供 Forms 和 SpecialDatasets 模块直接注入调用，
 * 避免产生循环依赖。
 */
@Module({
  imports: [AuditModule],
  providers: [DatasetsService, DatasetRowsService, DatasetSchemaService, MembersSyncService],
  exports: [DatasetsService, DatasetRowsService, DatasetSchemaService, MembersSyncService],
})
export class DatasetsModule {}
