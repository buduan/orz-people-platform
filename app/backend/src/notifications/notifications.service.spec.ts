import {
  describe, expect, it, vi,
} from 'vitest';

import { NotificationsService } from './notifications.service';

describe('mock notifications', () => {
  it('does not return or log email and SMS verification codes', async () => {
    const logs = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    const service = new NotificationsService();

    await expect(service.sendEmailVerificationCode('user@example.com', '123456'))
      .resolves.toBeUndefined();
    await expect(service.sendSmsVerificationCode('+8613812345678', '654321'))
      .resolves.toBeUndefined();
    logs.forEach((logger) => expect(logger).not.toHaveBeenCalled());
    logs.forEach((logger) => logger.mockRestore());
  });
});
