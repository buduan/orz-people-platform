<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
import type { WorkspaceSummary } from '@weave/types';

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
  collapsible?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  logout: [];
  navigate: [];
}>();

const collapsed = defineModel<boolean>('collapsed', { default: false });
const workspaceId = defineModel<number>('workspaceId', { required: true });

function toggleSidebar(): void {
  collapsed.value = !collapsed.value;
}
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

    <button
      v-if="collapsible"
      type="button"
      class="group/edge absolute inset-y-0 -right-2 z-30 w-4 cursor-pointer
        focus-visible:outline-none"
      :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggleSidebar"
    >
      <span
        class="pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-4
          -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full
          border border-default bg-default text-dimmed opacity-0 shadow-sm
          transition-[opacity,background-color,color] duration-200
          group-hover/edge:bg-elevated group-hover/edge:text-highlighted
          group-hover/edge:opacity-100 group-focus-visible/edge:opacity-100
          group-focus-visible/edge:ring-2 group-focus-visible/edge:ring-primary
          group-focus-visible/edge:ring-offset-2"
      >
        <UIcon
          :name="collapsed
            ? 'i-solar-alt-arrow-right-line-duotone'
            : 'i-solar-alt-arrow-left-line-duotone'"
          class="size-3.5"
        />
      </span>
    </button>

    <div
      class="relative z-20 pt-2"
      :class="{ 'pt-12': closable }"
    >
      <DashboardWorkspaceSwitcher
        v-model:workspace-id="workspaceId"
        :workspaces="workspaces"
        :collapsed="collapsed"
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
        :collapsed="collapsed"
        :tooltip="collapsed"
        class="w-full"
        :ui="{
          root: 'gap-1',
          label: 'px-2 pb-2 pt-3 text-[0.6875rem] uppercase tracking-[0.16em] text-dimmed',
          link: [
            'min-h-11 rounded-xl text-muted transition-colors duration-200',
            collapsed ? 'justify-center px-0' : 'px-3',
            'before:transition-colors before:duration-200 hover:text-highlighted',
            'hover:before:bg-slate-50',
            '[&[aria-current=page]]:text-primary',
            '[&[aria-current=page]]:before:bg-slate-100',
          ],
          linkLeadingIcon: [
            'size-5 text-dimmed transition-colors duration-200 group-hover:text-highlighted',
            'group-aria-[current=page]:text-primary',
          ],
        }"
      />
    </nav>

    <div class="mt-4 border-t border-default pt-3">
      <DashboardUserPanel
        :user="user"
        :collapsed="collapsed"
        @logout="emit('logout')"
      />
    </div>
  </section>
</template>
