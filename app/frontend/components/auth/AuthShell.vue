<script setup lang="ts">
defineProps<{
  description: string;
  eyebrow?: string;
  title: string;
}>();
</script>

<template>
  <main class="min-h-dvh bg-default text-highlighted">
    <div class="grid min-h-dvh lg:grid-cols-[minmax(22rem,0.9fr)_minmax(32rem,1.1fr)]">
      <aside
        class="relative hidden overflow-hidden border-r border-default bg-elevated p-12 lg:flex
          lg:flex-col lg:justify-between"
        aria-label="Orz People Platform"
      >
        <NuxtLink
          to="/"
          class="inline-flex w-fit items-center gap-3 rounded-xl focus-visible:outline-2
            focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <span class="grid size-10 place-items-center rounded-xl bg-primary text-white">
            <UIcon
              name="i-solar-users-group-rounded-bold-duotone"
              class="size-5"
            />
          </span>
          <span class="text-sm font-bold tracking-tight">Orz People Platform</span>
        </NuxtLink>

        <div class="max-w-lg pb-10">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            People, clearly organized
          </p>
          <p class="mt-5 text-4xl font-bold leading-tight tracking-[-0.04em]">
            从一次清晰的登录开始，回到真正重要的协作。
          </p>
          <p class="mt-5 max-w-md text-base leading-7 text-muted">
            统一管理成员、工作区与权限，让团队知道谁能做什么，也知道下一步在哪里。
          </p>
        </div>

        <p class="text-xs text-muted">
          Orz People Platform
        </p>
      </aside>

      <section class="flex min-w-0 items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
        <div class="w-full max-w-md">
          <NuxtLink
            to="/"
            aria-label="Orz People Platform 首页"
            class="mb-10 inline-flex items-center gap-2 rounded-lg text-sm font-bold lg:hidden"
          >
            <span class="grid size-9 place-items-center rounded-xl bg-primary text-white">
              <UIcon
                name="i-solar-users-group-rounded-bold-duotone"
                class="size-5"
              />
            </span>
            Orz People Platform
          </NuxtLink>

          <header class="mb-8">
            <p
              v-if="eyebrow"
              class="text-xs font-bold uppercase tracking-[0.16em] text-primary"
            >
              {{ eyebrow }}
            </p>
            <h1 class="mt-2 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              {{ title }}
            </h1>
            <p class="mt-3 text-sm leading-6 text-muted sm:text-base">
              {{ description }}
            </p>
          </header>

          <div class="motion-safe:animate-[auth-enter_180ms_ease-out] motion-reduce:animate-none">
            <slot />
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
@keyframes auth-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
