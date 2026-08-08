import { createHash } from 'node:crypto';

import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../redis/redis.service';

const defaultLimit = 30;
const defaultWindowSeconds = 60;

@Injectable()
export class FormSubmissionRateLimitService {
  private readonly limit: number;

  private readonly windowSeconds: number;

  public constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.limit = this.positiveInteger(config.get('FORM_SUBMISSION_RATE_LIMIT'), defaultLimit);
    this.windowSeconds = this.positiveInteger(
      config.get('FORM_SUBMISSION_RATE_WINDOW_SECONDS'),
      defaultWindowSeconds,
    );
  }

  /** Consume one fixed-window attempt for a Form and opaque caller identity. */
  public async consume(formId: string, identity: string): Promise<void> {
    const key = `form:submission-rate:${formId}:${this.digest(identity)}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, this.windowSeconds);
    if (count > this.limit) {
      throw new HttpException('Form submission rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private digest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private positiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
