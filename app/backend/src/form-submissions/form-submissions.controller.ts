import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type {
  AuthenticatedActor,
  PublishedFormDefinition,
  SubmitFormResult,
} from '@weave/types';

import {
  CurrentActor,
  OptionalAuthentication,
  Public,
} from '../authorization/authorization.decorators';
import { FormsService } from '../forms/forms.service';
import {
  FormIdParamsDto,
  RelationOptionsParamsDto,
  RelationOptionsQueryDto,
  SubmitFormDto,
} from './form-submissions.dto';
import { FormSubmissionsService } from './form-submissions.service';

interface FillingHttpRequest {
  headers: { 'user-agent'?: string };
  ip?: string;
  socket?: { remoteAddress?: string };
}

@Controller('forms')
@ApiTags('Form filling')
export class FormSubmissionsController {
  public constructor(
    private readonly forms: FormsService,
    private readonly submissions: FormSubmissionsService,
  ) {}

  @Get('getPublishedForm/:formId')
  @OptionalAuthentication()
  public async getPublishedForm(
    @Param() params: FormIdParamsDto,
      @CurrentActor() actor?: AuthenticatedActor,
  ): Promise<PublishedFormDefinition> {
    const definition = await this.forms.getPublished(params.formId);
    if (!actor || definition.writeMode !== 'update_subject_row') return definition;
    const submissionContext = await this.submissions.getSubjectContext(params.formId, actor);
    if (submissionContext) return { ...definition, submissionContext };
    return {
      ...definition,
      acceptingSubmissions: false,
      unavailableReason: 'subject_row_missing',
    };
  }

  @Get('getRelationOptions/:formId/:itemId')
  @Public()
  public getRelationOptions(
  @Param() params: RelationOptionsParamsDto,
    @Query() query: RelationOptionsQueryDto,
  ) {
    return this.forms.relationOptions(params.formId, params.itemId, query.values, query.take);
  }

  @Post('submitForm')
  @OptionalAuthentication()
  public submitForm(
    @Body() dto: SubmitFormDto,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Req() request: FillingHttpRequest,
      @CurrentActor() actor?: AuthenticatedActor,
  ): Promise<SubmitFormResult> {
    const { formId, ...submission } = dto;
    return this.submissions.submitByPublicId(
      formId,
      submission,
      idempotencyKey,
      actor ?? null,
      {
        networkIdentity: request.ip ?? request.socket?.remoteAddress ?? 'unknown',
        userAgent: request.headers['user-agent'],
      },
    );
  }
}
