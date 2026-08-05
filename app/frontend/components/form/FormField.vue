<script setup lang="ts">
/* eslint-disable vue/valid-v-for -- recursive FormField keys use schema ids */
import {
  computed,
  inject,
  nextTick,
  ref,
  type Ref,
} from '#imports';
import type { FormLayoutNode, JsonValue } from '@orz-people-platform/types';
import {
  getChoiceOptions,
  getItemExtension,
  getRequiredItemIds,
  getSchemaProperties,
  isItemVisible,
  resolveLocalizedText,
} from '@orz-people-platform/utils';
import { useFormFieldEditing } from '~/composables/useFormFieldEditing';
import {
  resolveFormComponent,
  resolveInputType,
  resolveWidgetName,
} from './component-map';
import type {
  FocusableInputInstance,
  FormRenderContext,
} from './types';

defineOptions({ name: 'FormField' });

const props = defineProps<{
  /** 稳定字段 id：itemId 或 layout node id。 */
  fieldId: string;
  /** 布局节点；缺省时按 item 叶子渲染。 */
  layoutNode?: FormLayoutNode;
  allowEdit?: boolean;
  description?: string;
  title?: string;
  required?: boolean;
  name?: string;
  error?: boolean | string;
}>();

/** 编辑态由共享互斥上下文派生：同一时刻至多一个字段处于编辑态。 */
const { editing } = useFormFieldEditing(props.fieldId);

const emit = defineEmits<{
  up: [fieldId: string];
  down: [fieldId: string];
  duplicate: [fieldId: string];
  settings: [fieldId: string];
  delete: [fieldId: string];
  'update:title': [fieldId: string, value: string];
  'update:description': [fieldId: string, value?: string];
}>();

const formContext = inject<Ref<FormRenderContext> | null>('formRenderContext', null);

const locale = computed(() => formContext?.value.locale ?? 'zh-CN');
const schema = computed(() => formContext?.value.schema);
const state = computed(() => formContext?.value.state);

const properties = computed(() => (
  schema.value ? getSchemaProperties(schema.value) : null
));
const requiredIds = computed(() => (
  schema.value ? getRequiredItemIds(schema.value) : new Set<string>()
));

const isLayout = computed(() => props.layoutNode !== undefined);
const isSection = computed(() => props.layoutNode?.type === 'section');
const isMarkdown = computed(() => props.layoutNode?.type === 'markdown');
const isItem = computed(() => !isLayout.value);

const property = computed(() => (
  isItem.value ? properties.value?.[props.fieldId] : undefined
));
const itemExtension = computed(() => getItemExtension(property.value));

const visible = computed(() => {
  if (!isItem.value) return true;
  return isItemVisible(itemExtension.value, state.value ?? {});
});

const resolvedTitle = computed(() => {
  if (props.title !== undefined) return props.title;
  if (props.layoutNode) {
    return resolveLocalizedText(props.layoutNode.title, locale.value) ?? props.layoutNode.id;
  }
  return resolveLocalizedText(itemExtension.value?.i18n?.title, locale.value) ?? props.fieldId;
});

const resolvedDescription = computed(() => {
  if (props.description !== undefined) return props.description;
  if (props.layoutNode) return undefined;
  return resolveLocalizedText(itemExtension.value?.i18n?.description, locale.value);
});

const markdownContent = computed(() => (
  props.layoutNode
    ? (resolveLocalizedText(props.layoutNode.markdown, locale.value) ?? '')
    : ''
));

const fieldName = computed(() => props.name ?? props.fieldId);
const fieldRequired = computed(() => (
  props.required ?? (isItem.value && requiredIds.value.has(props.fieldId))
));

const widgetName = computed(() => resolveWidgetName(itemExtension.value?.ui?.widget));
const leafComponent = computed(() => resolveFormComponent(widgetName.value));

const placeholder = computed(() => (
  resolveLocalizedText(itemExtension.value?.i18n?.placeholder, locale.value)
));

const choiceOptions = computed(() => getChoiceOptions(property.value, locale.value));

