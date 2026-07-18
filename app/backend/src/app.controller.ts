import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiResponseSchemaHost } from '@nestjs/swagger';

import { API_REQUEST_ID_HEADER } from '@orz-people-platform/types';

import { AppService } from './app.service';
import { HealthService, type ProcessHealth } from './health/health.service';

const HEALTH_RESPONSE_SCHEMA: ApiResponseSchemaHost['schema'] = {
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data: {
      type: 'object',
      required: ['service', 'status'],
      properties: {
        service: { type: 'string', example: 'orz-people-platform-backend' },
        status: { type: 'string', enum: ['ok', 'ready'] },
      },
    },
    meta: {
      type: 'object',
      required: ['requestId', 'timestamp'],
      properties: {
        requestId: {
          type: 'string',
          maxLength: 128,
          pattern: '^[A-Za-z0-9._:-]+$',
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
};

@Controller()
@ApiHeader({
  description: 'Optional caller-provided trace identifier. Invalid values are replaced.',
  name: API_REQUEST_ID_HEADER,
  required: false,
})
@ApiTags('System')
export class AppController {
  public constructor(
    @Inject(AppService)
    private readonly appService: AppService,
    @Inject(HealthService)
    private readonly healthService: HealthService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check service health' })
  @ApiOkResponse({
    description: 'The service is available.',
    schema: HEALTH_RESPONSE_SCHEMA,
  })
  public getHealth(): ProcessHealth {
    return this.appService.getHealth();
  }

  @Get('health/live')
  @ApiOperation({ summary: 'Check HTTP process liveness' })
  @ApiOkResponse({
    description: 'The HTTP process is alive.',
    schema: HEALTH_RESPONSE_SCHEMA,
  })
  public getLiveness(): ProcessHealth {
    return this.appService.getLiveness();
  }

  @Get('health/ready')
  @ApiOperation({ summary: 'Check HTTP process readiness' })
  @ApiOkResponse({
    description: 'The HTTP process accepts requests.',
    schema: HEALTH_RESPONSE_SCHEMA,
  })
  public getReadiness(): ProcessHealth {
    if (!this.healthService.isReady()) {
      throw new ServiceUnavailableException({
        code: 'PROCESS_NOT_READY',
        message: 'The HTTP process is shutting down.',
      });
    }

    return this.appService.getReadiness();
  }
}
