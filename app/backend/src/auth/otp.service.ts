import { createHmac, randomInt } from 'node:crypto';

import {
  BadRequestException, HttpException, HttpStatus, Injectable,
} from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthSettingsService } from './auth-settings.service';

export type OtpPurpose = 'email_login' | 'mfa_email' | 'mfa_sms' | 'password_reset' | 'phone_binding'
| 'reauthentication' | 'registration';

interface StoredOtp {
  attempts: number;
  digest: string;
}

@Injectable()
export class OtpService {
  public constructor(
    private readonly redis: RedisService,
    private readonly settings: AuthSettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  public async requestEmail(email: string, purpose: OtpPurpose, networkContext = 'internal'): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.store(email, purpose, code, networkContext);
    await this.notifications.sendEmailVerificationCode(email, code);
  }

  public async requestSms(phone: string, purpose: OtpPurpose, networkContext = 'internal'): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.store(phone, purpose, code, networkContext);
    await this.notifications.sendSmsVerificationCode(phone, code);
  }

  public async consume(subject: string, purpose: OtpPurpose, code: string): Promise<void> {
    const key = this.key(subject, purpose);
    const result = Number(await this.redis.eval(
      `local raw = redis.call('GET', KEYS[1])
      if not raw then return -1 end
      local value = cjson.decode(raw)
      if value.digest == ARGV[1] then
        redis.call('DEL', KEYS[1])
        return 1
      end
      value.attempts = value.attempts + 1
      if value.attempts >= 5 then
        redis.call('DEL', KEYS[1])
        return -2
      end
      redis.call('SET', KEYS[1], cjson.encode(value), 'KEEPTTL')
      return 0`,
      1,
      key,
      this.digest(code),
    ));
    if (result === 1) return;
    if (result === -2) throw new HttpException('Verification attempts exceeded', HttpStatus.TOO_MANY_REQUESTS);
    throw new BadRequestException('Invalid or expired verification code');
  }

  private async store(
    subject: string,
    purpose: OtpPurpose,
    code: string,
    networkContext: string,
  ): Promise<void> {
    const rateKey = `auth:otp-rate:${this.subjectHash(subject)}:${this.subjectHash(networkContext)}`;
    const count = await this.redis.incr(rateKey);
    if (count === 1) await this.redis.expire(rateKey, 60);
    if (count > 5) throw new HttpException('Verification requests exceeded', HttpStatus.TOO_MANY_REQUESTS);
    await this.redis.set(
      this.key(subject, purpose),
      JSON.stringify({ attempts: 0, digest: this.digest(code) } satisfies StoredOtp),
      'EX',
      this.settings.otpTtlSeconds,
    );
  }

  private key(subject: string, purpose: OtpPurpose): string {
    return `auth:otp:${purpose}:${this.subjectHash(subject)}`;
  }

  private subjectHash(subject: string): string {
    return createHmac('sha256', this.settings.hmacSecret).update(subject).digest('hex');
  }

  private digest(code: string): string {
    return createHmac('sha256', this.settings.hmacSecret).update(code).digest('hex');
  }
}
