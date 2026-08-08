import { DatasetRowVersionOperation, Prisma } from '@prisma/client';

/**
 * 创建 DatasetRowVersion 的参数。
 */
export interface CreateRowVersionParams {
  tx: Prisma.TransactionClient;
  rowId: string;
  version: number;
  operation: DatasetRowVersionOperation;
  values: Prisma.InputJsonObject;
  relations: Map<string, string[]>;
  actorUserId?: string | null;
}

/**
 * 在事务中创建 DatasetRowVersion 快照。
 *
 * 统一处理 `valuesSnapshot`、`relationsSnapshot` 和 `changedFieldIds`
 * 的数据转换，消除各 Service 中的重复构造逻辑。
 */
export function createRowVersion(params: CreateRowVersionParams) {
  const {
    tx, rowId, version, operation, values, relations, actorUserId,
  } = params;
  return tx.datasetRowVersion.create({
    data: {
      rowId,
      version,
      operation,
      valuesSnapshot: values,
      relationsSnapshot: Object.fromEntries(relations) as Prisma.InputJsonObject,
      changedFieldIds: [...Object.keys(values), ...relations.keys()],
      actorUserId: actorUserId ?? null,
    },
  });
}
