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

import { ApiResponseInterceptor } from './api-response.interceptor';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HTTP response envelope', () => {
  it('wraps successful controller data with its HTTP status', async () => {
    const handler = () => undefined;
    const context = {
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST' }) }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ accepted: true }) } as CallHandler;

    const response = await lastValueFrom(new ApiResponseInterceptor().intercept(context, next));

    expect(response).toMatchObject({ status: HttpStatus.CREATED, data: { accepted: true } });
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
      status: HttpStatus.BAD_REQUEST,
      data: null,
      message: 'email is invalid; username is required',
    }));
  });
});
