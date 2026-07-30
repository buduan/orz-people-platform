import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DatasetsModule } from '../datasets/datasets.module';
import { ActivitiesService } from './activities.service';
import { JoinRequestsService } from './join-requests.service';

/**
 * 特殊 Dataset 模块 —— 当前阶段不注册 HTTP Controller。
 * 管理 Members、Join Requests 和 Activity 报名等具有特殊生命周期
 * 和业务不变量的 Dataset 类型。
 */
@Module({
  imports: [AuditModule, DatasetsModule],
  providers: [ActivitiesService, JoinRequestsService],
  exports: [ActivitiesService, JoinRequestsService],
})
export class SpecialDatasetsModule {}