const leafProps = computed(() => {
  const base: Record<string, unknown> = {
    placeholder: placeholder.value,
    required: fieldRequired.value,
  };
  if (widgetName.value === 'input') {
    base.type = resolveInputType(property.value);
  }
  if (
    widgetName.value === 'checkbox'
    || widgetName.value === 'radio'
    || widgetName.value === 'selector'
    || widgetName.value === 'cascader'
  ) {
    base.items = choiceOptions.value;
  }
  if (widgetName.value === 'selector' || widgetName.value === 'cascader') {
    base.options = choiceOptions.value;
  }
  if (widgetName.value === 'selector' && property.value) {
    const prop = property.value as Record<string, unknown>;
    if (prop.type === 'array') base.multiple = true;
  }
  return base;
});

const modelValue = computed<JsonValue | undefined>({
  get: () => state.value?.[props.fieldId],
  set: (value) => {
    if (!state.value) return;
    state.value[props.fieldId] = value;
  },
});

/** 标题 / 描述是否处于就地编辑态。 */
const titleEditing = ref(false);
const descriptionEditing = ref(false);

const titleInputRef = ref<FocusableInputInstance | null>(null);
const descriptionInputRef = ref<FocusableInputInstance | null>(null);

const titleDraft = ref(resolvedTitle.value);
const descriptionDraft = ref(resolvedDescription.value ?? '');

/** 编辑态下即使无描述也展示描述区，便于新增。 */
const showDescriptionRow = computed(() => (
  Boolean(resolvedDescription.value)
  || descriptionEditing.value
  || (editing.value && props.allowEdit)
));

function focusInput(target: FocusableInputInstance | null): void {
  if (target && 'focus' in target) {
    (target as { focus: () => void }).focus();
  } else if ('inputRef' in (target ?? {})) {
    (target as { inputRef: { focus: () => void } }).inputRef.focus();
  } else if ('textareaRef' in (target ?? {})) {
    (target as { textareaRef: { focus: () => void } }).textareaRef.focus();
  }
}

function startTitleEdit(): void {
  titleDraft.value = resolvedTitle.value;
  titleEditing.value = true;
  nextTick(() => focusInput(titleInputRef.value));
}

function startDescriptionEdit(): void {
  descriptionDraft.value = resolvedDescription.value ?? '';
  descriptionEditing.value = true;
  nextTick(() => focusInput(descriptionInputRef.value));
}

function finishTitleEdit(): void {
  titleEditing.value = false;
  if (titleDraft.value !== resolvedTitle.value) {
    emit('update:title', props.fieldId, titleDraft.value);
  }
}

function finishDescriptionEdit(): void {
  descriptionEditing.value = false;
  const next = descriptionDraft.value || undefined;
  if (next !== resolvedDescription.value) {
    emit('update:description', props.fieldId, next);
  }
}

function enterEdit(): void {
  if (props.allowEdit && !editing.value) {
    editing.value = true;
  }
}

function emitUp(): void { emit('up', props.fieldId); }
function emitDown(): void { emit('down', props.fieldId); }
function emitDuplicate(): void { emit('duplicate', props.fieldId); }
function emitSettings(): void { emit('settings', props.fieldId); }
function emitDelete(): void { emit('delete', props.fieldId); }
</script>

