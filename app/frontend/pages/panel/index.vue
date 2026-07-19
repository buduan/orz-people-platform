<script setup lang="ts">
definePageMeta({ layout: 'dashboard' });

const today = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date());

const quickActions = [
  { label: 'Invite a member', to: '/members', icon: 'i-lucide-user-plus' },
  { label: 'Schedule an activity', to: '/activities', icon: 'i-lucide-calendar-plus' },
  { label: 'Review join requests', to: '/join-requests', icon: 'i-lucide-inbox' },
];
</script>

<template>
  <div class="space-y-8">
    <header class="animate-fade-rise">
      <h1 class="text-2xl font-bold tracking-tight text-highlighted">
        Dashboard
      </h1>
      <p class="mt-1 text-sm text-muted">
        {{ today }}
      </p>
    </header>

    <section
      class="animate-fade-rise grid grid-cols-1 divide-y divide-default rounded-2xl border border-default bg-default sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      style="animation-delay: 60ms"
      aria-label="Key figures"
    >
      <DashboardStat
        label="Members"
        hint="Synced from the member directory"
      />
      <DashboardStat
        label="Activities"
        hint="Published and upcoming"
      />
      <DashboardStat
        label="Join requests"
        hint="Waiting for review"
      />
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <DashboardPanel
        class="animate-fade-rise"
        style="animation-delay: 120ms"
        title="Join requests"
        description="Applications waiting for a decision."
      >
        <template #actions>
          <UButton
            to="/join-requests"
            color="neutral"
            variant="outline"
            size="sm"
            trailing-icon="i-lucide-arrow-right"
          >
            View all
          </UButton>
        </template>
        <DashboardEmptyState
          icon="i-lucide-inbox"
          title="No pending requests"
          description="When someone applies to join the organization, their request lands here for review."
        />
      </DashboardPanel>

      <DashboardPanel
        class="animate-fade-rise"
        style="animation-delay: 180ms"
        title="Quick actions"
      >
        <ul class="-my-2 divide-y divide-default">
          <li
            v-for="action in quickActions"
            :key="action.to"
          >
            <NuxtLink
              :to="action.to"
              class="group flex min-h-11 items-center gap-3 py-3 text-sm font-medium text-highlighted transition-colors hover:text-primary"
            >
              <UIcon
                :name="action.icon"
                class="size-4 text-muted transition-colors group-hover:text-primary"
              />
              {{ action.label }}
              <UIcon
                name="i-lucide-arrow-right"
                class="ml-auto size-4 text-dimmed transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </NuxtLink>
          </li>
        </ul>
      </DashboardPanel>
    </div>
  </div>
</template>
