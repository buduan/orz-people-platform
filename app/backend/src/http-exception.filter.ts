import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { ApiErrorResponse } from '@orz-people-platform/types';

interface NestErrorBody {
  error?: string;
  message?: string | string[];
}

interface HttpResponse {
  json(body: ApiErrorResponse): void;
  status(statusCode: number): HttpResponse;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = this.statusFor(exception);
    const source = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof source === 'object' && source !== null ? source as NestErrorBody : undefined;
    const messages = Array.isArray(body?.message) ? body.message : undefined;
    let message = 'Request failed';
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) message = 'Internal server error';
    else if (messages?.length) message = messages.join('; ');
    else if (typeof body?.message === 'string') message = body.message;
    else if (typeof source === 'string') message = source;
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(exception);
    const payload: ApiErrorResponse = {
      status,
      data: null,
      message,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(payload);
  }

  private statusFor(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return HttpStatus.CONFLICT;
      if (exception.code === 'P2025') return HttpStatus.NOT_FOUND;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
