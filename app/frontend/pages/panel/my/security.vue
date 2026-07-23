<script setup lang="ts">
import type { Passkey } from '@better-auth/passkey/client';

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
  title: 'Security',
});

const auth = useAuthClient();
const session = useAuthSession();

const passkeys = ref<Passkey[]>([]);
const passkeysLoading = ref(true);
const passkeyName = ref('');
const passkeyBusy = ref(false);
const passkeyError = ref('');
const passkeyNotice = ref('');

const passwordStep = ref<'idle' | 'code'>('idle');
const passwordOtpDigits = ref<string[]>([]);
const passwordOtp = computed(() => passwordOtpDigits.value.join(''));
const newPassword = ref('');
const passwordBusy = ref(false);
const passwordError = ref('');
const passwordNotice = ref('');

async function loadPasskeys() {
  passkeysLoading.value = true;

  const { data, error } = await auth.passkey.listUserPasskeys();

  passkeysLoading.value = false;

  if (error) {
    passkeyError.value = error.message ?? 'Could not load your passkeys.';

    return;
  }

  passkeys.value = data ?? [];
}

onMounted(loadPasskeys);

async function addPasskey() {
  passkeyError.value = '';
  passkeyNotice.value = '';

  if (!passkeyName.value.trim()) {
    passkeyError.value = 'Give this passkey a name so you can recognize it later.';

    return;
  }

  passkeyBusy.value = true;

  const result = await auth.passkey.addPasskey({ name: passkeyName.value.trim() });

  passkeyBusy.value = false;

  if (result?.error) {
    passkeyError.value = result.error.message ?? 'Passkey registration was cancelled or failed.';

    return;
  }

  passkeyNotice.value = `Added passkey "${passkeyName.value.trim()}".`;
  passkeyName.value = '';
  await loadPasskeys();
}

async function removePasskey(id: string) {
  passkeyError.value = '';
  passkeyNotice.value = '';
  passkeyBusy.value = true;

  const { error } = await auth.passkey.deletePasskey({ id });

  passkeyBusy.value = false;

  if (error) {
    passkeyError.value = error.message ?? 'Could not remove that passkey.';

    return;
  }

  await loadPasskeys();
}

const accountEmail = computed(() => session.value.data?.user.email ?? '');

async function requestPasswordCode() {
  passwordError.value = '';
  passwordNotice.value = '';

  if (!accountEmail.value) {
    passwordError.value = 'Your session is still loading. Try again in a moment.';

    return;
  }

  passwordBusy.value = true;

  const { error } = await auth.forgetPassword.emailOtp({ email: accountEmail.value });

  passwordBusy.value = false;

  if (error) {
    passwordError.value = error.message ?? 'Could not send a verification code. Try again shortly.';

    return;
  }

  passwordStep.value = 'code';
  passwordNotice.value = `We sent a 6-digit code to ${accountEmail.value}. Enter it with your new password.`;
}

async function savePassword() {
  passwordError.value = '';

  if (passwordOtp.value.length !== 6) {
    passwordError.value = 'Enter the full 6-digit code.';

    return;
  }

  if (newPassword.value.length < 8) {
    passwordError.value = 'Use at least 8 characters for the password.';

    return;
  }

  passwordBusy.value = true;

  const { error } = await auth.emailOtp.resetPassword({
    email: accountEmail.value,
    otp: passwordOtp.value,
    password: newPassword.value,
  });

  passwordBusy.value = false;

  if (error) {
    passwordError.value = error.message ?? 'Could not save your password. Request a new code and try again.';
    passwordOtpDigits.value = [];

    return;
  }

  passwordNotice.value = 'Password saved. You can now sign in with it as an alternative to email codes.';
  passwordStep.value = 'idle';
  passwordOtpDigits.value = [];
  newPassword.value = '';
}

