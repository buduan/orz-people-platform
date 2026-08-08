/* eslint-disable max-classes-per-file */
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import type { JsonValue, SubmitFormRequest } from '@orz-people-platform/types';

export class FormIdParamsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public formId!: string;
}

export class RelationOptionsParamsDto extends FormIdParamsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public itemId!: string;
}

export class RelationOptionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  public values?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public take = 100;
}

export class SubmitFormDto implements SubmitFormRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public formId!: string;

  @IsObject()
  public answers!: Record<string, JsonValue>;

  @IsOptional()
  @IsInt()
  @Min(1)
  public expectedRevision?: number;
}
