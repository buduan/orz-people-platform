<script setup lang="ts">
defineOptions({ inheritAttrs: false });

type TagsInputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface TagsInputProps {
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  size?: TagsInputSize;
  addOnBlur?: boolean;
  addOnPaste?: boolean;
  addOnTab?: boolean;
  duplicate?: boolean;
  max?: number;
}

const props = withDefaults(defineProps<TagsInputProps>(), {
  placeholder: '',
  addOnBlur: true,
  maxLength: undefined,
  size: 'md',
  max: undefined,
});
const model = defineModel<string[]>({ default: () => [] });
</script>

<template>
  <UInputTags
    v-model="model"
    v-bind="$attrs"
    class="w-full"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :max-length="maxLength"
    :size="size"
    :add-on-blur="addOnBlur"
    :add-on-paste="addOnPaste"
    :add-on-tab="addOnTab"
    :duplicate="duplicate"
    :max="max"
  />
</template>
