<script setup lang="ts">
const sidebarOpen = ref(false);
const route = useRoute();

watch(
  () => route.path,
  () => {
    sidebarOpen.value = false;
  },
);
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-default text-highlighted">
    <DashboardTopbar @toggle-sidebar="sidebarOpen = true" />

    <div class="mx-auto flex w-full flex-1 items-stretch">
      <DashboardSidebar class="hidden lg:block" />
      <main class="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <slot />
      </main>
    </div>

    <USlideover
      v-model:open="sidebarOpen"
      side="left"
      title="OrzManager"
      description="Primary navigation"
    >
      <template #body>
        <DashboardNav />
      </template>
    </USlideover>
  </div>
</template>
