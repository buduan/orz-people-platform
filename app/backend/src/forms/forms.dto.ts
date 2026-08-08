/* eslint-disable max-classes-per-file */
import { FormSubmissionAccess, FormWriteMode } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { formListSections, type FormListSection } from '@orz-people-platform/types';

class FormDefinitionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(35)
  public defaultLocale!: string;

  @IsObject()
  public nameI18n!: Record<string, string>;

  @IsOptional()
  @IsObject()
  public descriptionI18n?: Record<string, string>;

  @IsOptional()
  @IsObject()
  public closingMessageI18n?: Record<string, string>;

  @IsOptional()
  @IsISO8601()
  public opensAt?: string;

  @IsOptional()
  @IsISO8601()
  public closesAt?: string;

  @IsEnum(FormSubmissionAccess)
  public submissionAccess!: FormSubmissionAccess;

  @IsEnum(FormWriteMode)
  public writeMode!: FormWriteMode;

  @IsObject()
  public schema!: Record<string, unknown>;
}

export class ListFormsQueryDto {
  @IsOptional()
  @IsIn(formListSections)
  public status?: FormListSection;
}

export class CreateFormDto extends FormDefinitionDto {
  @IsString()
  @MinLength(1)
  public datasetId!: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]{2,63}$/)
  public slug!: string;
}

export class SaveFormDraftDto extends FormDefinitionDto {
  @IsString()
  @MinLength(1)
  public formId!: string;

  @IsInt()
  @Min(1)
  public expectedRevision!: number;

  @IsUUID()
  public lockToken!: string;
}

export class PublishFormDto {
  @IsString()
  @MinLength(1)
  public formId!: string;

  @IsInt()
  @Min(1)
  public expectedRevision!: number;

  @IsUUID()
  public lockToken!: string;
}

export class ChangeFormStatusDto {
  @IsString()
  @MinLength(1)
  public formId!: string;

  @IsInt()
  @Min(1)
  public expectedRevision!: number;
}

export class FormEditLockDto {
  @IsString()
  @MinLength(1)
  public formId!: string;
}

export class FormEditLockTokenDto extends FormEditLockDto {
  @IsUUID()
  public token!: string;
}
