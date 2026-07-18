import { Injectable, OnApplicationShutdown } from '@nestjs/common';

export type ProcessHealthStatus = 'ok' | 'ready';

export interface ProcessHealth {
  service: string;
  status: ProcessHealthStatus;
}

@Injectable()
export class HealthService implements OnApplicationShutdown {
  private ready = true;

  public isReady(): boolean {
    return this.ready;
  }

  public liveness(): ProcessHealth {
    return {
      service: 'orz-people-platform-backend',
      status: 'ok',
    };
  }

  public readiness(): ProcessHealth {
    return {
      service: 'orz-people-platform-backend',
      status: 'ready',
    };
  }

  public onApplicationShutdown(): void {
    this.ready = false;
  }
}
