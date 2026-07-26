import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppService } from './app.service';
import { Public } from './authorization/authorization.decorators';

@Controller()
@ApiTags('System')
export class AppController {
  public constructor(private readonly appService: AppService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Check service health' })
  @ApiOkResponse({
    description: 'The service is available.',
    schema: {
      type: 'object',
      required: ['status', 'data', 'timestamp'],
      properties: {
        status: { type: 'string', example: 'success' },
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
  public getHealth(): { service: string; status: string } {
    return this.appService.getHealth();
  }
}
