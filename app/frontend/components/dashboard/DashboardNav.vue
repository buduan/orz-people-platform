<script setup lang="ts">
import { buildPanelNavGroups } from './utils';

const router = useRouter();
const route = useRoute();

const linkGroups = buildPanelNavGroups(router.getRoutes());

const linkClass = [
  'block rounded-xl px-4 py-2.5 text-[15px] font-medium',
  'transition-colors duration-150',
].join(' ');

const isActive = (to: string) => route.path.startsWith(to);
</script>

<template>
  <nav aria-label="Primary">
    <div class="space-y-6">
      <section
        v-for="group in linkGroups"
        :key="group.label"
      >
        <p class="px-4 text-xs font-bold uppercase tracking-wider text-muted">
          {{ group.label }}
        </p>
        <ul class="mt-2 space-y-1.5">
          <li
            v-for="link in group.items"
            :key="link.to"
          >
            <NuxtLink
              :to="link.to"
              :class="[
                linkClass,
                isActive(link.to)
                  ? 'bg-primary/10 text-primary'
                  : 'text-highlighted hover:bg-elevated',
              ]"
              :aria-current="isActive(link.to) ? 'page' : undefined"
            >
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </nav>
</template>
