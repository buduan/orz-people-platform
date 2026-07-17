import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { ApiResponse } from '@orz-people-platform/types';

import { AppService } from './app.service';

@Controller()
@ApiTags('System')
export class AppController {
  public constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check service health' })
  @ApiOkResponse({
    description: 'The service is available.',
    schema: {
      type: 'object',
      required: ['data', 'timestamp'],
      properties: {
        data: {
          type: 'object',
          required: ['service', 'status'],
          properties: {
            service: { type: 'string', example: 'orz-people-platform-backend' },
            status: { type: 'string', example: 'ok' },
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  public getHealth(): ApiResponse<{ service: string; status: string }> {
    return this.appService.getHealth();
  }
}
