<template>
  <div class="grid min-h-dvh grid-cols-1 bg-default text-highlighted lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <!-- Brand panel: restrained single-accent tonal field, desktop only. -->
    <aside
      class="relative hidden overflow-hidden bg-primary-700 text-white lg:flex lg:flex-col lg:justify-between lg:p-12"
    >
      <div
        class="animate-aurora pointer-events-none absolute inset-0 opacity-70"
        style="
          background:
            radial-gradient(60% 55% at 25% 20%, rgba(96, 165, 250, 0.55), transparent 70%),
            radial-gradient(50% 50% at 80% 75%, rgba(37, 99, 235, 0.65), transparent 70%);
        "
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute inset-0"
        style="background: linear-gradient(160deg, rgba(30, 58, 138, 0.35), rgba(30, 58, 138, 0.75))"
        aria-hidden="true"
      />

      <div class="relative">
        <span class="text-lg font-bold tracking-tight">OrzManager</span>
      </div>

      <div class="relative max-w-md">
        <p class="text-sm font-medium uppercase tracking-[0.2em] text-white/60">People platform</p>
        <h2 class="mt-4 text-3xl font-bold leading-tight tracking-tight">
          One calm console for members, activities, and join requests.
        </h2>
        <p class="mt-4 text-sm leading-6 text-white/70">
          Sign in with a one-time code, a password, or a passkey — whichever you set up.
          Your workspace is waiting.
        </p>
      </div>

      <div class="relative text-xs text-white/50">
        &copy; {{ new Date().getFullYear() }} OrzManager
      </div>
    </aside>

    <!-- Form panel -->
    <main class="flex flex-col">
      <header class="flex h-16 items-center px-6 lg:hidden">
        <span class="text-base font-bold tracking-tight text-highlighted">OrzManager</span>
      </header>

      <div class="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div class="w-full max-w-sm">
          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
