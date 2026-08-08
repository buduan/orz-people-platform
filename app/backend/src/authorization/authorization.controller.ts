import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedActor } from '@weave/types';

import { CurrentActor, RequirePermissions } from './authorization.decorators';
import {
  CreateRoleDto,
  DirectGrantsDto,
  MemberRolesDto,
  PermissionKeysDto,
  ReauthenticateDto,
  UpdateRoleDto,
  WorkspaceAdministratorDto,
} from './authorization.dto';
import { AuthorizationService } from './authorization.service';

@Controller()
@ApiTags('Authorization')
@ApiBearerAuth()
export class AuthorizationController {
  public constructor(private readonly authorization: AuthorizationService) {}

  @Get('workspaces/:workspaceId/roles')
  @RequirePermissions('role.read')
  public listRoles(@Param('workspaceId', ParseIntPipe) workspaceId: number) {
    return this.authorization.listRoles(workspaceId);
  }

  @Post('workspaces/:workspaceId/roles')
  @RequirePermissions('role.create')
  public createRole(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: CreateRoleDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.createRole(workspaceId, dto, actor.userId);
  }

  @Patch('workspaces/:workspaceId/roles/:roleId')
  @RequirePermissions('role.update')
  public updateRole(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.updateRole(workspaceId, roleId, dto, actor.userId);
  }

  @Put('workspaces/:workspaceId/roles/:roleId/permissions')
  @RequirePermissions('role.update')
  public replaceRolePermissions(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('roleId') roleId: string,
    @Body() dto: PermissionKeysDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.replaceRolePermissions(
      workspaceId,
      roleId,
      dto.permissionKeys,
      actor.userId,
    );
  }

  @Delete('workspaces/:workspaceId/roles/:roleId')
  @RequirePermissions('role.delete')
  public deleteRole(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('roleId') roleId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.deleteRole(workspaceId, roleId, actor.userId);
  }

  @Put('workspaces/:workspaceId/members/:memberId/roles')
  @RequirePermissions('role.assign')
  public replaceMemberRoles(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberId') memberId: string,
    @Body() dto: MemberRolesDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.replaceMemberRoles(workspaceId, memberId, dto.roleIds, actor.userId);
  }

  @Put('workspaces/:workspaceId/members/:memberId/permissions')
  @RequirePermissions('permission.grant')
  public replaceMemberPermissions(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberId') memberId: string,
    @Body() dto: DirectGrantsDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.replaceDirectPermissions(
      memberId,
      dto.grants,
      actor.userId,
      workspaceId,
    );
  }

  @Put('workspaces/:workspaceId/members/:memberId/workspace-administrator')
  @RequirePermissions('workspace_admin')
  public setWorkspaceAdministrator(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberId') memberId: string,
    @Body() dto: WorkspaceAdministratorDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.setWorkspaceAdministrator(
      workspaceId,
      memberId,
      dto.enabled,
      actor.userId,
      dto,
    );
  }

  @Get('system-administrators')
  @RequirePermissions('system_admin')
  public listSystemAdministrators() {
    return this.authorization.listSystemAdministrators();
  }

  @Post('system-administrators/:userId')
  @RequirePermissions('system_admin')
  public grantSystemAdministrator(
  @Param('userId') userId: string,
    @Body() dto: ReauthenticateDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.grantSystemAdministrator(userId, actor.userId, dto);
  }

  @Delete('system-administrators/:userId')
  @RequirePermissions('system_admin')
  public revokeSystemAdministrator(
  @Param('userId') userId: string,
    @Body() dto: ReauthenticateDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.authorization.revokeSystemAdministrator(userId, actor.userId, dto);
  }
}
