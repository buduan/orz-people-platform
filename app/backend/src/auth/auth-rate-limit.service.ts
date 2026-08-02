import { createHmac } from 'node:crypto';

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { AuthSettingsService } from './auth-settings.service';

@Injectable()
export class AuthRateLimitService {
  public constructor(
    private readonly redis: RedisService,
    private readonly settings: AuthSettingsService,
    private readonly audit: AuditService,
  ) {}

  public async assertAllowed(subject: string, networkContext: string): Promise<void> {
    const count = Number(await this.redis.get(this.key(subject, networkContext)) ?? 0);
    if (count >= this.settings.loginMaxAttempts) throw this.rateLimitError();
  }

  public async recordFailure(subject: string, networkContext: string): Promise<void> {
    await this.incrementAndAudit(this.key(subject, networkContext), subject, 'authentication.rate_limit');
  }

  public async clear(subject: string, networkContext: string): Promise<void> {
    await this.redis.del(this.key(subject, networkContext));
  }

  public async assertDiscoveryAllowed(subject: string, networkContext: string): Promise<void> {
    const key = `auth:login-discovery:${this.digest(subject)}:${this.digest(networkContext)}`;
    await this.incrementAndAudit(key, subject, 'authentication.discovery.rate_limit');
  }

  private key(subject: string, networkContext: string): string {
    return `auth:login-fail:${this.digest(subject)}:${this.digest(networkContext)}`;
  }

  private digest(value: string): string {
    return createHmac('sha256', this.settings.hmacSecret).update(value).digest('hex');
  }

  private rateLimitError(): HttpException {
    return new HttpException('Authentication attempts exceeded', HttpStatus.TOO_MANY_REQUESTS);
  }

  /**
   * 自增 Redis 计数器、在首次访问时设置 TTL、达到阈值时记录审计日志并抛出限频异常。
   */
  private async incrementAndAudit(key: string, subject: string, action: string): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, this.settings.loginWindowSeconds);
    if (count === this.settings.loginMaxAttempts) {
      await this.audit.record({
        action,
        actorType: 'system',
        resourceType: 'authentication_subject',
        resourceId: this.digest(subject),
        result: 'denied',
      });
    }
    if (count >= this.settings.loginMaxAttempts) throw this.rateLimitError();
  }
}
