import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { API_REQUEST_ID_HEADER } from '@orz-people-platform/types';

import { requestContext } from './request-context';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  public use(request: Request, response: Response, next: NextFunction): void {
    const incomingRequestId = request.header(API_REQUEST_ID_HEADER);
    const requestId = incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

    response.setHeader(API_REQUEST_ID_HEADER, requestId);
    requestContext.run({ requestId }, next);
  }
}
