import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { ApiSuccess } from '@orz-people-platform/types';

import { currentRequestId } from './request-context';

@Injectable()
export class ApiSuccessInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  public intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    return next.handle().pipe(map((data) => ({
      data,
      meta: {
        requestId: currentRequestId() ?? 'unavailable',
        timestamp: new Date().toISOString(),
      },
    })));
  }
}
