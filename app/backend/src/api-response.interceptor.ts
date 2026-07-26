import {
  CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { ApiResponse } from '@orz-people-platform/types';

interface HttpRequest {
  method?: string;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const declaredStatus = Reflect.getMetadata(
      HTTP_CODE_METADATA,
      context.getHandler(),
    ) as number | undefined;
    const status = declaredStatus ?? (request.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);

    return next.handle().pipe(map((data: unknown) => ({
      status,
      data,
      timestamp: new Date().toISOString(),
    })));
  }
}
