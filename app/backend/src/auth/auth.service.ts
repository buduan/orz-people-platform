import { randomUUID } from 'node:crypto';

import {
  BadRequestException, ConflictException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { isEmail } from 'class-validator';

import {
  apiStatuses,
  type AuthCompleted,
  type AuthenticationResult,
  type LoginOptions,
  type RegistrationStarted,
  type RegistrationVerified,
} from '@orz-people-platform/types';
import {
  isE164Phone, normalizeEmail, normalizeUsername, validatePassword,
} from '@orz-people-platform/utils';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import type { PasswordLoginDto, RegistrationCompleteDto } from './auth.dto';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthSettingsService } from './auth-settings.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';
import { ReauthenticationService } from './reauthentication.service';
import { registrationUsernameCandidate } from './registration-username';

interface RegistrationFlow {
  email: string;
  verified: boolean;
}

@Injectable()
export class AuthService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly reauthentication: ReauthenticationService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly settings: AuthSettingsService,
  ) {}

  public async loginOptions(identifier: string, networkContext: string): Promise<LoginOptions> {
    const subject = this.normalizeIdentifier(identifier);
    await this.rateLimit.assertDiscoveryAllowed(subject, networkContext);
    if (await this.findByIdentifier(subject)) return { next: 'login' };
    if (isEmail(subject)) return { next: 'register', email: normalizeEmail(subject) };
    throw new BadRequestException({
      status: apiStatuses.accountNotFound,
      message: 'Account not found; use an email to register',
    });
  }

  public async startRegistration(
    email: string,
    networkContext: string,
  ): Promise<RegistrationStarted> {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const registrationId = randomUUID();
    await this.redis.set(
      this.registrationKey(registrationId),
      JSON.stringify({ email: normalizedEmail, verified: false } satisfies RegistrationFlow),
      'EX',
      this.settings.challengeTtlSeconds,
    );
    try {
      await this.otp.requestEmail(normalizedEmail, 'registration', networkContext);
    } catch (error: unknown) {
      await this.redis.del(this.registrationKey(registrationId));
      throw error;
    }
    return { registrationId, expiresIn: this.settings.challengeTtlSeconds };
  }

  public async requestRegistrationCode(
    registrationId: string,
    networkContext: string,
  ): Promise<void> {
    const flow = await this.registrationFlow(registrationId);
    if (!flow.verified) await this.otp.requestEmail(flow.email, 'registration', networkContext);
  }

  public async verifyRegistrationCode(
    registrationId: string,
    code: string,
  ): Promise<RegistrationVerified> {
    const flow = await this.registrationFlow(registrationId);
    await this.otp.consume(flow.email, 'registration', code);
    await this.redis.set(
      this.registrationKey(registrationId),
      JSON.stringify({ ...flow, verified: true } satisfies RegistrationFlow),
      'KEEPTTL',
    );
    return { verified: true };
  }

  public async completeRegistration(dto: RegistrationCompleteDto): Promise<AuthCompleted> {
    const flow = await this.registrationFlow(dto.registrationId);
    if (!flow.verified) {
      throw new BadRequestException({
        status: apiStatuses.registrationUnverified,
        message: 'Registration email is not verified',
      });
    }

    const user = dto.username
      ? await this.users.registerVerified({
        email: flow.email,
        name: dto.name,
        username: dto.username,
      })
      : await this.registerWithGeneratedUsername(flow.email, dto.name);

    await this.redis.del(this.registrationKey(dto.registrationId));
    const tokens = await this.sessions.create(user.id, user.tokenVersion, dto.deviceName);
    return this.authenticated(tokens);
  }

  public async loginWithPassword(
    dto: PasswordLoginDto,
    networkContext: string,
  ): Promise<AuthenticationResult> {
    const subject = this.normalizeIdentifier(dto.identifier);
    await this.rateLimit.assertAllowed(subject, networkContext);
    const user = await this.findByIdentifier(subject);
    if (!user?.passwordHash || user.status !== UserStatus.active
      || !await argon2.verify(user.passwordHash, dto.password)) {
      await this.rateLimit.recordFailure(subject, networkContext);
      throw new UnauthorizedException({
        status: apiStatuses.invalidCredentials,
        message: 'Invalid account or credentials',
      });
    }
    await this.rateLimit.clear(subject, networkContext);
    return this.mfa.continueOrCreateSession(user, 'password', dto.deviceName);
  }

  public async requestEmailLogin(identifier: string, networkContext: string): Promise<void> {
    const subject = this.normalizeIdentifier(identifier);
    await this.rateLimit.assertAllowed(subject, networkContext);
    const user = await this.findByIdentifier(subject);
    if (user?.status === UserStatus.active && user.emailVerifiedAt) {
      await this.otp.requestEmail(user.email, 'email_login', networkContext);
    }
  }

  public async loginWithEmailCode(
    identifier: string,
    code: string,
    networkContext: string,
    deviceName?: string,
  ): Promise<AuthCompleted> {
    const subject = this.normalizeIdentifier(identifier);
    await this.rateLimit.assertAllowed(subject, networkContext);
    const user = await this.findByIdentifier(subject);
    if (!user || user.status !== UserStatus.active || !user.emailVerifiedAt) {
      await this.rateLimit.recordFailure(subject, networkContext);
      throw new UnauthorizedException({
        status: apiStatuses.invalidCredentials,
        message: 'Invalid account or credentials',
      });
    }
    try {
      await this.otp.consume(user.email, 'email_login', code);
    } catch (error: unknown) {
      await this.rateLimit.recordFailure(subject, networkContext);
      throw error;
    }
    await this.rateLimit.clear(subject, networkContext);
    const result = await this.mfa.continueOrCreateSession(user, 'email', deviceName);
    if (result.outcome !== 'authenticated') {
      throw new UnauthorizedException('Invalid authentication state');
    }
    return result;
  }

  public async requestPhoneBinding(
    userId: string,
    phone: string,
    networkContext = 'internal',
  ): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== userId) throw new ConflictException('Phone already exists');
    await this.otp.requestSms(phone, 'phone_binding', networkContext);
  }

  public async confirmPhoneBinding(userId: string, phone: string, code: string): Promise<void> {
    await this.otp.consume(phone, 'phone_binding', code);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { phone, phoneVerifiedAt: new Date() },
      });
      await this.audit.record({
        action: 'user.phone.bind',
        actorType: 'user',
        actorUserId: userId,
        resourceType: 'user',
        resourceId: userId,
        result: 'success',
      }, tx);
    });
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!validatePassword(newPassword).valid) {
      throw new ConflictException('Password does not meet policy');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !await argon2.verify(user.passwordHash, currentPassword)) {
      throw new UnauthorizedException({
        status: apiStatuses.invalidCredentials,
        message: 'Invalid account or credentials',
      });
    }
    await this.setPassword(userId, newPassword, 'password.change', 'user');
  }

  public async verifyPassword(userId: string, password: string): Promise<void> {
    await this.reauthentication.verifyPassword(userId, password);
  }

  public async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    if (!validatePassword(newPassword).valid) {
      throw new ConflictException('Password does not meet policy');
    }
    await this.otp.consume(email, 'password_reset', code);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { email: normalizeEmail(email) },
    });
    await this.setPassword(user.id, newPassword, 'password.reset', 'system');
  }

  private async setPassword(
    userId: string,
    password: string,
    action: string,
    actorType: 'system' | 'user',
  ): Promise<void> {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordUpdatedAt: new Date(),
          tokenVersion: { increment: 1 },
        },
      });
      await this.audit.record({
        action,
        actorType,
        ...(actorType === 'user' ? { actorUserId: userId } : {}),
        resourceType: 'user',
        resourceId: userId,
        result: 'success',
      }, tx);
    });
    await this.sessions.revokeAll(userId);
  }

  private async findByIdentifier(identifier: string) {
    if (identifier.includes('@')) {
      return this.prisma.user.findUnique({ where: { email: normalizeEmail(identifier) } });
    }
    if (isE164Phone(identifier)) {
      return this.prisma.user.findFirst({
        where: { phone: identifier, phoneVerifiedAt: { not: null } },
      });
    }
    return this.prisma.user.findUnique({ where: { username: normalizeUsername(identifier) } });
  }

  private normalizeIdentifier(identifier: string): string {
    if (identifier.includes('@')) return normalizeEmail(identifier);
    if (isE164Phone(identifier)) return identifier;
    return normalizeUsername(identifier);
  }

  private authenticated(tokens: AuthCompleted['tokens']): AuthCompleted {
    return { outcome: 'authenticated', tokens };
  }

  private async registrationFlow(registrationId: string): Promise<RegistrationFlow> {
    const raw = await this.redis.get(this.registrationKey(registrationId));
    if (!raw) {
      throw new BadRequestException({
        status: apiStatuses.registrationExpired,
        message: 'Registration flow expired',
      });
    }
    return JSON.parse(raw) as RegistrationFlow;
  }

  private registrationKey(registrationId: string): string {
    return `auth:registration:${registrationId}`;
  }

  private async registerWithGeneratedUsername(email: string, name: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const username = registrationUsernameCandidate(email, attempt);
      // Sequential retries are required to choose the first available suffix.
      // eslint-disable-next-line no-await-in-loop
      const existing = await this.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!existing) {
        try {
          // eslint-disable-next-line no-await-in-loop
          return await this.users.registerVerified({ email, name, username });
        } catch (error: unknown) {
          if (!(error instanceof ConflictException)
            || error.message !== 'Username is unavailable') throw error;
        }
      }
    }
    throw new ConflictException({
      status: apiStatuses.usernameUnavailable,
      message: 'Username is unavailable',
    });
  }
}
