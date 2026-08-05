<script setup lang="ts">
defineOptions({ inheritAttrs: false });

type TextareaSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface TextareaProps {
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  size?: TextareaSize;
  rows?: number;
  maxLength?: number;
  autoresize?: boolean;
}

const props = defineProps<TextareaProps>();
const model = defineModel<string>({ default: '' });
</script>

<template>
  <UTextarea
    v-model="model"
    v-bind="$attrs"
    class="w-full"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :rows="rows"
    :autoresize="autoresize"
    :maxlength="maxLength"
    :size="size"
  />
</template>
