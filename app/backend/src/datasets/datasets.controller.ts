import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  AuthenticatedActor,
  DatasetFieldDefinition,
  DatasetPanelDetail,
  DatasetSummary,
  DatasetWindowQueryRequest,
} from '@orz-people-platform/types';

import { CurrentActor } from '../authorization/authorization.decorators';
import { DatasetRowsService } from './dataset-rows.service';
import {
  ArchiveDatasetFieldDto,
  CreateDatasetDto,
  CreateDatasetFieldDto,
  CreateDatasetPanelFieldDto,
  DatasetRelationOptionsDto,
  DatasetRevisionDto,
  DatasetRowValuesDto,
  DatasetWindowQueryDto,
  UpdateDatasetDto,
  UpdateDatasetFieldDto,
  UpdateDatasetRowDto,
} from './datasets.dto';
import { DatasetsService } from './datasets.service';

@Controller('workspaces/:workspaceId/datasets')
@ApiTags('Datasets')
@ApiBearerAuth()
export class DatasetsController {
  public constructor(
    private readonly datasets: DatasetsService,
    private readonly rows: DatasetRowsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List visible Datasets and creation capability' })
  public list(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.datasets.list(workspaceId, actor);
  }

  @Post()
  @ApiOperation({ summary: 'Create a standard or join-request Dataset' })
  public create(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: CreateDatasetDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.datasets.create(workspaceId, dto, actor);
  }

  @Get('listDatasets')
  @ApiOperation({ summary: 'List Datasets for the Form editor compatibility API' })
  public async listDatasets(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
      @CurrentActor() actor: AuthenticatedActor,
  ): Promise<DatasetSummary[]> {
    const response = await this.datasets.list(workspaceId, actor);
    return response.items.map(({ creator: _creator, capabilities: _capabilities, ...dataset }) => (
      dataset
    ));
  }

  @Get('getDataset/:datasetId')
  @ApiOperation({ summary: 'Get Dataset fields for the Form editor compatibility API' })
  public async getDataset(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
      @Param('datasetId') datasetId: string,
      @CurrentActor() actor: AuthenticatedActor,
  ): Promise<DatasetPanelDetail> {
    const detail = await this.datasets.get(workspaceId, datasetId, actor);
    return { ...detail.dataset, fields: detail.fields };
  }

  @Post('createDatasetField')
  @ApiOperation({ summary: 'Create a Dataset field for the Form editor compatibility API' })
  public async createDatasetField(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
      @Body() dto: CreateDatasetPanelFieldDto,
      @CurrentActor() actor: AuthenticatedActor,
  ): Promise<DatasetFieldDefinition> {
    const { datasetId, ...definition } = dto;
    const detail = await this.datasets.get(workspaceId, datasetId, actor);
    const result = await this.datasets.createField(workspaceId, datasetId, {
      ...definition,
      expectedDatasetRevision: detail.dataset.revision,
    }, actor);
    return result.field;
  }

  @Get(':datasetId')
  @ApiOperation({ summary: 'Get Dataset detail, active fields, creator and capabilities' })
  public get(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.datasets.get(workspaceId, datasetId, actor);
  }

  @Patch(':datasetId')
  @ApiOperation({ summary: 'Update Dataset metadata with a revision guard' })
  public update(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Body() dto: UpdateDatasetDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.datasets.update(workspaceId, datasetId, dto, actor);
  }

  @Post(':datasetId/archive')
  @ApiOperation({ summary: 'Archive a Dataset with a revision guard' })
  public archive(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Body() dto: DatasetRevisionDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.datasets.archive(workspaceId, datasetId, dto.expectedRevision, actor);
  }

  @Post(':datasetId/fields')
  @ApiOperation({ summary: 'Create and position a Dataset field' })
  public createField(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Body() dto: CreateDatasetFieldDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.datasets.createField(workspaceId, datasetId, dto, actor);
  }

  @Patch(':datasetId/fields/:fieldId')
  @ApiOperation({ summary: 'Update or reposition a Dataset field' })
  public updateField(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateDatasetFieldDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.datasets.updateField(workspaceId, datasetId, fieldId, dto, actor);
  }

  @Post(':datasetId/fields/:fieldId/archive')
  @ApiOperation({ summary: 'Archive a Dataset field and normalize positions' })
  public archiveField(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: ArchiveDatasetFieldDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.datasets.archiveField(workspaceId, datasetId, fieldId, dto, actor);
  }

  @Get(':datasetId/fields/:fieldId/options')
  @ApiOperation({ summary: 'Search paged relation target options' })
  public relationOptions(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Param('fieldId') fieldId: string,
    @Query() query: DatasetRelationOptionsDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.rows.relationOptions(workspaceId, datasetId, fieldId, actor, query);
  }

  @Post(':datasetId/rows/query')
  @ApiOperation({ summary: 'Query an absolute Dataset row window' })
  public queryRows(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Body() dto: DatasetWindowQueryDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.rows.queryWindow(
      workspaceId,
      datasetId,
      dto as unknown as DatasetWindowQueryRequest,
      actor,
    );
  }

  @Post(':datasetId/rows')
  @ApiOperation({ summary: 'Create a Dataset row' })
  public createRow(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Body() dto: DatasetRowValuesDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.rows.create(workspaceId, datasetId, dto, actor);
  }

  @Patch(':datasetId/rows/:rowId')
  @ApiOperation({ summary: 'Partially update Dataset row values or relations' })
  public updateRow(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Param('rowId') rowId: string,
    @Body() dto: UpdateDatasetRowDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.rows.update(workspaceId, datasetId, rowId, dto, actor);
  }

  @Delete(':datasetId/rows/:rowId')
  @ApiOperation({ summary: 'Soft-delete a Dataset row' })
  public async deleteRow(
  @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('datasetId') datasetId: string,
    @Param('rowId') rowId: string,
    @Body() dto: DatasetRevisionDto,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    await this.rows.softDelete(workspaceId, datasetId, rowId, dto.expectedRevision, actor);
    return { accepted: true };
  }
}
