import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { PermissionKey, AuthenticatedActor } from '@orz-people-platform/types';

import { PrismaService } from '../prisma/prisma.service';
import { CurrentActor, RequirePermissions } from '../authorization/authorization.decorators';
import { AuditQueryDto } from './audit.dto';

@Controller('audit-logs')
@ApiTags('Audit')
@ApiBearerAuth()
export class AuditController {
  public constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.read' satisfies PermissionKey)
  public async findAll(
  @CurrentActor() actor: AuthenticatedActor,
    @Query() query: AuditQueryDto,
  ) {
    const workspaceId = actor.isSystemAdmin ? query.workspaceId : actor.workspaceId;
    const logs = await this.prisma.auditLog.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.cursor ? { id: { lt: BigInt(query.cursor) } } : {}),
        ...(query.from || query.to ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(workspaceId !== undefined ? { workspaceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.take,
    });
    return logs.map((log) => ({ ...log, id: log.id.toString() }));
  }
}
