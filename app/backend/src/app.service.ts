import { Inject, Injectable } from '@nestjs/common';

import { HealthService, type ProcessHealth } from './health/health.service';

@Injectable()
export class AppService {
  public constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService,
  ) {}

  public getHealth(): ProcessHealth {
    return this.healthService.liveness();
  }

  public getLiveness(): ProcessHealth {
    return this.healthService.liveness();
  }

  public getReadiness(): ProcessHealth {
    return this.healthService.readiness();
  }
}
