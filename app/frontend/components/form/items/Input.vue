<script setup lang="ts">
import { computed } from '#imports';

defineOptions({ inheritAttrs: false });

type InputValue = string | number | null | undefined;
type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface InputProps {
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  size?: InputSize;
  maxLength?: number;
}

const props = defineProps<InputProps>();
const model = defineModel<InputValue>({ default: '' });

const inputModel = computed<string | number>({
  get: () => {
    if (typeof model.value === 'string' || typeof model.value === 'number') return model.value;
    return '';
  },
  set: (value) => {
    model.value = value;
  },
});
</script>

<template>
  <UInput
    v-model="inputModel"
    v-bind="$attrs"
    class="w-full"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :maxlength="maxLength"
    :size="size"
  />
</template>