<template>
  <div
    v-if="visible"
    class="overflow-hidden rounded-xl border transition-[border-color,box-shadow]
      duration-200 ease-out"
    :class="[
      editing ? 'border-primary shadow-md shadow-primary/20' : 'border-transparent',
      allowEdit && !editing ? 'cursor-pointer hover:border-default' : '',
    ]"
    @click="enterEdit"
  >
    <div class="p-4">
      <div
        v-if="!isMarkdown"
        class="flex items-start gap-2"
        @click.stop
      >
        <h3
          v-if="!titleEditing"
          class="text-lg font-bold text-highlighted"
          :class="isSection ? 'text-xl' : ''"
        >
          {{ resolvedTitle }}
          <span
            v-if="fieldRequired && isItem"
            class="text-error"
          >*</span>
        </h3>

        <UInput
          v-else
          ref="titleInputRef"
          v-model="titleDraft"
          variant="none"
          aria-label="编辑字段标题"
          class="w-full min-w-0"
          :ui="{ base: 'w-full p-0 text-lg font-bold text-highlighted' }"
          @keydown.enter="finishTitleEdit"
          @blur="finishTitleEdit"
        />

        <UButton
          v-if="editing && !titleEditing"
          icon="i-solar-pen-new-round-bold-duotone"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          class="shrink-0 rounded-md text-muted hover:bg-elevated hover:text-highlighted"
          aria-label="编辑标题"
          title="编辑标题"
          @click.stop="startTitleEdit()"
        />
      </div>

      <div
        v-if="showDescriptionRow && !isMarkdown"
        class="mt-1 flex items-start gap-2"
        @click.stop
      >
        <p
          v-if="!descriptionEditing"
          class="text-sm leading-6 text-muted"
        >
          {{ resolvedDescription || (editing ? '添加描述…' : '') }}
        </p>

        <UTextarea
          v-else
          ref="descriptionInputRef"
          v-model="descriptionDraft"
          variant="none"
          aria-label="编辑字段描述"
          class="w-full min-w-0"
          :ui="{ base: 'w-full p-0 text-sm leading-6 text-muted' }"
          @blur="finishDescriptionEdit"
        />

        <UButton
          v-if="editing && !descriptionEditing"
          icon="i-solar-pen-new-round-bold-duotone"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          class="shrink-0 rounded-md text-muted hover:bg-elevated hover:text-highlighted"
          aria-label="编辑描述"
          title="编辑描述"
          @click.stop="startDescriptionEdit()"
        />
      </div>

      <!-- markdown 布局节点 -->
      <div
        v-if="isMarkdown"
        class="prose prose-sm max-w-none text-muted dark:prose-invert"
        @click.stop
      >
        <p class="whitespace-pre-wrap text-sm leading-6">
          {{ markdownContent }}
        </p>
      </div>

      <!-- section：递归渲染子 FormField -->
      <div
        v-else-if="isSection"
        class="mt-3 space-y-3"
        @click.stop
      >
        <FormField
          v-for="childId in layoutNode?.children ?? []"
          :key="childId"
          :field-id="childId"
          :allow-edit="allowEdit"
          @up="emit('up', $event)"
          @down="emit('down', $event)"
          @duplicate="emit('duplicate', $event)"
          @settings="emit('settings', $event)"
          @delete="emit('delete', $event)"
          @update:title="(id, value) => emit('update:title', id, value)"
          @update:description="(id, value) => emit('update:description', id, value)"
        />
      </div>

      <!-- 叶子 item：UFormField + componentMap -->
      <div
        v-else-if="isItem"
        class="mt-3"
        @click.stop
      >
        <UFormField
          :name="fieldName"
          :required="fieldRequired"
          :error="error"
          :ui="{
            label: 'sr-only',
            container: 'mt-0',
          }"
        >
          <component
            :is="leafComponent"
            v-if="leafComponent"
            v-model="modelValue"
            v-bind="leafProps"
          />
          <div
            v-else
            class="rounded-lg border border-dashed border-default px-3 py-2 text-sm text-muted"
          >
            未知控件：{{ widgetName ?? '（未配置 widget）' }}
          </div>
        </UFormField>
      </div>
    </div>

    <Transition name="field-edit">
      <FormFieldEditor
        v-if="editing"
        @up="emitUp"
        @down="emitDown"
        @duplicate="emitDuplicate"
        @settings="emitSettings"
        @delete="emitDelete"
      />
    </Transition>
  </div>
</template>

<style scoped>
.field-edit-enter-active,
.field-edit-leave-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.field-edit-enter-from,
.field-edit-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .field-edit-enter-active,
  .field-edit-leave-active {
    transition: none;
  }
}
</style>
