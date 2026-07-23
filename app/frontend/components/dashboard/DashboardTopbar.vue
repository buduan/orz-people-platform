<script setup lang="ts">
defineEmits<{ 'toggle-sidebar': [] }>();

const accountMenuItems = [
  [
    { label: 'Profile', icon: 'i-solar-user-line-duotone' },
    { label: 'Preferences', icon: 'i-solar-tuning-line-duotone' },
  ],
  [{ label: 'Sign out', icon: 'i-solar-logout-line-duotone' }],
];
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur">
    <div class="flex h-16 items-center justify-between px-4 sm:px-6">
      <div class="flex items-center gap-2">
        <UButton
          icon="i-solar-hamburger-menu-line-duotone"
          color="neutral"
          variant="ghost"
          class="lg:hidden"
          aria-label="Open navigation"
          @click="$emit('toggle-sidebar')"
        />
        <NuxtLink
          to="/"
          class="text-xl font-bold tracking-tight text-highlighted"
        >
          OrzManager
        </NuxtLink>
      </div>

      <div class="flex items-center gap-3">
        <UChip
          color="primary"
          inset
        >
          <UButton
            icon="i-solar-bell-line-duotone"
            color="neutral"
            variant="ghost"
            aria-label="Notifications"
          />
        </UChip>

        <UDropdownMenu :items="accountMenuItems">
          <button
            type="button"
            class="rounded-full transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
            aria-label="Account menu"
          >
            <UAvatar
              icon="i-solar-user-line-duotone"
              size="md"
            />
          </button>
        </UDropdownMenu>
      </div>
    </div>
  </header>
</template>
