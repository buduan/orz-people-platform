import { HttpException } from '@nestjs/common';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { FormSubmissionRateLimitService } from '../../src/form-submissions/form-submission-rate-limit.service';

describe('FormSubmissionRateLimitService', () => {
  it('uses configured limits, digests caller identity, and expires a new window', async () => {
    const redis = {
      incr: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
      expire: vi.fn(),
    };
    const config = {
      get: vi.fn((key: string) => ({
        FORM_SUBMISSION_RATE_LIMIT: '1',
        FORM_SUBMISSION_RATE_WINDOW_SECONDS: '45',
      })[key]),
    };
    const limiter = new FormSubmissionRateLimitService(redis as never, config as never);

    await expect(limiter.consume('form-1', 'network:203.0.113.7')).resolves.toBeUndefined();
    const redisKey = redis.incr.mock.calls[0]?.[0] as string;
    expect(redisKey).toMatch(/^form:submission-rate:form-1:[0-9a-f]{64}$/);
    expect(redisKey).not.toContain('203.0.113.7');
    expect(redis.expire).toHaveBeenCalledWith(redisKey, 45);
    await expect(limiter.consume('form-1', 'network:203.0.113.7'))
      .rejects.toBeInstanceOf(HttpException);
  });

  it('falls back to safe positive defaults for invalid configuration', async () => {
    const redis = { incr: vi.fn().mockResolvedValue(1), expire: vi.fn() };
    const config = { get: vi.fn().mockReturnValue('invalid') };

    await new FormSubmissionRateLimitService(redis as never, config as never)
      .consume('form-1', 'user:user-1');

    expect(redis.expire).toHaveBeenCalledWith(expect.any(String), 60);
  });
});
