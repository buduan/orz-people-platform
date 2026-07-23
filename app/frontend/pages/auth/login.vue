<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const auth = useAuthClient();
const session = useAuthSession();
const route = useRoute();

type Step = 'email' | 'credential';
type Method = 'password' | 'otp';

const step = ref<Step>('email');
const method = ref<Method>('password');
const email = ref('');
const password = ref('');
const otpDigits = ref<string[]>([]);
const otp = computed(() => otpDigits.value.join(''));
const pending = ref(false);
const errorMessage = ref('');
const notice = ref('');

const redirectTarget = computed(() => {
  const target = route.query.redirect;

  return typeof target === 'string' && target.startsWith('/') ? target : '/panel';
});

watchEffect(() => {
  if (session.value.data) {
    navigateTo(redirectTarget.value);
  }
});

function resetMessages() {
  errorMessage.value = '';
  notice.value = '';
}

// Step 1 — verify the email is well-formed, then move to credential entry.
function continueWithEmail() {
  resetMessages();

  const value = email.value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errorMessage.value = 'Enter a valid email address to continue.';

    return;
  }

  email.value = value;
  step.value = 'credential';
  method.value = 'password';
}

async function sendOtp() {
  resetMessages();
  pending.value = true;

  const { error } = await auth.emailOtp.sendVerificationOtp({
    email: email.value,
    type: 'sign-in',
  });

  pending.value = false;

  if (error) {
    errorMessage.value = error.message ?? 'We could not send a code. Try again in a moment.';

    return;
  }

  notice.value = `We sent a 6-digit code to ${email.value}. It expires in 5 minutes.`;
}

// Switch to the email-code method, sending the first code on entry.
async function useOtpMethod() {
  method.value = 'otp';
  otpDigits.value = [];
  await sendOtp();
}

function usePasswordMethod() {
  method.value = 'password';
  resetMessages();
}

async function signInWithPassword() {
  resetMessages();

  if (!password.value) {
    errorMessage.value = 'Enter your password, or sign in with an email code instead.';

    return;
  }

  pending.value = true;

  const { error } = await auth.signIn.email({ email: email.value, password: password.value });

  pending.value = false;

  if (error) {
    errorMessage.value =
      error.message ?? 'That email and password did not match. Try again or use an email code.';
    password.value = '';
  }
}

async function verifyOtp() {
  resetMessages();

  if (otp.value.length !== 6) {
    errorMessage.value = 'Enter the full 6-digit code.';

    return;
  }

  pending.value = true;

  const { error } = await auth.signIn.emailOtp({ email: email.value, otp: otp.value });

  pending.value = false;

  if (error) {
    errorMessage.value = error.message ?? 'That code was not accepted. Request a new one and try again.';
    otpDigits.value = [];
  }
}

async function signInWithPasskey() {
  resetMessages();
  pending.value = true;

  const result = await auth.signIn.passkey();

  pending.value = false;

  if (result?.error) {
    errorMessage.value =
      result.error.message ?? 'Passkey sign-in was cancelled or failed. Try another method.';
  }
}

function editEmail() {
  step.value = 'email';
  password.value = '';
  otpDigits.value = [];
  resetMessages();
}
</script>

<template>
  <div class="animate-fade-rise">
    <div class="mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-highlighted">
        {{ step === 'email' ? 'Sign in' : 'Welcome back' }}
      </h1>
      <p class="mt-1.5 text-sm leading-6 text-muted">
        <template v-if="step === 'email'">
          Enter your email to continue. New addresses create an account automatically.
        </template>
        <template v-else>
          Signing in as
          <button
            type="button"
            class="font-medium text-primary hover:underline"
            :disabled="pending"
            @click="editEmail"
          >
            {{ email }}
          </button>
        </template>
      </p>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
      class="mb-4"
    />
    <UAlert
      v-else-if="notice"
      color="primary"
      variant="subtle"
      :title="notice"
      class="mb-4"
    />

    <!-- Step 1: email -->
    <form v-if="step === 'email'" class="space-y-4" @submit.prevent="continueWithEmail">
      <UFormField label="Email" name="email">
        <UInput
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          size="lg"
          class="w-full"
          :disabled="pending"
          autofocus
        />
      </UFormField>

      <UButton type="submit" block size="lg" trailing-icon="i-solar-arrow-right-line-duotone">
        Continue
      </UButton>

      <div class="flex items-center gap-3 py-1">
        <span class="h-px flex-1 bg-default" />
        <span class="text-xs text-dimmed">or</span>
        <span class="h-px flex-1 bg-default" />
      </div>

      <UButton
        type="button"
        block
        size="lg"
        color="neutral"
        variant="outline"
        icon="i-solar-shield-keyhole-line-duotone"
        :disabled="pending"
        @click="signInWithPasskey"
      >
        Sign in with a passkey
      </UButton>
    </form>

    <!-- Step 2: credential -->
    <div v-else class="space-y-5">
      <!-- Method switch -->
      <div class="inline-flex rounded-lg bg-elevated p-1 text-sm font-medium">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 transition-colors"
          :class="method === 'password' ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-highlighted'"
          :disabled="pending"
          @click="usePasswordMethod"
        >
          Password
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 transition-colors"
          :class="method === 'otp' ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-highlighted'"
          :disabled="pending"
          @click="useOtpMethod"
        >
          Email code
        </button>
      </div>

      <!-- Password method -->
      <form v-if="method === 'password'" class="space-y-4" @submit.prevent="signInWithPassword">
        <UFormField label="Password" name="password">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Your password"
            size="lg"
            class="w-full"
            :disabled="pending"
            autofocus
          />
        </UFormField>

        <UButton type="submit" block size="lg" :loading="pending">Sign in</UButton>

        <p class="text-center text-sm text-muted">
          No password yet?
          <button
            type="button"
            class="font-medium text-primary hover:underline"
            :disabled="pending"
            @click="useOtpMethod"
          >
            Use an email code
          </button>
        </p>
      </form>

      <!-- OTP method -->
      <form v-else class="space-y-4" @submit.prevent="verifyOtp">
        <UFormField label="Verification code" name="otp">
          <UPinInput
            v-model="otpDigits"
            :length="6"
            otp
            size="lg"
            :disabled="pending"
          />
        </UFormField>

        <UButton type="submit" block size="lg" :loading="pending">Verify and sign in</UButton>

        <p class="text-center text-sm text-muted">
          Didn't get it?
          <button
            type="button"
            class="font-medium text-primary hover:underline"
            :disabled="pending"
            @click="sendOtp"
          >
            Resend code
          </button>
        </p>
      </form>

      <div class="flex items-center gap-3 py-1">
        <span class="h-px flex-1 bg-default" />
        <span class="text-xs text-dimmed">or</span>
        <span class="h-px flex-1 bg-default" />
      </div>

      <UButton
        type="button"
        block
        size="lg"
        color="neutral"
        variant="outline"
        icon="i-solar-shield-keyhole-line-duotone"
        :disabled="pending"
        @click="signInWithPasskey"
      >
        Sign in with a passkey
      </UButton>
    </div>
  </div>
</template>
