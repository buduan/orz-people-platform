<template>
  <div class="flex h-11 items-end border-b border-slate-200 bg-slate-100 px-3">
    <div
      :class="[
        'flex h-9 items-center gap-2 border-b-2 border-primary-500 px-3',
        'text-sm font-medium text-slate-900',
      ]"
      aria-current="page"
    >
      <UIcon
        name="i-solar-widget-4-bold-duotone"
        class="size-4 text-slate-600"
      />
      <span>表格视图</span>
    </div>
  </div>
</template>
