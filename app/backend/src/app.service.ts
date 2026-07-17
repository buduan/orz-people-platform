import { Injectable } from '@nestjs/common';

import type { ApiResponse } from '@orz-people-platform/types';

@Injectable()
export class AppService {
  public getHealth(): ApiResponse<{ service: string; status: string }> {
    return {
      data: {
        service: 'orz-people-platform-backend',
        status: 'ok',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
