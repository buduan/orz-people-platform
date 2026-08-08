/* eslint-disable max-classes-per-file */
import { DatasetFieldKind, RelationCardinality } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDatasetFieldDto {
  @IsString()
  @MinLength(1)
  public datasetId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  public key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  public name!: string;

  @IsOptional()
  @IsString()
  public description?: string;

  @IsEnum(DatasetFieldKind)
  public kind!: DatasetFieldKind;

  @IsObject()
  public valueSchema!: Record<string, unknown>;

  @IsObject()
  public config!: Record<string, unknown>;

  @IsBoolean()
  public required!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  public relationTargetDatasetId?: string;

  @IsOptional()
  @IsEnum(RelationCardinality)
  public relationCardinality?: RelationCardinality;

  @IsOptional()
  @IsInt()
  @Min(0)
  public position?: number;
}