async function signOut() {
  await auth.signOut();
  await navigateTo('/login');
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <header class="animate-fade-rise">
      <h1 class="text-2xl font-bold tracking-tight text-highlighted">Security</h1>
      <p class="mt-1 text-sm text-muted">
        Signed in as
        <span class="font-medium text-highlighted">{{ session.data?.user.email }}</span>.
        Manage how you sign in.
      </p>
    </header>

    <section
      class="animate-fade-rise rounded-2xl border border-default bg-default p-6"
      style="animation-delay: 60ms"
    >
      <h2 class="text-base font-semibold text-highlighted">Password</h2>
      <p class="mt-1 text-sm text-muted">
        A password is optional. Set one if you prefer it alongside email codes and passkeys.
      </p>

      <UAlert
        v-if="passwordError"
        color="error"
        variant="subtle"
        :title="passwordError"
        class="mt-4"
      />
      <UAlert
        v-else-if="passwordNotice"
        color="primary"
        variant="subtle"
        :title="passwordNotice"
        class="mt-4"
      />

      <div v-if="passwordStep === 'idle'" class="mt-4">
        <UButton size="lg" :loading="passwordBusy" @click="requestPasswordCode">
          Set a password
        </UButton>
      </div>

      <form v-else class="mt-4 space-y-4" @submit.prevent="savePassword">
        <UFormField label="Verification code" name="passwordOtp">
          <UPinInput
            v-model="passwordOtpDigits"
            :length="6"
            otp
            size="lg"
            :disabled="passwordBusy"
          />
        </UFormField>

        <UFormField label="New password" name="password">
          <UInput
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            size="lg"
            class="w-full sm:max-w-sm"
            :disabled="passwordBusy"
          />
        </UFormField>

        <div class="flex items-center gap-3">
          <UButton type="submit" size="lg" :loading="passwordBusy">Save password</UButton>
          <button
            type="button"
            class="text-sm text-primary hover:underline"
            :disabled="passwordBusy"
            @click="requestPasswordCode"
          >
            Resend code
          </button>
        </div>
      </form>
    </section>

    <section
      class="animate-fade-rise rounded-2xl border border-default bg-default p-6"
      style="animation-delay: 120ms"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-base font-semibold text-highlighted">Passkeys</h2>
          <p class="mt-1 text-sm text-muted">
            Sign in with your device's biometrics or a security key. You can register more than one.
          </p>
        </div>
      </div>

      <UAlert
        v-if="passkeyError"
        color="error"
        variant="subtle"
        :title="passkeyError"
        class="mt-4"
      />
      <UAlert
        v-else-if="passkeyNotice"
        color="primary"
        variant="subtle"
        :title="passkeyNotice"
        class="mt-4"
      />

      <form class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end" @submit.prevent="addPasskey">
        <UFormField label="Passkey name" name="passkeyName" class="flex-1">
          <UInput
            v-model="passkeyName"
            placeholder="e.g. Work laptop"
            size="lg"
            class="w-full"
            :disabled="passkeyBusy"
          />
        </UFormField>
        <UButton
          type="submit"
          size="lg"
          color="neutral"
          variant="outline"
          icon="i-solar-shield-keyhole-line-duotone"
          :loading="passkeyBusy"
        >
          Add passkey
        </UButton>
      </form>

      <div class="mt-6">
        <div v-if="passkeysLoading" class="space-y-2" aria-hidden="true">
          <div class="h-12 rounded-xl bg-elevated" />
          <div class="h-12 rounded-xl bg-elevated" />
        </div>

        <div
          v-else-if="passkeys.length === 0"
          class="flex flex-col items-center gap-2 rounded-xl bg-elevated px-6 py-8 text-center"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-default">
            <UIcon name="i-solar-key-minimalistic-line-duotone" class="text-dimmed" />
          </div>
          <p class="text-sm font-medium text-highlighted">No passkeys yet</p>
          <p class="max-w-xs text-sm text-muted">
            Add a passkey above to sign in without waiting for an email code.
          </p>
        </div>

        <ul v-else class="divide-y divide-default rounded-xl border border-default">
          <li
            v-for="entry in passkeys"
            :key="entry.id"
            class="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ entry.name || 'Unnamed passkey' }}
              </p>
              <p class="text-xs text-muted tabular-nums">
                Added {{ new Date(entry.createdAt).toLocaleDateString() }}
              </p>
            </div>
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              :disabled="passkeyBusy"
              @click="removePasskey(entry.id)"
            >
              Remove
            </UButton>
          </li>
        </ul>
      </div>
    </section>

    <div class="animate-fade-rise" style="animation-delay: 180ms">
      <UButton color="neutral" variant="ghost" icon="i-solar-logout-line-duotone" @click="signOut">
        Sign out
      </UButton>
    </div>
  </div>
</template>
