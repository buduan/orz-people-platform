import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MemberStatus, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import type { AuthTokens } from '@orz-people-platform/types';
import {
  isE164Phone, normalizeEmail, normalizeUsername, validatePassword,
} from '@orz-people-platform/utils';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { PasswordLoginDto, RegisterDto } from './auth.dto';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { MfaService, type MfaRequired } from './mfa.service';
import { ReauthenticationService } from './reauthentication.service';

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
  ) {}

  public async register(dto: RegisterDto, networkContext = 'internal'): Promise<{ accepted: true }> {
    await this.users.create(dto);
    await this.otp.requestEmail(dto.email, 'registration', networkContext);
    return { accepted: true };
  }

  public async confirmRegistration(email: string, code: string): Promise<void> {
    await this.otp.consume(email, 'registration', code);
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { email },
        data: { emailVerifiedAt: new Date(), status: UserStatus.active },
      });
      await tx.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: WorkspacesService.DEFAULT_ID,
            userId: user.id,
          },
        },
        data: { status: MemberStatus.active, joinedAt: new Date() },
      });
      await this.audit.record({
        action: 'user.registration.confirm',
        actorType: 'system',
        resourceType: 'user',
        resourceId: user.id,
        result: 'success',
        workspaceId: WorkspacesService.DEFAULT_ID,
      }, tx);
    });
  }

  public async loginWithPassword(
    dto: PasswordLoginDto,
    networkContext: string,
  ): Promise<AuthTokens | MfaRequired> {
    const subject = this.normalizeIdentifier(dto.identifier);
    await this.rateLimit.assertAllowed(subject, networkContext);
    const user = await this.findByIdentifier(subject);
    if (!user?.passwordHash || user.status !== UserStatus.active
      || !await argon2.verify(user.passwordHash, dto.password)) {
      await this.rateLimit.recordFailure(subject, networkContext);
      throw new UnauthorizedException('Invalid account or credentials');
    }
    await this.rateLimit.clear(subject, networkContext);
    return this.mfa.continueOrCreateSession(user, 'password', dto.deviceName);
  }

  public async loginWithEmailCode(
    email: string,
    code: string,
    networkContext: string,
  ): Promise<AuthTokens | MfaRequired> {
    const subject = normalizeEmail(email);
    await this.rateLimit.assertAllowed(subject, networkContext);
    try {
      await this.otp.consume(subject, 'email_login', code);
    } catch (error: unknown) {
      await this.rateLimit.recordFailure(subject, networkContext);
      throw error;
    }
    const user = await this.prisma.user.findUnique({ where: { email: subject } });
    if (!user || user.status !== UserStatus.active) {
      await this.rateLimit.recordFailure(subject, networkContext);
      throw new UnauthorizedException('Invalid account or credentials');
    }
    await this.rateLimit.clear(subject, networkContext);
    return this.mfa.continueOrCreateSession(user, 'email');
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
      throw new UnauthorizedException('Invalid account or credentials');
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
}
