import { randomUUID } from 'node:crypto';
import { TextEncoder } from 'node:util';

import {
  BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

import type { AuthTokens } from '@orz-people-platform/types';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthSettingsService } from './auth-settings.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { hasViableLoginPath } from './login-path';
import { MfaService, type MfaRequired } from './mfa.service';

interface PasskeyChallenge {
  challenge: string;
  kind: 'authentication' | 'registration';
  userId?: string;
}

@Injectable()
export class PasskeyService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: AuthSettingsService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  public async registrationOptions(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { passkeys: { select: { credentialId: true, transports: true } } },
    });
    const options = await generateRegistrationOptions({
      rpID: this.settings.webauthnRpId,
      rpName: this.settings.webauthnRpName,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.nickname,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: user.passkeys.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as AuthenticatorTransportFuture[],
      })),
    });
    const challengeId = await this.storeChallenge({
      challenge: options.challenge,
      kind: 'registration',
      userId,
    });
    return { challengeId, options };
  }

  public async verifyRegistration(
    userId: string,
    challengeId: string,
    response: RegistrationResponseJSON,
  ): Promise<{ id: string; createdAt: Date }> {
    const challenge = await this.consumeChallenge(challengeId, 'registration');
    if (challenge.userId !== userId) throw new UnauthorizedException('Passkey challenge does not belong to this user');
    try {
      const result = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.settings.webauthnOrigins,
        expectedRPID: this.settings.webauthnRpId,
        requireUserVerification: true,
      });
      if (!result.verified) throw new BadRequestException('Passkey registration could not be verified');
      const { credential, credentialBackedUp, credentialDeviceType } = result.registrationInfo;
      const created = await this.prisma.passkeyCredential.create({
        data: {
          userId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports ?? response.response.transports ?? [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
        },
        select: { id: true, createdAt: true },
      });
      await this.audit.record({
        action: 'passkey.create',
        actorType: 'user',
        actorUserId: userId,
        resourceType: 'passkey',
        resourceId: created.id,
        result: 'success',
      });
      return created;
    } catch (error: unknown) {
      await this.audit.record({
        action: 'passkey.create',
        actorType: 'user',
        actorUserId: userId,
        resourceType: 'passkey',
        result: 'failure',
      });
      if (error instanceof BadRequestException || error instanceof ConflictException) throw error;
      throw new BadRequestException('Passkey registration could not be verified');
    }
  }

  public async authenticationOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.settings.webauthnRpId,
      userVerification: 'required',
    });
    const challengeId = await this.storeChallenge({ challenge: options.challenge, kind: 'authentication' });
    return { challengeId, options };
  }

  public async verifyAuthentication(
    challengeId: string,
    response: AuthenticationResponseJSON,
    networkContext: string,
    deviceName?: string,
  ): Promise<AuthTokens | MfaRequired> {
    await this.rateLimit.assertAllowed(response.id, networkContext);
    const challenge = await this.consumeChallenge(challengeId, 'authentication');
    const passkey = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: response.id },
      include: { user: true },
    });
    if (!passkey || passkey.user.status !== 'active') {
      await this.rateLimit.recordFailure(response.id, networkContext);
      throw new UnauthorizedException('Invalid account or credentials');
    }
    if (response.response.userHandle
      && Buffer.from(response.response.userHandle, 'base64url').toString('utf8') !== passkey.userId) {
      throw new UnauthorizedException('Invalid account or credentials');
    }
    try {
      const result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.settings.webauthnOrigins,
        expectedRPID: this.settings.webauthnRpId,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: Number(passkey.counter),
          transports: passkey.transports as AuthenticatorTransportFuture[],
        },
        requireUserVerification: true,
      });
      if (!result.verified) throw new UnauthorizedException('Invalid account or credentials');
      const updated = await this.prisma.passkeyCredential.updateMany({
        where: { id: passkey.id, counter: passkey.counter },
        data: {
          counter: BigInt(result.authenticationInfo.newCounter),
          backedUp: result.authenticationInfo.credentialBackedUp,
          deviceType: result.authenticationInfo.credentialDeviceType,
        },
      });
      if (updated.count !== 1) throw new UnauthorizedException('Invalid account or credentials');
      await this.rateLimit.clear(response.id, networkContext);
      return await this.mfa.continueOrCreateSession(passkey.user, 'passkey', deviceName);
    } catch (error: unknown) {
      await this.audit.record({
        action: 'passkey.authenticate',
        actorType: 'system',
        resourceType: 'passkey',
        resourceId: passkey.id,
        result: 'failure',
      });
      await this.rateLimit.recordFailure(response.id, networkContext);
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid account or credentials');
    }
  }

  public list(userId: string) {
    return this.prisma.passkeyCredential.findMany({
      where: { userId },
      select: {
        id: true,
        backedUp: true,
        createdAt: true,
        deviceType: true,
        transports: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async remove(userId: string, id: string): Promise<void> {
    const [credential, user, passkeyCount] = await Promise.all([
      this.prisma.passkeyCredential.findUnique({ where: { id } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.passkeyCredential.count({ where: { userId } }),
    ]);
    if (!credential || credential.userId !== userId) throw new NotFoundException('Passkey not found');
    if (!hasViableLoginPath({
      emailMfaEnabled: user.emailMfaEnabled,
      hasPassword: Boolean(user.passwordHash),
      passkeyCount: passkeyCount - 1,
      smsMfaEnabled: user.smsMfaEnabled,
      totpEnabled: Boolean(user.totpEnabledAt),
    })) {
      throw new ConflictException('Removing this Passkey would leave no viable login path');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.passkeyCredential.delete({ where: { id } });
      await this.audit.record({
        action: 'passkey.remove',
        actorType: 'user',
        actorUserId: userId,
        resourceType: 'passkey',
        resourceId: id,
        result: 'success',
      }, tx);
    });
  }

  private async storeChallenge(challenge: PasskeyChallenge): Promise<string> {
    const id = randomUUID();
    await this.redis.set(
      this.challengeKey(id),
      JSON.stringify(challenge),
      'EX',
      this.settings.challengeTtlSeconds,
    );
    return id;
  }

  private async consumeChallenge(id: string, kind: PasskeyChallenge['kind']): Promise<PasskeyChallenge> {
    const raw = await this.redis.getdel(this.challengeKey(id));
    if (!raw) throw new UnauthorizedException('Passkey challenge expired');
    const challenge = JSON.parse(raw) as PasskeyChallenge;
    if (challenge.kind !== kind) throw new UnauthorizedException('Invalid Passkey challenge');
    return challenge;
  }

  private challengeKey(id: string): string {
    return `auth:passkey:challenge:${id}`;
  }
}
