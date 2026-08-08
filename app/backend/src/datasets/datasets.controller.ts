import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Dataset, DatasetField } from '@prisma/client';

import type {
  AuthenticatedActor,
  DatasetFieldDefinition,
  DatasetPanelDetail,
  DatasetSummary,
} from '@orz-people-platform/types';

import { CurrentActor } from '../authorization/authorization.decorators';
import { CreateDatasetFieldDto } from './datasets.dto';
import { DatasetsService } from './datasets.service';

@Controller('workspaces/:workspaceId/datasets')
@ApiTags('Datasets')
@ApiBearerAuth()
export class DatasetsController {
  public constructor(private readonly datasets: DatasetsService) {}

  @Get('listDatasets')
  public async listDatasets(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
      @CurrentActor() actor: AuthenticatedActor,
  ): Promise<DatasetSummary[]> {
    const datasets = await this.datasets.list(workspaceId, actor);
    return datasets.map((dataset) => this.toDatasetSummary(dataset));
  }

  @Get('getDataset/:datasetId')
  public async getDataset(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
      @Param('datasetId') datasetId: string,
      @CurrentActor() actor: AuthenticatedActor,
  ): Promise<DatasetPanelDetail> {
    const dataset = await this.datasets.get(workspaceId, datasetId, actor);
    return {
      ...this.toDatasetSummary(dataset),
      fields: dataset.fields
        .filter((field) => field.archivedAt === null)
        .map((field) => this.toFieldDefinition(field)),
    };
  }

  @Post('createDatasetField')
  public async createDatasetField(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
      @Body() dto: CreateDatasetFieldDto,
      @CurrentActor() actor: AuthenticatedActor,
  ): Promise<DatasetFieldDefinition> {
    const { datasetId, ...definition } = dto;
    const field = await this.datasets.createField(workspaceId, datasetId, definition, actor);
    return this.toFieldDefinition(field);
  }

  private toDatasetSummary(dataset: Dataset): DatasetSummary {
    return {
      id: dataset.id,
      workspaceId: dataset.workspaceId,
      name: dataset.name,
      slug: dataset.slug,
      description: dataset.description,
      type: dataset.type,
      status: dataset.status,
      subjectMode: dataset.subjectMode,
      revision: dataset.revision,
      createdAt: dataset.createdAt.toISOString(),
      updatedAt: dataset.updatedAt.toISOString(),
    };
  }

  private toFieldDefinition(field: DatasetField): DatasetFieldDefinition {
    return {
      id: field.id,
      datasetId: field.datasetId,
      key: field.key,
      name: field.name,
      description: field.description,
      kind: field.kind,
      valueSchema: field.valueSchema as DatasetFieldDefinition['valueSchema'],
      config: field.config as DatasetFieldDefinition['config'],
      required: field.required,
      isSystemManaged: field.isSystemManaged,
      systemKey: field.systemKey,
      relationTargetDatasetId: field.relationTargetDatasetId,
      relationCardinality: field.relationCardinality,
      position: field.position,
      revision: field.revision,
      archivedAt: field.archivedAt?.toISOString() ?? null,
    };
  }
}
