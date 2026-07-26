import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendEmailVerificationCode(email: string, code: string): Promise<void> {
    // Mock only: replace with a real provider before enabling email delivery in production.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendSmsVerificationCode(phone: string, code: string): Promise<void> {
    // Mock only: replace with a real provider before enabling SMS delivery in production.
  }
}
