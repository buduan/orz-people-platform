import {
  createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID,
} from 'node:crypto';

import {
  BadRequestException, ConflictException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as OTPAuth from 'otpauth';

import type {
  AuthCompleted, AuthenticationResult, MfaFactor,
} from '@orz-people-platform/types';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthSettingsService } from './auth-settings.service';
import type { ReauthenticateDto } from './auth.dto';
import { hasViableLoginPath } from './login-path';
import { OtpService } from './otp.service';
import { ReauthenticationService } from './reauthentication.service';
import { SessionService } from './session.service';

export type AuthFactor = 'email' | 'passkey' | 'password';
interface MfaChallenge {
  allowed: MfaFactor[];
  attempts: number;
  deviceName?: string;
  primary: AuthFactor;
  tokenVersion: number;
  userId: string;
}

@Injectable()
export class MfaService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: AuthSettingsService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly reauthentication: ReauthenticationService,
    private readonly audit: AuditService,
  ) {}

  public async continueOrCreateSession(
    user: Pick<User, 'emailMfaEnabled' | 'emailVerifiedAt' | 'id' | 'phone' | 'phoneVerifiedAt' | 'smsMfaEnabled' | 'tokenVersion' | 'totpEnabledAt'>,
    primary: AuthFactor,
    deviceName?: string,
  ): Promise<AuthenticationResult> {
    if (primary !== 'password') {
      return this.authenticated(await this.sessions.create(user.id, user.tokenVersion, deviceName));
    }
    const allowed: MfaFactor[] = [];
    if (user.emailMfaEnabled && user.emailVerifiedAt) allowed.push('email');
    if (user.smsMfaEnabled && user.phone && user.phoneVerifiedAt) allowed.push('sms');
    if (user.totpEnabledAt) allowed.push('totp');
    if (await this.prisma.passkeyCredential.count({ where: { userId: user.id } })) {
      allowed.push('passkey');
    }
    if (!allowed.length) {
      return this.authenticated(await this.sessions.create(user.id, user.tokenVersion, deviceName));
    }
    const challengeId = randomUUID();
    await this.redis.set(
      this.challengeKey(challengeId),
      JSON.stringify({
        userId: user.id,
        tokenVersion: user.tokenVersion,
        primary,
        allowed,
        attempts: 0,
        ...(deviceName ? { deviceName } : {}),
      } satisfies MfaChallenge),
      'EX',
      this.settings.challengeTtlSeconds,
    );
    return {
      outcome: 'mfa_required',
      challengeId,
      factors: allowed,
      expiresIn: this.settings.challengeTtlSeconds,
    };
  }

  public async requestCode(challengeId: string, factor: 'email' | 'sms'): Promise<void> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge.allowed.includes(factor)) throw new BadRequestException('MFA factor is not available');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: challenge.userId } });
    if (user.status !== 'active' || user.tokenVersion !== challenge.tokenVersion) {
      await this.redis.del(this.challengeKey(challengeId));
      throw new UnauthorizedException('MFA challenge is no longer valid');
    }
    if (factor === 'email') await this.otp.requestEmail(user.email, 'mfa_email');
    else if (user.phone) await this.otp.requestSms(user.phone, 'mfa_sms');
  }

  public async complete(
    challengeId: string,
    factor: Exclude<MfaFactor, 'passkey'>,
    code: string,
  ): Promise<AuthCompleted> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge.allowed.includes(factor)) throw new BadRequestException('MFA factor is not available');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: challenge.userId } });
    try {
      if (factor === 'email') await this.otp.consume(user.email, 'mfa_email', code);
      else if (factor === 'sms' && user.phone) await this.otp.consume(user.phone, 'mfa_sms', code);
      else if (factor === 'totp') await this.verifyTotp(user, code);
      else throw new BadRequestException('MFA factor is not configured');
    } catch (error: unknown) {
      challenge.attempts += 1;
      if (challenge.attempts >= 5) await this.redis.del(this.challengeKey(challengeId));
      else await this.redis.set(this.challengeKey(challengeId), JSON.stringify(challenge), 'KEEPTTL');
      throw error;
    }
    await this.redis.del(this.challengeKey(challengeId));
    return this.authenticated(
      await this.sessions.create(user.id, challenge.tokenVersion, challenge.deviceName),
    );
  }

  public async passkeyUser(challengeId: string): Promise<string> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge.allowed.includes('passkey')) {
      throw new BadRequestException('MFA factor is not available');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: challenge.userId } });
    if (user.status !== 'active' || user.tokenVersion !== challenge.tokenVersion) {
      await this.redis.del(this.challengeKey(challengeId));
      throw new UnauthorizedException('MFA challenge is no longer valid');
    }
    return user.id;
  }

  public async completePasskey(challengeId: string, userId: string): Promise<AuthCompleted> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge.allowed.includes('passkey') || challenge.userId !== userId) {
      throw new UnauthorizedException('Invalid MFA Passkey');
    }
    await this.redis.del(this.challengeKey(challengeId));
    return this.authenticated(
      await this.sessions.create(userId, challenge.tokenVersion, challenge.deviceName),
    );
  }

  public settingsFor(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { emailMfaEnabled: true, smsMfaEnabled: true, totpEnabledAt: true },
    });
  }

  public async setMessageFactor(
    userId: string,
    factor: 'email' | 'sms',
    enabled: boolean,
    credential: ReauthenticateDto,
  ): Promise<void> {
    await this.reauthentication.verify(userId, credential);
    const user = await this.securityState(userId);
    if (factor === 'email' && enabled && !user.emailVerifiedAt) {
      throw new BadRequestException('Email is not verified');
    }
    if (factor === 'sms' && enabled && (!user.phone || !user.phoneVerifiedAt)) {
      throw new BadRequestException('Phone is not verified');
    }
    const state = {
      emailMfaEnabled: factor === 'email' ? enabled : user.emailMfaEnabled,
      smsMfaEnabled: factor === 'sms' ? enabled : user.smsMfaEnabled,
      totpEnabled: Boolean(user.totpEnabledAt),
      hasPassword: Boolean(user.passwordHash),
      passkeyCount: user.passkeyCount,
    };
    if (!hasViableLoginPath(state)) {
      throw new ConflictException('MFA settings would leave no viable login path');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: factor === 'email' ? { emailMfaEnabled: enabled } : { smsMfaEnabled: enabled },
      });
      await this.audit.record({
        action: `mfa.${factor}.${enabled ? 'enable' : 'disable'}`,
        actorType: 'user',
        actorUserId: userId,
        resourceType: 'user',
        resourceId: userId,
        result: 'success',
      }, tx);
    });
  }

  public async beginTotpEnrollment(
    userId: string,
    credential: ReauthenticateDto,
  ): Promise<{ secret: string; uri: string }> {
    await this.reauthentication.verify(userId, credential);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const totp = new OTPAuth.TOTP({
      issuer: this.settings.webauthnRpName,
      label: user.email,
      digits: 6,
      period: this.settings.totpPeriodSeconds,
    });
    await this.redis.set(
      this.enrollmentKey(userId),
      this.encrypt(totp.secret.base32),
      'EX',
      this.settings.challengeTtlSeconds,
    );
    return { secret: totp.secret.base32, uri: totp.toString() };
  }

  public async confirmTotpEnrollment(userId: string, token: string): Promise<void> {
    const protectedSecret = await this.redis.get(this.enrollmentKey(userId));
    const secret = protectedSecret ? this.decrypt(protectedSecret) : null;
    if (!secret || this.totp(secret).validate({ token, window: 1 }) === null) {
      throw new BadRequestException('Invalid TOTP code');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          totpSecretEncrypted: this.encrypt(secret),
          totpEnabledAt: new Date(),
          totpLastUsedStep: null,
        },
      });
      await this.audit.record({
        action: 'mfa.totp.enable',
        actorType: 'user',
        actorUserId: userId,
        resourceType: 'user',
        resourceId: userId,
        result: 'success',
      }, tx);
    });
    await this.redis.del(this.enrollmentKey(userId));
  }

  public async disableTotp(userId: string, credential: ReauthenticateDto): Promise<void> {
    await this.reauthentication.verify(userId, credential);
    const user = await this.securityState(userId);
    if (!hasViableLoginPath({
      emailMfaEnabled: user.emailMfaEnabled,
      smsMfaEnabled: user.smsMfaEnabled,
      totpEnabled: false,
      hasPassword: Boolean(user.passwordHash),
      passkeyCount: user.passkeyCount,
    })) {
      throw new ConflictException('Disabling TOTP would leave no viable login path');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { totpSecretEncrypted: null, totpEnabledAt: null, totpLastUsedStep: null },
      });
      await this.audit.record({
        action: 'mfa.totp.disable',
        actorType: 'user',
        actorUserId: userId,
        resourceType: 'user',
        resourceId: userId,
        result: 'success',
      }, tx);
    });
  }

  private async verifyTotp(user: User, token: string): Promise<void> {
    if (!user.totpSecretEncrypted) throw new BadRequestException('TOTP is not configured');
    const delta = this.totp(this.decrypt(user.totpSecretEncrypted)).validate({ token, window: 1 });
    if (delta === null) throw new UnauthorizedException('Invalid MFA code');
    const step = BigInt(Math.floor(Date.now() / (this.settings.totpPeriodSeconds * 1000)) + delta);
    const updated = await this.prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: step } }] },
      data: { totpLastUsedStep: step },
    });
    if (updated.count !== 1) throw new UnauthorizedException('MFA code was already used');
  }

  private async getChallenge(id: string): Promise<MfaChallenge> {
    const raw = await this.redis.get(this.challengeKey(id));
    if (!raw) throw new UnauthorizedException('MFA challenge expired');
    return JSON.parse(raw) as MfaChallenge;
  }

  private totp(secret: string): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      secret,
      issuer: this.settings.webauthnRpName,
      label: 'user',
      digits: 6,
      period: this.settings.totpPeriodSeconds,
    });
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
  }

  private decrypt(value: string): string {
    const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted TOTP secret');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private key(): Buffer {
    return createHash('sha256').update(this.settings.totpEncryptionKey).digest();
  }

  private challengeKey(id: string): string {
    return `auth:mfa:challenge:${id}`;
  }

  private enrollmentKey(userId: string): string {
    return `auth:totp:enroll:${userId}`;
  }

  private async securityState(userId: string) {
    const [user, passkeyCount] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.passkeyCredential.count({ where: { userId } }),
    ]);
    return { ...user, passkeyCount };
  }

  private authenticated(tokens: AuthCompleted['tokens']): AuthCompleted {
    return { outcome: 'authenticated', tokens };
  }
}
