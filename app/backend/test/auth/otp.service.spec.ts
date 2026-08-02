import {
  describe, expect, it, vi,
} from 'vitest';

import { OtpService } from '../../src/auth/otp.service';

class FakeOtpRedis {
  public readonly counters = new Map<string, number>();

  public readonly values = new Map<string, string>();

  public async incr(key: string): Promise<number> {
    const value = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, value);
    return value;
  }

  public async expire(): Promise<number> {
    return 1;
  }

  public async set(key: string, value: string): Promise<'OK'> {
    this.values.set(key, value);
    return 'OK';
  }

  public async eval(_script: string, _keys: number, key: string, digest: string): Promise<number> {
    const raw = this.values.get(key);
    if (!raw) return -1;
    const stored = JSON.parse(raw) as { attempts: number; digest: string };
    if (stored.digest === digest) {
      this.values.delete(key);
      return 1;
    }
    stored.attempts += 1;
    if (stored.attempts >= 5) {
      this.values.delete(key);
      return -2;
    }
    this.values.set(key, JSON.stringify(stored));
    return 0;
  }
}

describe('OTP security state', () => {
  it('stores no raw subject in Redis keys and consumes a code only once', async () => {
    const redis = new FakeOtpRedis();
    const notifications = {
      sendEmailVerificationCode: vi.fn().mockResolvedValue(undefined),
      sendSmsVerificationCode: vi.fn().mockResolvedValue(undefined),
    };
    const service = new OtpService(
      redis as never,
      { hmacSecret: 'test-hmac', otpTtlSeconds: 600 } as never,
      notifications as never,
    );

    await service.requestEmail('user@example.com', 'email_login', '203.0.113.8');
    const code = notifications.sendEmailVerificationCode.mock.calls[0]?.[1] as string;
    const keys = [...redis.values.keys(), ...redis.counters.keys()];
    expect(keys.every((key) => !key.includes('user@example.com'))).toBe(true);
    expect(keys.every((key) => !key.includes('203.0.113.8'))).toBe(true);

    await expect(service.consume('user@example.com', 'email_login', code)).resolves.toBeUndefined();
    await expect(service.consume('user@example.com', 'email_login', code)).rejects.toThrow(
      'Invalid or expired verification code',
    );
  });
});
