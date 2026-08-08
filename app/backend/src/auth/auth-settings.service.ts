import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

@Injectable()
export class AuthSettingsService {
  public readonly accessTtlSeconds: number;

  public readonly audience: string;

  public readonly challengeTtlSeconds: number;

  public readonly hmacSecret: string;

  public readonly issuer: string;

  public readonly loginMaxAttempts: number;

  public readonly loginWindowSeconds: number;

  public readonly jwtSecret: string;

  public readonly otpTtlSeconds: number;

  public readonly refreshTtlSeconds: number;

  public readonly totpEncryptionKey: string;

  public readonly totpPeriodSeconds: number;

  public readonly webauthnOrigins: string[];

  public readonly webauthnRpId: string;

  public readonly webauthnRpName: string;

  public constructor(config: ConfigService) {
    this.accessTtlSeconds = positiveInteger(config.get('JWT_ACCESS_TTL_SECONDS'), 900, 'JWT_ACCESS_TTL_SECONDS');
    this.refreshTtlSeconds = positiveInteger(config.get('AUTH_REFRESH_TTL_SECONDS'), 2_592_000, 'AUTH_REFRESH_TTL_SECONDS');
    this.otpTtlSeconds = positiveInteger(config.get('AUTH_OTP_TTL_SECONDS'), 600, 'AUTH_OTP_TTL_SECONDS');
    this.challengeTtlSeconds = positiveInteger(config.get('AUTH_CHALLENGE_TTL_SECONDS'), 300, 'AUTH_CHALLENGE_TTL_SECONDS');
    this.loginMaxAttempts = positiveInteger(config.get('AUTH_LOGIN_MAX_ATTEMPTS'), 10, 'AUTH_LOGIN_MAX_ATTEMPTS');
    this.loginWindowSeconds = positiveInteger(config.get('AUTH_LOGIN_WINDOW_SECONDS'), 900, 'AUTH_LOGIN_WINDOW_SECONDS');
    this.jwtSecret = config.get('JWT_SECRET') || 'development-only-change-me-jwt-secret';
    this.hmacSecret = config.get('AUTH_HMAC_SECRET') || 'development-only-change-me-hmac-secret';
    this.totpEncryptionKey = config.get('TOTP_ENCRYPTION_KEY') || 'development-only-change-me-totp-key';
    this.totpPeriodSeconds = positiveInteger(config.get('TOTP_PERIOD_SECONDS'), 30, 'TOTP_PERIOD_SECONDS');
    this.issuer = config.get('JWT_ISSUER') || 'weave';
    this.audience = config.get('JWT_AUDIENCE') || 'weave-api';
    this.webauthnRpId = config.get('WEBAUTHN_RP_ID') || 'localhost';
    this.webauthnRpName = config.get('WEBAUTHN_RP_NAME') || 'Orz People Platform';
    this.webauthnOrigins = (config.get<string>('WEBAUTHN_ORIGINS') || 'http://localhost:6771')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (config.get('NODE_ENV') === 'production') {
      const requiredTtlSettings = [
        'JWT_ACCESS_TTL_SECONDS',
        'AUTH_REFRESH_TTL_SECONDS',
        'AUTH_OTP_TTL_SECONDS',
        'AUTH_CHALLENGE_TTL_SECONDS',
        'TOTP_PERIOD_SECONDS',
      ];
      if (requiredTtlSettings.some((name) => !config.get(name))) {
        throw new Error('Authentication TTL settings must be explicit in production');
      }
      const unsafeSecrets = [this.jwtSecret, this.hmacSecret, this.totpEncryptionKey]
        .some((value) => value.startsWith('development-only-'));
      if (unsafeSecrets) throw new Error('JWT_SECRET, AUTH_HMAC_SECRET and TOTP_ENCRYPTION_KEY are required in production');
      if (this.webauthnOrigins.some((origin) => !origin.startsWith('https://'))) {
        throw new Error('WEBAUTHN_ORIGINS must use HTTPS in production');
      }
    }
  }
}
