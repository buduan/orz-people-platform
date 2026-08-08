<script setup lang="ts">
import { computed } from '#imports';
import type {
  FormItemOption,
  FormItemOptionInput,
} from './types';

type CheckboxSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type CheckboxColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
type CheckboxOrientation = 'horizontal' | 'vertical';
type CheckboxVariant = 'list' | 'card' | 'table';

interface CheckboxProps {
  items?: FormItemOptionInput[];
  boolean?: boolean;
  legend?: string;
  disabled?: boolean;
  required?: boolean;
  orientation?: CheckboxOrientation;
  variant?: CheckboxVariant;
  size?: CheckboxSize;
  color?: CheckboxColor;
}

const props = withDefaults(defineProps<CheckboxProps>(), {
  items: () => [],
  legend: '',
  orientation: 'vertical',
  variant: 'list',
  size: 'md',
  color: 'primary',
});
const model = defineModel<boolean | string[] | undefined>({ default: undefined });

const booleanModel = computed<boolean>({
  get: () => model.value === true,
  set: (value) => { model.value = value; },
});

const groupModel = computed<string[]>({
  get: () => (Array.isArray(model.value) ? model.value : []),
  set: (value) => { model.value = value; },
});

const items = computed(() => props.items.map((item) => {
  if (typeof item !== 'object') return String(item);
  const option: FormItemOption = { ...item };
  return { ...option, value: String(option.value ?? '') };
}));
</script>

<template>
  <UCheckbox
    v-if="boolean"
    v-model="booleanModel"
    v-bind="$attrs"
    :disabled="disabled"
    :required="required"
    :size="size"
    :color="color"
  />

  <UCheckboxGroup
    v-else
    v-model="groupModel"
    v-bind="$attrs"
    class="w-full"
    :items="items"
    :legend="legend"
    :disabled="disabled"
    :required="required"
    :orientation="orientation"
    :variant="variant"
    :size="size"
    :color="color"
  />
</template>
