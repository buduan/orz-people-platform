import { Transform } from 'class-transformer';
import {
  IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min,
} from 'class-validator';

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  public action?: string;

  @IsOptional()
  @IsString()
  public actorUserId?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  public cursor?: string;

  @IsOptional()
  @IsDateString()
  public from?: string;

  @IsOptional()
  @IsString()
  public resourceType?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  public take = 50;

  @IsOptional()
  @IsDateString()
  public to?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  public workspaceId?: number;
}
