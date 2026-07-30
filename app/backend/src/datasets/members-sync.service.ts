import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatasetRowVersionOperation, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

/**
 * 成员 Dataset 同步服务。
 * 当 WorkspaceMember 类型或状态变化时，确保 Members Dataset 中的扩展行与成员记录保持一致。
 * guest 和 removed 成员不会有活跃的扩展行；非 guest 成员恰好拥有一行。
 */
@Injectable()
export class MembersSyncService {
  public constructor(private readonly audit: AuditService) {}

  /**
   * 在已有事务内同步指定 WorkspaceMember 对应的 Members Dataset 行。
   *
   * 规则：
   * - guest 或 removed 成员 → 软删除扩展行（若存在）
   * - 非 guest 且非 removed → 创建或恢复扩展行，写入系统字段投影
   *
   * 系统字段投影包括 user_id、name、email、member_type、member_status。
   * 这些字段值从 User/WorkspaceMember 记录实时读取，不信任客户端输入。
   */
  public async synchronize(
    tx: Prisma.TransactionClient,
    workspaceId: number,
    workspaceMemberId: string,
    actorUserId: string,
  ): Promise<void> {
    const [binding, member] = await Promise.all([
      tx.membersDatasetBinding.findUnique({ where: { workspaceId } }),
      tx.workspaceMember.findUnique({
        where: { id: workspaceMemberId },
        include: { memberType: true, user: true, memberProfileRow: { include: { row: true } } },
      }),
    ]);
    if (!binding) throw new ConflictException('Members Dataset is not initialized');
    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Workspace member not found');
    }

    // 查找 Members Dataset 的系统字段 ID。
    const fields = await tx.datasetField.findMany({
      where: { datasetId: binding.datasetId, isSystemManaged: true },
      select: { id: true, systemKey: true },
    });
    const fieldIds = new Map(fields.map((field) => [field.systemKey, field.id]));

    // 确保五个必须的系统字段均已创建。
    const requiredKeys = ['user_id', 'name', 'email', 'member_type', 'member_status'];
    const missingKey = requiredKeys.find((key) => !fieldIds.has(key));
    if (missingKey) throw new ConflictException(`Members system field is missing: ${missingKey}`);

    // 从当前 User 和 WorkspaceMember 记录投影系统字段值。
    const values: Prisma.InputJsonObject = {
      [fieldIds.get('user_id')!]: member.userId,
      [fieldIds.get('name')!]: member.user.name,
      [fieldIds.get('email')!]: member.user.email,
      [fieldIds.get('member_type')!]: member.memberType.slug,
      [fieldIds.get('member_status')!]: member.status,
    };

    // guest 和 removed 成员不需要扩展行。
    const shouldExist = member.memberType.slug !== 'guest' && member.status !== 'removed';
    const profile = member.memberProfileRow;

    // ---- 应删除扩展行的场景 ----
    if (!shouldExist && !profile?.row.deletedAt) {
      if (!profile) return;
      const row = await tx.datasetRow.update({
        where: { id: profile.rowId },
        data: {
          values,
          deletedAt: new Date(),
          revision: { increment: 1 },
          updatedByUserId: actorUserId,
        },
      });
      await this.createVersion(tx, row.id, row.revision, values, 'delete', actorUserId);
      await this.recordAudit(tx, workspaceId, row.id, member.id, 'delete', actorUserId);
      return;
    }
    if (!shouldExist) return;

    // ---- 创建新扩展行 ----
    if (!profile) {
      const row = await tx.datasetRow.create({
        data: {
          workspaceId,
          datasetId: binding.datasetId,
          values,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });
      // 同时创建 MemberProfileRow 绑定和 DatasetRowSubject 用户索引。
      await Promise.all([
        tx.memberProfileRow.create({
          data: {
            workspaceId, workspaceMemberId: member.id, datasetId: binding.datasetId, rowId: row.id,
          },
        }),
        tx.datasetRowSubject.create({
          data: {
            workspaceId, datasetId: binding.datasetId, rowId: row.id, userId: member.userId,
          },
        }),
      ]);
      await this.createVersion(tx, row.id, row.revision, values, 'create', actorUserId);
      await this.recordAudit(tx, workspaceId, row.id, member.id, 'create', actorUserId);
      return;
    }

    // ---- 更新或恢复已有扩展行 ----
    const operation = profile.row.deletedAt ? 'restore' : 'update';
    const row = await tx.datasetRow.update({
      where: { id: profile.rowId },
      data: {
        values,
        deletedAt: null,
        revision: { increment: 1 },
        updatedByUserId: actorUserId,
      },
    });
    await this.createVersion(tx, row.id, row.revision, values, operation, actorUserId);
    await this.recordAudit(tx, workspaceId, row.id, member.id, operation, actorUserId);
  }

  /** 创建 DatasetRowVersion 快照。Members 行没有关联字段，relationsSnapshot 固定为空。 */
  private async createVersion(
    tx: Prisma.TransactionClient,
    rowId: string,
    version: number,
    values: Prisma.InputJsonObject,
    operation: 'create' | 'delete' | 'restore' | 'update',
    actorUserId: string,
  ): Promise<void> {
    await tx.datasetRowVersion.create({
      data: {
        rowId,
        version,
        operation: operation as DatasetRowVersionOperation,
        valuesSnapshot: values,
        relationsSnapshot: {},
        changedFieldIds: Object.keys(values),
        actorUserId,
      },
    });
  }

  /** 记录 Members 同步的审计日志。 */
  private async recordAudit(
    tx: Prisma.TransactionClient,
    workspaceId: number,
    rowId: string,
    workspaceMemberId: string,
    operation: string,
    actorUserId: string,
  ): Promise<void> {
    await this.audit.record({
      action: 'dataset.members.synchronize',
      actorType: 'user',
      actorUserId,
      resourceType: 'dataset_row',
      resourceId: rowId,
      result: 'success',
      workspaceId,
      metadata: { operation, workspaceMemberId },
    }, tx);
  }
}
