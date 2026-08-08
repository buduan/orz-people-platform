import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityRegistrationStatus,
  ActivityStatus,
  DatasetCollaboratorRole,
  DatasetStatus,
  DatasetType,
  Prisma,
} from '@prisma/client';

import type { AuthenticatedActor } from '@weave/types';

import { AuditService } from '../audit/audit.service';
import { DatasetsService } from '../datasets/datasets.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateActivityInput,
  UpdateActivityInput,
} from './special-dataset-input';

/**
 * Activity 管理服务。
 * 创建 Activity 时在同一事务中自动创建绑定的 activity_registrations Dataset。
 */
@Injectable()
export class ActivitiesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly datasets: DatasetsService,
    private readonly audit: AuditService,
  ) {}

  /** 列出 Workspace 下的全部 Activity。 */
  public async list(workspaceId: number, actor: AuthenticatedActor) {
    this.assertWorkspace(workspaceId, actor);
    return this.prisma.activity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 获取单个 Activity。无 activity.manage 权限时通过报名 Dataset 的读取权限间接授权。 */
  public async get(workspaceId: number, activityId: string, actor: AuthenticatedActor) {
    const activity = await this.findActivityOrThrow(workspaceId, activityId, actor);
    if (!actor.permissions.includes('activity.manage')) {
      await this.datasets.assertCanRead(workspaceId, activity.registrationDatasetId, actor);
    }
    return activity;
  }

  /**
   * 创建 Activity 及其绑定的 activity_registrations Dataset。
   * Dataset 名称取 nameI18n 首个值 + " registrations"；
   * slug 为 "activity-" + activity.slug，截断至 64 字符。
   */
  public async create(
    workspaceId: number,
    dto: CreateActivityInput,
    actor: AuthenticatedActor,
  ) {
    this.assertWorkspace(workspaceId, actor);
    this.assertLocaleMap(dto.nameI18n, 'nameI18n');
    if (dto.descriptionI18n) this.assertLocaleMap(dto.descriptionI18n, 'descriptionI18n');
    this.assertWindow(dto.startsAt, dto.endsAt);
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
    });
    if (!member) throw new ForbiddenException('A Workspace member is required to own an Activity');

    try {
      const transactionResult = await this.prisma.$transaction(async (tx) => {
        // 先创建绑定的报名 Dataset。
        const dataset = await tx.dataset.create({
          data: {
            workspaceId,
            name: `${Object.values(dto.nameI18n)[0]} registrations`,
            slug: `activity-${dto.slug}`.slice(0, 64),
            type: DatasetType.activity_registrations,
            status: DatasetStatus.active,
            createdByUserId: actor.userId,
            collaborators: {
              create: {
                workspaceMemberId: member.id,
                role: DatasetCollaboratorRole.owner,
                assignedByUserId: actor.userId,
              },
            },
          },
        });
        // 再创建 Activity 本身。
        const activity = await tx.activity.create({
          data: {
            workspaceId,
            registrationDatasetId: dataset.id,
            slug: dto.slug,
            nameI18n: dto.nameI18n,
            descriptionI18n: dto.descriptionI18n,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
            endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
            timezone: dto.timezone,
            createdByUserId: actor.userId,
          },
        });
        await this.datasets.createDefinitionVersion(
          tx,
          dataset.id,
          actor.userId,
          'activity.create',
        );
        await this.audit.record({
          action: 'activity.create',
          actorType: 'user',
          actorUserId: actor.userId,
          resourceType: 'activity',
          resourceId: activity.id,
          result: 'success',
          workspaceId,
          metadata: { registrationDatasetId: dataset.id, slug: activity.slug },
        }, tx);
        return activity;
      });
      return transactionResult;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Activity or registration Dataset slug is already in use');
      }
      throw error;
    }
  }

  /** 更新 Activity 元数据。已归档 Activity 不可修改。 */
  public async update(
    workspaceId: number,
    activityId: string,
    dto: UpdateActivityInput,
    actor: AuthenticatedActor,
  ) {
    const activity = await this.findManaged(workspaceId, activityId, actor);
    if (activity.status === ActivityStatus.archived) {
      throw new ConflictException('Activity is archived');
    }
    if (dto.nameI18n) this.assertLocaleMap(dto.nameI18n, 'nameI18n');
    if (dto.descriptionI18n) this.assertLocaleMap(dto.descriptionI18n, 'descriptionI18n');
    this.assertWindow(
      dto.startsAt ?? activity.startsAt?.toISOString(),
      dto.endsAt ?? activity.endsAt?.toISOString(),
    );
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.activity.updateMany({
        where: { id: activityId, workspaceId, revision: dto.expectedRevision },
        data: {
          nameI18n: dto.nameI18n,
          descriptionI18n: dto.descriptionI18n,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
          timezone: dto.timezone,
          revision: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Activity revision is stale');
      await this.audit.record({
        action: 'activity.update',
        actorType: 'user',
        actorUserId: actor.userId,
        resourceType: 'activity',
        resourceId: activityId,
        result: 'success',
        workspaceId,
      }, tx);
      return tx.activity.findUniqueOrThrow({ where: { id: activityId } });
    });
  }

  /**
   * 变更 Activity 状态。
   * 状态流转规则：
   * draft → open/archived
   * open → closed/archived
   * closed → open/archived
   * archived → 不可变更
   */
  public async changeStatus(
    workspaceId: number,
    activityId: string,
    expectedRevision: number,
    status: ActivityStatus,
    actor: AuthenticatedActor,
  ) {
    const activity = await this.findManaged(workspaceId, activityId, actor);
    const transitions: Record<ActivityStatus, ActivityStatus[]> = {
      draft: [ActivityStatus.open, ActivityStatus.archived],
      open: [ActivityStatus.closed, ActivityStatus.archived],
      closed: [ActivityStatus.open, ActivityStatus.archived],
      archived: [],
    };
    if (!transitions[activity.status].includes(status)) {
      throw new ConflictException(`Cannot change Activity from ${activity.status} to ${status}`);
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.activity.updateMany({
        where: { id: activityId, workspaceId, revision: expectedRevision },
        data: { status, revision: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Activity revision is stale');
      await this.audit.record({
        action: 'activity.status.update',
        actorType: 'user',
        actorUserId: actor.userId,
        resourceType: 'activity',
        resourceId: activityId,
        result: 'success',
        workspaceId,
        metadata: { status },
      }, tx);
      return tx.activity.findUniqueOrThrow({ where: { id: activityId } });
    });
  }

  /** 列出 Activity 的报名记录（上限 100 条）。 */
  public async listRegistrations(
    workspaceId: number,
    activityId: string,
    take: number,
    actor: AuthenticatedActor,
  ) {
    await this.findManaged(workspaceId, activityId, actor);
    return this.prisma.activityRegistration.findMany({
      where: { workspaceId, activityId },
      include: { row: true },
      orderBy: { registeredAt: 'desc' },
      take: Math.min(take, 100),
    });
  }

  /**
   * 取消报名。
   * 管理员和报名者本人可以取消；使用乐观锁防止并发。
   */
  public async cancelRegistration(
    workspaceId: number,
    activityId: string,
    rowId: string,
    expectedRevision: number,
    actor: AuthenticatedActor,
  ) {
    const registration = await this.prisma.activityRegistration.findUnique({ where: { rowId } });
    if (!registration || registration.workspaceId !== workspaceId
      || registration.activityId !== activityId) {
      throw new NotFoundException('Activity registration not found');
    }
    const canManage = actor.permissions.includes('activity.manage')
      || actor.isSystemAdmin
      || actor.isWorkspaceAdmin;
    if (!canManage && registration.participantUserId !== actor.userId) {
      throw new ForbiddenException('Activity registration cancellation is not allowed');
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.activityRegistration.updateMany({
        where: {
          rowId,
          revision: expectedRevision,
          status: { not: ActivityRegistrationStatus.cancelled },
        },
        data: {
          status: ActivityRegistrationStatus.cancelled,
          cancelledAt: new Date(),
          revision: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Registration revision is stale');
      await this.audit.record({
        action: 'activity.registration.cancel',
        actorType: 'user',
        actorUserId: actor.userId,
        resourceType: 'activity_registration',
        resourceId: rowId,
        result: 'success',
        workspaceId,
        metadata: { activityId },
      }, tx);
      return tx.activityRegistration.findUniqueOrThrow({ where: { rowId } });
    });
  }

  /**
   * 在事务内创建 ActivityRegistration 绑定。
   * 由 FormSubmissionsService 在 createRow 流程中调用。
   * Activity 非 open 状态时拒绝绑定。
   */
  public async bindRegistration(
    tx: Prisma.TransactionClient,
    activity: {
      id: string;
      registrationDatasetId: string;
      status: ActivityStatus;
      workspaceId: number;
    },
    rowId: string,
    participantUserId: string | null,
  ) {
    if (activity.status !== ActivityStatus.open) {
      throw new ConflictException('Activity is not open for registration');
    }
    return tx.activityRegistration.create({
      data: {
        workspaceId: activity.workspaceId,
        datasetId: activity.registrationDatasetId,
        activityId: activity.id,
        rowId,
        participantUserId,
      },
    });
  }

  /**
   * 查找 Activity 并校验 workspace 权限，未找到时抛出 NotFoundException。
   */
  private async findActivityOrThrow(
    workspaceId: number,
    activityId: string,
    actor: AuthenticatedActor,
  ) {
    this.assertWorkspace(workspaceId, actor);
    const activity = await this.prisma.activity.findUnique({
      where: { workspaceId_id: { workspaceId, id: activityId } },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  /**
   * 查找 Activity 并验证管理权限。
   * 持有 activity.manage 权限的用户直接通过；否则需要报名 Dataset 的管理权限。
   */
  private async findManaged(
    workspaceId: number,
    activityId: string,
    actor: AuthenticatedActor,
  ) {
    const activity = await this.findActivityOrThrow(workspaceId, activityId, actor);
    if (!actor.permissions.includes('activity.manage')) {
      await this.datasets.assertCanManage(workspaceId, activity.registrationDatasetId, actor);
    }
    return activity;
  }

  /** 校验 startsAt 早于 endsAt。 */
  private assertWindow(startsAt?: string, endsAt?: string): void {
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      throw new BadRequestException('Activity startsAt must be before endsAt');
    }
  }

  /** 校验 i18n map 非空且所有值为非空字符串。 */
  private assertLocaleMap(value: Record<string, string>, name: string): void {
    if (Object.keys(value).length === 0
      || Object.values(value).some((text) => typeof text !== 'string' || text.length === 0)) {
      throw new BadRequestException(`${name} must contain non-empty localized strings`);
    }
  }

  /** 守卫操作者属于请求的 Workspace（当前仅支持 workspace 1）。 */
  private assertWorkspace(workspaceId: number, actor: AuthenticatedActor): void {
    if (workspaceId !== 1 || actor.workspaceId !== workspaceId) {
      throw new ForbiddenException('Workspace access denied');
    }
  }
}
