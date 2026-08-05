<script setup lang="ts">
import type { FormItemOption, FormItemValue } from './types';

type RadioSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type RadioColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
type RadioOrientation = 'horizontal' | 'vertical';
type RadioVariant = 'list' | 'card' | 'table';

interface RadioProps {
  items?: FormItemOption[];
  legend?: string;
  disabled?: boolean;
  required?: boolean;
  orientation?: RadioOrientation;
  variant?: RadioVariant;
  size?: RadioSize;
  color?: RadioColor;
}

const props = withDefaults(defineProps<RadioProps>(), {
  items: () => [],
  legend: '',
  orientation: 'vertical',
  variant: 'list',
  size: 'md',
  color: 'primary',
});
const model = defineModel<FormItemValue | undefined>({ default: undefined });
</script>

<template>
  <URadioGroup
    v-model="model"
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
