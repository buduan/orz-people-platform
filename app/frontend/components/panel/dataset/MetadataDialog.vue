<script setup lang="ts">
import type { DatasetSummary, UpdateDatasetRequest } from '@weave/types';
import { reactive, watch } from '#imports';

const props = withDefaults(defineProps<{
  open: boolean;
  dataset: DatasetSummary;
  pending?: boolean;
  error?: string | null;
}>(), {
  pending: false,
  error: null,
});

const emit = defineEmits<{
  'update:open': [open: boolean];
  submit: [input: Omit<UpdateDatasetRequest, 'expectedRevision'>];
}>();

const form = reactive({ name: '', slug: '', description: '' });
const errors = reactive({ name: '', slug: '' });

watch(() => props.open, (open) => {
  if (!open) return;
  form.name = props.dataset.name;
  form.slug = props.dataset.slug;
  form.description = props.dataset.description ?? '';
  errors.name = '';
  errors.slug = '';
});

function submit(): void {
  errors.name = form.name.trim() ? '' : '请输入名称';
  errors.slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)
    ? ''
    : '仅支持小写字母、数字和连字符';
  if (errors.name || errors.slug) return;
  emit('submit', {
    name: form.name.trim(),
    slug: form.slug,
    description: form.description.trim() || null,
  });
}
</script>

<template>
  <UModal
    :open="open"
    title="编辑数据表信息"
    :dismissible="!pending"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form
        id="dataset-metadata-form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UFormField
          label="名称"
          required
          :error="errors.name"
        >
          <UInput
            v-model="form.name"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField
          label="唯一标识"
          required
          :error="errors.slug"
        >
          <UInput
            v-model="form.slug"
            class="w-full font-mono"
          />
        </UFormField>
        <UFormField label="描述">
          <UTextarea
            v-model="form.description"
            class="w-full"
            :rows="3"
          />
        </UFormField>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="保存失败"
          :description="error"
        />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          :disabled="pending"
          @click="emit('update:open', false)"
        />
        <UButton
          form="dataset-metadata-form"
          type="submit"
          label="保存"
          :loading="pending"
        />
      </div>
    </template>
  </UModal>
</template>
