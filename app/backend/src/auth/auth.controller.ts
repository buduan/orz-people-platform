import {
  Body, Controller, Delete, Get, Headers, Ip, Param, Post, Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedActor } from '@orz-people-platform/types';

import { CurrentActor, Public } from '../authorization/authorization.decorators';
import { AuditService } from '../audit/audit.service';
import {
  EmailCodeDto,
  EmailDto,
  PasswordChangeDto,
  PasswordLoginDto,
  PasswordResetDto,
  MfaCodeRequestDto,
  MfaCompleteDto,
  MfaSettingDto,
  PasskeyAuthenticationVerifyDto,
  PasskeyRegistrationVerifyDto,
  PhoneCodeConfirmDto,
  PhoneCodeRequestDto,
  ReauthenticateDto,
  RegisterDto,
  TotpCodeDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';
import { PasskeyService } from './passkey.service';
import { ReauthenticationService } from './reauthentication.service';

function bearer(header?: string): string {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : '';
}

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  public constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly passkeys: PasskeyService,
    private readonly reauthentication: ReauthenticationService,
    private readonly audit: AuditService,
  ) {}

  @Post('register')
  @Public()
  public register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.auth.register(dto, ip);
  }

  @Post('register/confirm')
  @Public()
  public async confirmRegistration(@Body() dto: EmailCodeDto) {
    await this.auth.confirmRegistration(dto.email, dto.code);
    return { accepted: true };
  }

  @Post('login/password')
  @Public()
  public loginWithPassword(@Body() dto: PasswordLoginDto, @Ip() ip: string) {
    return this.auth.loginWithPassword(dto, ip);
  }

  @Post('login/email/request')
  @Public()
  public async requestEmailLogin(@Body() dto: EmailDto, @Ip() ip: string) {
    await this.otp.requestEmail(dto.email, 'email_login', ip);
    return { accepted: true };
  }

  @Post('login/email')
  @Public()
  public loginWithEmail(@Body() dto: EmailCodeDto, @Ip() ip: string) {
    return this.auth.loginWithEmailCode(dto.email, dto.code, ip);
  }

  @Post('token/refresh')
  @Public()
  public refresh(@Headers('authorization') authorization?: string) {
    return this.sessions.refresh(bearer(authorization));
  }

  @Post('logout')
  @ApiBearerAuth()
  public async logout(@CurrentActor() actor: AuthenticatedActor) {
    await this.sessions.revoke(actor.sessionId, actor.userId);
    await this.audit.record({
      action: 'session.revoke',
      actorType: 'user',
      actorUserId: actor.userId,
      resourceType: 'session',
      resourceId: actor.sessionId,
      result: 'success',
    });
    return { accepted: true };
  }

  @Post('logout-all')
  @ApiBearerAuth()
  public async logoutAll(@CurrentActor() actor: AuthenticatedActor) {
    await this.sessions.revokeAll(actor.userId);
    await this.audit.record({
      action: 'session.revoke_all',
      actorType: 'user',
      actorUserId: actor.userId,
      resourceType: 'user',
      resourceId: actor.userId,
      result: 'success',
    });
    return { accepted: true };
  }

  @Get('sessions')
  @ApiBearerAuth()
  public sessionsForUser(@CurrentActor() actor: AuthenticatedActor) {
    return this.sessions.list(actor.userId);
  }

  @Post('password/change')
  @ApiBearerAuth()
  public async changePassword(
  @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: PasswordChangeDto,
  ) {
    await this.auth.changePassword(actor.userId, dto.currentPassword, dto.newPassword);
    return { accepted: true };
  }

  @Post('password/reset/request')
  @Public()
  public async requestPasswordReset(@Body() dto: EmailDto, @Ip() ip: string) {
    await this.otp.requestEmail(dto.email, 'password_reset', ip);
    return { accepted: true };
  }

  @Post('password/reset')
  @Public()
  public async resetPassword(@Body() dto: PasswordResetDto) {
    await this.auth.resetPassword(dto.email, dto.code, dto.newPassword);
    return { accepted: true };
  }

  @Post('reauthentication/email/request')
  @ApiBearerAuth()
  public async requestReauthenticationCode(
  @CurrentActor() actor: AuthenticatedActor,
    @Ip() ip: string,
  ) {
    await this.reauthentication.requestEmailCode(actor.userId, ip);
    return { accepted: true };
  }

  @Post('mfa/code/request')
  @Public()
  public async requestMfaCode(@Body() dto: MfaCodeRequestDto) {
    await this.mfa.requestCode(dto.challengeId, dto.factor);
    return { accepted: true };
  }

  @Post('mfa/complete')
  @Public()
  public completeMfa(@Body() dto: MfaCompleteDto) {
    return this.mfa.complete(dto.challengeId, dto.factor, dto.code);
  }

  @Get('mfa/settings')
  @ApiBearerAuth()
  public mfaSettings(@CurrentActor() actor: AuthenticatedActor) {
    return this.mfa.settingsFor(actor.userId);
  }

  @Put('mfa/email')
  @ApiBearerAuth()
  public async setEmailMfa(@CurrentActor() actor: AuthenticatedActor, @Body() dto: MfaSettingDto) {
    await this.mfa.setMessageFactor(actor.userId, 'email', dto.enabled, dto);
    return { accepted: true };
  }

  @Put('mfa/sms')
  @ApiBearerAuth()
  public async setSmsMfa(@CurrentActor() actor: AuthenticatedActor, @Body() dto: MfaSettingDto) {
    await this.mfa.setMessageFactor(actor.userId, 'sms', dto.enabled, dto);
    return { accepted: true };
  }

  @Post('mfa/totp/enroll')
  @ApiBearerAuth()
  public beginTotp(@CurrentActor() actor: AuthenticatedActor, @Body() dto: ReauthenticateDto) {
    return this.mfa.beginTotpEnrollment(actor.userId, dto);
  }

  @Post('mfa/totp/confirm')
  @ApiBearerAuth()
  public async confirmTotp(@CurrentActor() actor: AuthenticatedActor, @Body() dto: TotpCodeDto) {
    await this.mfa.confirmTotpEnrollment(actor.userId, dto.code);
    return { accepted: true };
  }

  @Delete('mfa/totp')
  @ApiBearerAuth()
  public async disableTotp(
  @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: ReauthenticateDto,
  ) {
    await this.mfa.disableTotp(actor.userId, dto);
    return { accepted: true };
  }

  @Post('passkeys/registration/options')
  @ApiBearerAuth()
  public passkeyRegistrationOptions(@CurrentActor() actor: AuthenticatedActor) {
    return this.passkeys.registrationOptions(actor.userId);
  }

  @Post('passkeys/registration/verify')
  @ApiBearerAuth()
  public verifyPasskeyRegistration(
  @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: PasskeyRegistrationVerifyDto,
  ) {
    return this.passkeys.verifyRegistration(actor.userId, dto.challengeId, dto.response);
  }

  @Post('login/passkey/options')
  @Public()
  public passkeyAuthenticationOptions() {
    return this.passkeys.authenticationOptions();
  }

  @Post('login/passkey')
  @Public()
  public verifyPasskeyAuthentication(
  @Body() dto: PasskeyAuthenticationVerifyDto,
    @Ip() ip: string,
  ) {
    return this.passkeys.verifyAuthentication(dto.challengeId, dto.response, ip, dto.deviceName);
  }

  @Get('passkeys')
  @ApiBearerAuth()
  public listPasskeys(@CurrentActor() actor: AuthenticatedActor) {
    return this.passkeys.list(actor.userId);
  }

  @Delete('passkeys/:id')
  @ApiBearerAuth()
  public async removePasskey(@CurrentActor() actor: AuthenticatedActor, @Param('id') id: string) {
    await this.passkeys.remove(actor.userId, id);
    return { accepted: true };
  }

  @Post('phone/request')
  @ApiBearerAuth()
  public async requestPhone(
  @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: PhoneCodeRequestDto,
    @Ip() ip: string,
  ) {
    await this.auth.requestPhoneBinding(actor.userId, dto.phone, ip);
    return { accepted: true };
  }

  @Post('phone/confirm')
  @ApiBearerAuth()
  public async confirmPhone(
  @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: PhoneCodeConfirmDto,
  ) {
    await this.auth.confirmPhoneBinding(actor.userId, dto.phone, dto.code);
    return { accepted: true };
  }
}
