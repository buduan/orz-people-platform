import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  actorType: 'bootstrap' | 'system' | 'user';
  actorUserId?: string;
  metadata?: Prisma.InputJsonValue;
  resourceId?: string;
  resourceType: string;
  result: 'denied' | 'failure' | 'success';
  workspaceId?: number;
}

type AuditClient = Pick<PrismaClient, 'auditLog'>;

@Injectable()
export class AuditService {
  public constructor(private readonly prisma: PrismaService) {}

  public async record(entry: AuditEntry, client: AuditClient = this.prisma): Promise<void> {
    await client.auditLog.create({
      data: {
        action: entry.action,
        actorType: entry.actorType,
        actorUserId: entry.actorUserId,
        metadata: entry.metadata,
        resourceId: entry.resourceId,
        resourceType: entry.resourceType,
        result: entry.result,
        workspaceId: entry.workspaceId,
      },
    });
  }
}
