<script setup lang="ts">
import type { CreateDatasetRequest } from '@orz-people-platform/types';
import { computed, reactive, watch } from '#imports';

const props = withDefaults(defineProps<{
  open: boolean;
  pending?: boolean;
  error?: string | null;
}>(), {
  pending: false,
  error: null,
});

const emit = defineEmits<{
  'update:open': [open: boolean];
  submit: [input: CreateDatasetRequest];
}>();

const form = reactive<{
  name: string;
  slug: string;
  description: string;
  type: CreateDatasetRequest['type'];
  subjectMode: NonNullable<CreateDatasetRequest['subjectMode']>;
}>({
  name: '',
  slug: '',
  description: '',
  type: 'standard',
  subjectMode: 'none',
});
const touched = reactive({ name: false, slug: false });
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nameError = computed(() => (touched.name && !form.name.trim() ? '请输入数据表名称' : ''));
const slugError = computed(() => {
  if (!touched.slug) return '';
  if (!form.slug.trim()) return '请输入唯一标识';
  return slugPattern.test(form.slug) ? '' : '仅支持小写字母、数字和连字符';
});
const valid = computed(() => form.name.trim().length > 0 && slugPattern.test(form.slug));

watch(() => form.type, (type) => {
  form.subjectMode = type === 'join_requests' ? 'single_per_user' : 'none';
});

function close(): void {
  if (!props.pending) emit('update:open', false);
}

function submit(): void {
  touched.name = true;
  touched.slug = true;
  if (!valid.value) return;
  emit('submit', {
    ...form,
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description?.trim() || undefined,
  });
}
</script>

<template>
  <UModal
    :open="open"
    title="新建数据表"
    description="创建后可继续配置字段和数据行。"
    :dismissible="!pending"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form
        id="dataset-definition-form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UFormField
          label="名称"
          required
          :error="nameError"
        >
          <UInput
            v-model="form.name"
            class="w-full"
            autocomplete="off"
            autofocus
            @blur="touched.name = true"
          />
        </UFormField>
        <UFormField
          label="唯一标识"
          hint="例如 project-members"
          required
          :error="slugError"
        >
          <UInput
            v-model="form.slug"
            class="w-full font-mono"
            autocomplete="off"
            @blur="touched.slug = true"
          />
        </UFormField>
        <UFormField label="类型">
          <USelect
            v-model="form.type"
            class="w-full"
            value-key="value"
            :items="[
              { label: '标准数据表', value: 'standard' },
              { label: '加入申请', value: 'join_requests' },
            ]"
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
          title="创建失败"
          :description="error ?? undefined"
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
          @click="close"
        />
        <UButton
          form="dataset-definition-form"
          type="submit"
          label="创建并打开"
          icon="i-solar-add-circle-bold-duotone"
          :loading="pending"
        />
      </div>
    </template>
  </UModal>
</template>
