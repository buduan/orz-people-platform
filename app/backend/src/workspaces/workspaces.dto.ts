/* eslint-disable max-classes-per-file */
import {
  IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength,
} from 'class-validator';
import { MemberStatus } from '@prisma/client';

export class UpdateMemberDto {
  @IsEnum(MemberStatus)
  @IsOptional()
  public status?: MemberStatus;

  @IsOptional()
  @IsString()
  public memberTypeId?: string;
}

export class CreateMemberTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public name!: string;

  @Matches(/^[a-z][a-z0-9-]{1,63}$/)
  public slug!: string;
}

export class UpdateMemberTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public name?: string;

  @IsOptional()
  @Matches(/^[a-z][a-z0-9-]{1,63}$/)
  public slug?: string;
}
