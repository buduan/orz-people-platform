<script setup lang="ts">
import type { ApiResponse } from '@orz-people-platform/types';

const serviceStatus: ApiResponse<{ service: string; status: string }> = {
  data: {
    service: 'orz-people-platform-frontend',
    status: 'ready',
  },
  timestamp: new Date().toISOString(),
};

const formattedUpdatedAt = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'medium',
}).format(new Date(serviceStatus.timestamp));

</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-default p-6">
    <UCard
      class="w-full max-w-2xl"
      :ui="{ body: 'space-y-8' }"
    >
      <template #header>
        <p class="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          orz people platform
        </p>
      </template>

      <section aria-labelledby="page-title">
        <h1
          id="page-title"
          class="text-3xl font-bold tracking-tight text-highlighted sm:text-5xl"
        >
          Nuxt frontend is ready
        </h1>
        <p class="mt-4 text-lg leading-8 text-muted">
          Shared TypeScript packages are connected and ready for feature development.
        </p>
      </section>

      <dl class="grid gap-4 border-t border-default pt-6 sm:grid-cols-3">
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
            Service
          </dt>
          <dd class="mt-1 break-words text-sm font-medium text-highlighted">
            {{ serviceStatus.data.service }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
            Status
          </dt>
          <dd class="mt-1 text-sm font-medium text-highlighted">
            {{ serviceStatus.data.status }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
            Updated
          </dt>
          <dd class="mt-1 break-words text-sm font-medium text-highlighted">
            {{ formattedUpdatedAt }}
          </dd>
        </div>
      </dl>
    </UCard>
  </main>
</template>
