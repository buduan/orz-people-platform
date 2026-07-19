<script setup lang="ts">
const links = [
  { label: 'Dashboard', to: '/panel' },
  { label: 'Forms', to: '/panel/forms' },
  { label: 'Members', to: '/panel/members' },
  { label: 'Activities', to: '/panel/activities' },
  { label: 'Joins', to: '/panel/joins' },
  { label: 'Settings', to: '/settings' },
];

const route = useRoute();

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to));
</script>

<template>
  <nav aria-label="Primary">
    <ul class="space-y-1.5">
      <li
        v-for="link in links"
        :key="link.to"
      >
        <NuxtLink
          :to="link.to"
          class="block rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors duration-150"
          :class="isActive(link.to)
            ? 'bg-primary/10 text-primary'
            : 'text-highlighted hover:bg-elevated'"
          :aria-current="isActive(link.to) ? 'page' : undefined"
        >
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
