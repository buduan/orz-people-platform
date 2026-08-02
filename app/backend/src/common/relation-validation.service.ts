import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * 关联目标验证服务。
 *
 * 验证 relations Map 中引用的所有目标行都存在于指定 workspace 中，
 * 且属于正确的关联 Dataset。
 */
@Injectable()
export class RelationValidationService {
  public constructor(private readonly prisma: PrismaService) {}

  /**
   * 批量验证关联目标行存在且属于正确的 Dataset。
   *
   * @param workspaceId  工作区 ID
   * @param fields       字段定义列表（含 relationTargetDatasetId）
   * @param relations    字段 ID → 目标行 ID 列表的映射
   * @throws BadRequestException 当任何目标行不存在或不属于预期 Dataset 时
   */
  public async validate(
    workspaceId: number,
    fields: Array<{ id: string; relationTargetDatasetId: string | null }>,
    relations: Map<string, string[]>,
  ): Promise<void> {
    const ids = [...new Set([...relations.values()].flat())];
    const rows = ids.length === 0
      ? []
      : await this.prisma.datasetRow.findMany({
          where: { id: { in: ids }, workspaceId, deletedAt: null },
          select: { id: true, datasetId: true },
        });
    const datasetByRow = new Map(rows.map((row) => [row.id, row.datasetId]));
    const fieldsById = new Map(fields.map((f) => [f.id, f]));
    for (const [fieldId, targetIds] of relations) {
      const expected = fieldsById.get(fieldId)?.relationTargetDatasetId;
      const invalid = targetIds.find((id) => datasetByRow.get(id) !== expected);
      if (invalid) throw new BadRequestException(`Invalid relation target: ${invalid}`);
    }
  }
}
