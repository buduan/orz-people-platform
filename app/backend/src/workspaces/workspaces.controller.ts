import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedActor } from '@orz-people-platform/types';

import { CurrentActor, RequirePermissions } from '../authorization/authorization.decorators';
import {
  CreateMemberTypeDto, UpdateMemberDto, UpdateMemberTypeDto,
} from './workspaces.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@ApiTags('Workspaces')
@ApiBearerAuth()
export class WorkspacesController {
  public constructor(private readonly workspaces: WorkspacesService) {}

  @Get('1')
  public getDefault() {
    return this.workspaces.findDefault();
  }

  @Get(':workspaceId/members')
  @RequirePermissions('member.read')
  public listMembers(@Param('workspaceId', ParseIntPipe) workspaceId: number) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Patch(':workspaceId/members/:memberId')
  @RequirePermissions('member.update')
  public updateMember(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workspaces.updateMember(workspaceId, memberId, dto, actor.userId);
  }

  @Get(':workspaceId/member-types')
  @RequirePermissions('member.read')
  public listMemberTypes(@Param('workspaceId', ParseIntPipe) workspaceId: number) {
    return this.workspaces.listMemberTypes(workspaceId);
  }

  @Post(':workspaceId/member-types')
  @RequirePermissions('member_type.manage')
  public createMemberType(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: CreateMemberTypeDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workspaces.createMemberType(workspaceId, dto, actor.userId);
  }

  @Patch(':workspaceId/member-types/:memberTypeId')
  @RequirePermissions('member_type.manage')
  public updateMemberType(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberTypeId') memberTypeId: string,
    @Body() dto: UpdateMemberTypeDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.workspaces.updateMemberType(workspaceId, memberTypeId, dto, actor.userId);
  }

  @Delete(':workspaceId/member-types/:memberTypeId')
  @RequirePermissions('member_type.manage')
  public async deleteMemberType(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberTypeId') memberTypeId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    await this.workspaces.deleteMemberType(workspaceId, memberTypeId, actor.userId);
    return { accepted: true };
  }
}
