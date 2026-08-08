import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import {
  lastValueFrom,
  of,
} from 'rxjs';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { apiStatuses } from '@weave/types';

import { ApiResponseInterceptor } from '../src/api-response.interceptor';
import { HttpExceptionFilter } from '../src/http-exception.filter';

describe('HTTP response envelope', () => {
  it('wraps successful controller data with a business status', async () => {
    const handler = () => undefined;
    const context = {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST' }) }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ accepted: true }) } as CallHandler;

    const response = await lastValueFrom(new ApiResponseInterceptor().intercept(context, next));

    expect(response).toMatchObject({
      status: apiStatuses.success,
      data: { accepted: true },
    });
    expect(response.timestamp).toEqual(expect.any(String));
  });

  it('uses the same envelope for errors', () => {
    const response = { json: vi.fn(), status: vi.fn() };
    response.status.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ExecutionContext;

    new HttpExceptionFilter().catch(new BadRequestException(['email is invalid', 'username is required']), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      status: apiStatuses.badRequest,
      data: null,
      message: 'email is invalid; username is required',
    }));
  });

  it('keeps HTTP 400 separate from a custom business status', () => {
    const response = { json: vi.fn(), status: vi.fn() };
    response.status.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ExecutionContext;

    new HttpExceptionFilter().catch(new BadRequestException({
      status: apiStatuses.accountNotFound,
      message: 'Account not found',
    }), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      status: apiStatuses.accountNotFound,
      message: 'Account not found',
    }));
  });
});
