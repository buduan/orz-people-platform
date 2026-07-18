import { Inject, Injectable } from '@nestjs/common';

import { JsonLogger } from '../observability/json-logger.service';

export interface OtpMessage {
  email: string;
  otp: string;
  type: string;
}

export interface OtpSender {
  send: (message: OtpMessage) => Promise<void>;
}

export const OTP_SENDER = Symbol('OTP_SENDER');

// Placeholder sender until the delivery module (task 10.x) provides a real
// mail provider. It never logs the OTP value so codes cannot leak into logs.
@Injectable()
export class LoggingOtpSender implements OtpSender {
  public constructor(@Inject(JsonLogger) private readonly logger: JsonLogger) {}

  public async send(message: OtpMessage): Promise<void> {
    this.logger.warn('OTP requested but no mail provider is configured', {
      email: message.email,
      type: message.type,
    });
  }
}
