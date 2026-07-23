import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createBetterAuthSecondaryStorage } from './better-auth-secondary-storage';
import { createAuth } from './create-auth';
import type { Auth } from './create-auth';
import { OTP_SENDER } from './otp-sender';
import type { OtpSender } from './otp-sender';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private authInstance?: Auth;

  public constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
  ) {}

  public get instance(): Auth {
    if (!this.authInstance) {
      throw new Error('AuthService accessed before initialization.');
    }

    return this.authInstance;
  }

  public async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
  }

  // Idempotent so the bootstrap can build the Better Auth instance before the
  // Express handler is mounted (mounting must happen before app.init()/listen()
  // so the auth routes are registered ahead of Nest's not-found handler).
  public async ensureInitialized(): Promise<Auth> {
    if (this.authInstance) {
      return this.authInstance;
    }

    const appOrigin = this.configService.getOrThrow<string>('APP_ORIGIN');

    this.authInstance = await createAuth({
      apiOrigin: this.configService.getOrThrow<string>('API_ORIGIN'),
      appOrigin,
      isProduction: this.configService.getOrThrow<string>('NODE_ENV') === 'production',
      passkeyOrigin: this.configService.getOrThrow<string>('PASSKEY_ORIGIN'),
      passkeyRpId: this.configService.getOrThrow<string>('PASSKEY_RP_ID'),
      prisma: this.prisma,
      secondaryStorage: createBetterAuthSecondaryStorage(this.redis),
      secret: this.configService.getOrThrow<string>('BETTER_AUTH_SECRET'),
      sendVerificationOtp: (message) => this.otpSender.send(message),
      trustedOrigins: [appOrigin],
    });

    return this.authInstance;
  }
}
