import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { apiStatuses, type ApiResponse } from '@weave/types';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  public intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(map((data: unknown) => ({
      status: apiStatuses.success,
      data,
      timestamp: new Date().toISOString(),
    })));
  }
}
