import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import type { ApiErrorResponse, ApiFieldError } from '@orz-people-platform/types';

import { currentRequestId } from './request-context';
import { JsonLogger } from '../observability/json-logger.service';

interface ExceptionPayload {
  code?: unknown;
  fieldErrors?: unknown;
  message?: unknown;
}

function exceptionPayload(exception: HttpException): ExceptionPayload {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return { message: response };
  }

  return response as ExceptionPayload;
}

function fieldErrors(value: unknown): ApiFieldError[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const errors = value.filter((item): item is ApiFieldError => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const error = item as Partial<ApiFieldError>;
    return typeof error.code === 'string'
      && typeof error.keyword === 'string'
      && typeof error.message === 'string'
      && typeof error.pointer === 'string';
  });

  return errors.length > 0 ? errors : undefined;
}

function errorMessage(status: number, message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  return status === HttpStatus.INTERNAL_SERVER_ERROR
    ? 'Internal server error.'
    : 'Request failed.';
}

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  public constructor(
    @Inject(HttpAdapterHost)
    private readonly adapterHost: HttpAdapterHost,
    @Inject(JsonLogger)
    private readonly logger: JsonLogger,
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exceptionPayload(exception) : {};
    const requestId = currentRequestId() ?? 'unavailable';
    const response: ApiErrorResponse = {
      error: {
        code: typeof payload.code === 'string' ? payload.code : `HTTP_${status}`,
        fieldErrors: fieldErrors(payload.fieldErrors),
        message: errorMessage(status, payload.message),
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };

    if (status >= 500) {
      this.logger.error('Unhandled HTTP exception.', exception);
    }

    this.adapterHost.httpAdapter.reply(host.switchToHttp().getResponse(), response, status);
  }
}
