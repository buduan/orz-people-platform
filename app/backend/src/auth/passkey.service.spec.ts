import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import { PasskeyService } from './passkey.service';

const webauthn = vi.hoisted(() => ({
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock('@simplewebauthn/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('@simplewebauthn/server')>(),
  generateAuthenticationOptions: webauthn.generateAuthenticationOptions,
  verifyAuthenticationResponse: webauthn.verifyAuthenticationResponse,
}));

class FakePasskeyRedis {
  public readonly values = new Map<string, string>();

  public async set(key: string, value: string): Promise<'OK'> {
    this.values.set(key, value);
    return 'OK';
  }

  public async getdel(key: string): Promise<string | null> {
    const value = this.values.get(key) ?? null;
    this.values.delete(key);
    return value;
  }
}

const response = {
  id: 'credential-1',
  rawId: 'credential-1',
  response: {
    authenticatorData: 'authenticator-data',
    clientDataJSON: 'client-data',
    signature: 'signature',
    userHandle: Buffer.from('user-1').toString('base64url'),
  },
  type: 'public-key',
  clientExtensionResults: {},
  authenticatorAttachment: 'platform',
} as const;

function createFixture(updateCount = 1, credentialUserId = 'user-1') {
  const redis = new FakePasskeyRedis();
  const user = {
    id: credentialUserId,
    email: `${credentialUserId}@example.com`,
    status: 'active',
    tokenVersion: 1,
  };
  const prisma = {
    passkeyCredential: {
      findMany: vi.fn().mockResolvedValue([{
        credentialId: 'credential-1',
        transports: ['internal'],
      }]),
      findUnique: vi.fn().mockResolvedValue({
        id: 'passkey-1',
        userId: credentialUserId,
        credentialId: 'credential-1',
        publicKey: Buffer.from('public-key'),
        counter: 1n,
        transports: ['internal'],
        user,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
  };
  const authenticated = {
    outcome: 'authenticated',
    tokens: {
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresIn: 900,
    },
  } as const;
  const mfa = {
    continueOrCreateSession: vi.fn().mockResolvedValue(authenticated),
    passkeyUser: vi.fn().mockResolvedValue('user-1'),
    completePasskey: vi.fn().mockResolvedValue(authenticated),
  };
  const service = new PasskeyService(
    prisma as never,
    redis as never,
    {
      challengeTtlSeconds: 300,
      webauthnOrigins: ['https://example.com'],
      webauthnRpId: 'example.com',
    } as never,
    mfa as never,
    { record: vi.fn().mockResolvedValue(undefined) } as never,
    {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
    } as never,
  );
  return {
    mfa, prisma, redis, service,
  };
}

describe('Passkey authentication security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webauthn.generateAuthenticationOptions.mockResolvedValue({ challenge: 'challenge' });
    webauthn.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 2,
        credentialBackedUp: false,
        credentialDeviceType: 'singleDevice',
      },
    });
  });

  it('lets a direct Passkey primary login create a Session without MFA', async () => {
    const { mfa, service } = createFixture();
    const { challengeId } = await service.authenticationOptions();

    await expect(service.verifyAuthentication(challengeId, response as never, 'network'))
      .resolves.toMatchObject({ outcome: 'authenticated' });
    expect(mfa.continueOrCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      'passkey',
      undefined,
    );
  });

  it('consumes an assertion challenge once', async () => {
    const { service } = createFixture();
    const { challengeId } = await service.authenticationOptions();

    await service.verifyAuthentication(challengeId, response as never, 'network');
    await expect(service.verifyAuthentication(challengeId, response as never, 'network'))
      .rejects.toThrow('Passkey challenge expired');
  });

  it('rejects a Passkey belonging to a different MFA user', async () => {
    const { mfa, service } = createFixture(1, 'user-2');
    const { assertionId } = await service.mfaAuthenticationOptions('mfa-1');

    await expect(service.verifyMfaAuthentication('mfa-1', assertionId, response as never))
      .rejects.toThrow('Invalid account or credentials');
    expect(mfa.completePasskey).not.toHaveBeenCalled();
  });

  it('rejects a replay when the stored signature counter changed concurrently', async () => {
    const { service } = createFixture(0);
    const { challengeId } = await service.authenticationOptions();

    await expect(service.verifyAuthentication(challengeId, response as never, 'network'))
      .rejects.toThrow('Invalid account or credentials');
  });
});
