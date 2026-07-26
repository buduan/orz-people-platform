import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service';
import type { ReauthenticateDto } from './auth.dto';
import { OtpService } from './otp.service';

@Injectable()
export class ReauthenticationService {
  public constructor(private readonly prisma: PrismaService, private readonly otp: OtpService) {}

  public async requestEmailCode(userId: string, networkContext = 'internal'): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.emailVerifiedAt) throw new BadRequestException('Email is not verified');
    await this.otp.requestEmail(user.email, 'reauthentication', networkContext);
  }

  public async verify(userId: string, credential: ReauthenticateDto): Promise<void> {
    const methods = Number(Boolean(credential.password)) + Number(Boolean(credential.emailCode));
    if (methods !== 1) throw new BadRequestException('Provide exactly one re-authentication credential');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (credential.password) {
      if (!user.passwordHash || !await argon2.verify(user.passwordHash, credential.password)) {
        throw new UnauthorizedException('Re-authentication failed');
      }
      return;
    }
    if (!user.emailVerifiedAt || !credential.emailCode) throw new UnauthorizedException('Re-authentication failed');
    await this.otp.consume(user.email, 'reauthentication', credential.emailCode);
  }

  public async verifyPassword(userId: string, password: string): Promise<void> {
    await this.verify(userId, { password });
  }
}
