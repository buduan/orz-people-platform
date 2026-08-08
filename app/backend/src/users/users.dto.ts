/* eslint-disable max-classes-per-file */
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

import { normalizeEmail, normalizeUsername } from '@weave/utils';

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => normalizeEmail(String(value)))
  public email!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{2,63}$/)
  @Transform(({ value }) => normalizeUsername(String(value)))
  public username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public nickname!: string;

  @IsOptional()
  @IsString()
  public password?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public nickname?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  public avatarUrl?: string;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  public status!: UserStatus;
}

export class RequestPhoneBindingDto {
  @Matches(/^\+[1-9]\d{7,14}$/)
  public phone!: string;
}

export class ConfirmPhoneBindingDto extends RequestPhoneBindingDto {
  @Matches(/^\d{6}$/)
  public code!: string;
}
