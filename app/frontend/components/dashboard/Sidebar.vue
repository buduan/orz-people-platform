<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
import type { WorkspaceSummary } from '@orz-people-platform/types';

type WorkspaceOption = Pick<WorkspaceSummary, 'id' | 'name' | 'slug'>;

defineProps<{
  navigation: NavigationMenuItem[];
  workspaces: WorkspaceOption[];
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
  closable?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  logout: [];
  navigate: [];
}>();

const workspaceId = defineModel<number>('workspaceId', { required: true });
</script>

<template>
  <section
    class="relative flex h-full min-h-0 flex-col border-r border-default
      bg-default p-3 text-muted"
  >
    <UButton
      v-if="closable"
      icon="i-solar-close-circle-bold-duotone"
      color="neutral"
      variant="ghost"
      square
      class="absolute right-3 top-3 rounded-xl text-dimmed
        hover:bg-elevated hover:text-highlighted"
      aria-label="Close navigation"
      @click="emit('close')"
    />

    <div
      class="relative z-20 pt-2"
      :class="{ 'pt-12': closable }"
    >
      <p class="mb-2 px-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-dimmed">
        Workspace
      </p>
      <DashboardWorkspaceSwitcher
        v-model:workspace-id="workspaceId"
        :workspaces="workspaces"
      />
    </div>

    <nav
      class="mt-6 min-h-0 flex-1 overflow-y-auto"
      aria-label="Primary navigation"
      @click="emit('navigate')"
    >
      <UNavigationMenu
        :items="navigation"
        orientation="vertical"
        color="primary"
        variant="pill"
        class="w-full"
        :ui="{
          root: 'gap-1',
          label: 'px-2 pb-2 pt-3 text-[0.6875rem] uppercase tracking-[0.16em] text-dimmed',
          link: [
            'min-h-11 rounded-xl px-3 text-muted',
            'hover:text-highlighted hover:before:bg-elevated',
            '[&[aria-current=page]]:text-primary',
            '[&[aria-current=page]]:before:bg-primary/10',
          ],
          linkLeadingIcon: [
            'size-5 text-dimmed group-hover:text-highlighted',
            'group-aria-[current=page]:text-primary',
          ],
        }"
      />
    </nav>

    <div class="mt-4 border-t border-default pt-3">
      <DashboardUserPanel
        :user="user"
        @logout="emit('logout')"
      />
    </div>
  </section>
</template>
