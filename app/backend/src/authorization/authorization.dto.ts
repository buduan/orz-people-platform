/* eslint-disable max-classes-per-file */
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoleDto {
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/)
  public code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public name!: string;

  @IsOptional()
  @IsString()
  public description?: string;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public name?: string;

  @IsOptional()
  @IsString()
  public description?: string;
}

export class PermissionKeysDto {
  @IsArray()
  @IsString({ each: true })
  public permissionKeys!: string[];
}

export class MemberRolesDto {
  @IsArray()
  @IsString({ each: true })
  public roleIds!: string[];
}

export class DirectGrantDto {
  @IsString()
  public permissionKey!: string;

  @IsIn(['allow', 'deny'])
  public effect!: 'allow' | 'deny';
}

export class DirectGrantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectGrantDto)
  public grants!: DirectGrantDto[];
}

export class ReauthenticateDto {
  @IsOptional()
  @IsString()
  public password?: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  public emailCode?: string;
}

export class WorkspaceAdministratorDto extends ReauthenticateDto {
  @IsBoolean()
  public enabled!: boolean;
}
