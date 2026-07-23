import type { PrismaClient } from '@prisma/client';

import type { BetterAuthSecondaryStorage } from './better-auth-secondary-storage';

// Better Auth's inferred instance type leaks a non-portable Zod internal
// (`zod/v4/core#$strip`) under Node16 CommonJS resolution, so the full type
// cannot be named at the module boundary. The app only consumes the auth
// instance through the web `handler` (for toNodeHandler) and `api.getSession`
// (for the auth guard), so we expose a minimal structural type and cast once
// where the concrete instance is constructed.
export interface AuthSessionResult {
  session: { id: string; userId: string; token: string };
  user: { id: string; email: string; emailVerified: boolean; name: string };
}

export interface Auth {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (input: { headers: Headers }) => Promise<AuthSessionResult | null>;
  };
}

export const OTP_EXPIRES_IN_SECONDS = 300;
export const OTP_ALLOWED_ATTEMPTS = 3;
const OTP_SEND_WINDOW_SECONDS = 60;
const OTP_SEND_MAX = 3;
const GLOBAL_RATE_LIMIT_WINDOW_SECONDS = 60;
const GLOBAL_RATE_LIMIT_MAX = 100;

export interface AuthDependencies {
  apiOrigin: string;
  appOrigin: string;
  isProduction: boolean;
  passkeyOrigin: string;
  passkeyRpId: string;
  prisma: PrismaClient;
  secondaryStorage: BetterAuthSecondaryStorage;
  secret: string;
  sendVerificationOtp: (input: { email: string; otp: string; type: string }) => Promise<void>;
  trustedOrigins: string[];
}

// Better Auth and its plugins are ESM-only; the backend compiles to CommonJS,
// so they are loaded with dynamic import (same pattern as mountBetterAuthHandler).
export async function createAuth(dependencies: AuthDependencies): Promise<Auth> {
  const [
    { betterAuth },
    { prismaAdapter },
    { admin, emailOTP },
    { passkey },
  ] = await Promise.all([
    import('better-auth'),
    import('better-auth/adapters/prisma'),
    import('better-auth/plugins'),
    import('@better-auth/passkey'),
  ]);

  const auth = betterAuth({
    advanced: {
      // Keep CSRF and origin checks on for direct cross-origin API requests.
      disableCSRFCheck: false,
      disableOriginCheck: false,
      ipAddress: {
        // Trust only the proxy-set forwarding header; do not trust arbitrary
        // client headers for rate-limit identity.
        ipAddressHeaders: ['x-forwarded-for'],
      },
      useSecureCookies: dependencies.isProduction,
    },
    appName: 'Orz People Platform',
    baseURL: dependencies.apiOrigin,
    database: prismaAdapter(dependencies.prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      // Password is optional per user; accounts can exist with OTP only.
      enabled: true,
    },
    plugins: [
      emailOTP({
        allowedAttempts: OTP_ALLOWED_ATTEMPTS,
        expiresIn: OTP_EXPIRES_IN_SECONDS,
        sendVerificationOTP: async ({ email, otp, type }) => {
          await dependencies.sendVerificationOtp({ email, otp, type });
        },
        storeOTP: 'hashed',
      }),
      passkey({
        origin: dependencies.passkeyOrigin,
        rpID: dependencies.passkeyRpId,
        rpName: 'Orz People Platform',
      }),
      admin(),
    ],
    rateLimit: {
      customRules: {
        '/email-otp/send-verification-otp': {
          max: OTP_SEND_MAX,
          window: OTP_SEND_WINDOW_SECONDS,
        },
      },
      enabled: true,
      max: GLOBAL_RATE_LIMIT_MAX,
      storage: 'secondary-storage',
      window: GLOBAL_RATE_LIMIT_WINDOW_SECONDS,
    },
    secondaryStorage: dependencies.secondaryStorage,
    secret: dependencies.secret,
    telemetry: { enabled: false },
    trustedOrigins: dependencies.trustedOrigins,
  });

  return auth as unknown as Auth;
}
