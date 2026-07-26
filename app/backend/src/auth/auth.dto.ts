/* eslint-disable max-classes-per-file */
import { Transform } from 'class-transformer';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { normalizeEmail, normalizeUsername } from '@orz-people-platform/utils';

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) => normalizeEmail(String(value)))
  public email!: string;

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

export class EmailDto {
  @IsEmail()
  @Transform(({ value }) => normalizeEmail(String(value)))
  public email!: string;
}

export class EmailCodeDto extends EmailDto {
  @Matches(/^\d{6}$/)
  public code!: string;
}

export class PasswordLoginDto {
  @IsString()
  public identifier!: string;

  @IsString()
  @MaxLength(128)
  public password!: string;

  @IsOptional()
  @IsString()
  public deviceName?: string;
}

export class PasswordChangeDto {
  @IsString()
  public currentPassword!: string;

  @IsString()
  public newPassword!: string;
}

export class PasswordResetDto extends EmailCodeDto {
  @IsString()
  public newPassword!: string;
}

export class MfaCodeRequestDto {
  @IsString()
  public challengeId!: string;

  @Matches(/^(email|sms)$/)
  public factor!: 'email' | 'sms';
}

export class MfaCompleteDto {
  @IsString()
  public challengeId!: string;

  @Matches(/^(email|sms|totp)$/)
  public factor!: 'email' | 'sms' | 'totp';

  @Matches(/^\d{6}$/)
  public code!: string;
}

export class TotpCodeDto {
  @Matches(/^\d{6}$/)
  public code!: string;
}

export class ReauthenticateDto {
  @IsOptional()
  @IsString()
  public password?: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  public emailCode?: string;
}

export class MfaSettingDto extends ReauthenticateDto {
  @IsBoolean()
  public enabled!: boolean;
}

export class PasskeyRegistrationVerifyDto {
  @IsString()
  public challengeId!: string;

  @IsObject()
  public response!: RegistrationResponseJSON;
}

export class PasskeyAuthenticationVerifyDto {
  @IsString()
  public challengeId!: string;

  @IsObject()
  public response!: AuthenticationResponseJSON;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  public deviceName?: string;
}

export class PhoneCodeRequestDto {
  @Matches(/^\+[1-9]\d{7,14}$/)
  public phone!: string;
}

export class PhoneCodeConfirmDto extends PhoneCodeRequestDto {
  @Matches(/^\d{6}$/)
  public code!: string;
}
