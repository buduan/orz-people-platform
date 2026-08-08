import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DatasetRowsService } from './dataset-rows.service';
import { DatasetSchemaService } from './dataset-schema.service';
import { DatasetsService } from './datasets.service';
import { DatasetsController } from './datasets.controller';
import { MembersSyncService } from './members-sync.service';

/**
 * Dataset 核心领域模块。Service 仍导出供 Forms 和 SpecialDatasets 模块直接注入调用，
 * 避免产生循环依赖。
 */
@Module({
  imports: [AuditModule],
  controllers: [DatasetsController],
  providers: [DatasetsService, DatasetRowsService, DatasetSchemaService, MembersSyncService],
  exports: [DatasetsService, DatasetRowsService, DatasetSchemaService, MembersSyncService],
})
export class DatasetsModule {}
