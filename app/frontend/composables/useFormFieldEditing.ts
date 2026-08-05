import {
  computed,
  ref,
  type ComputedRef,
  type WritableComputedRef,
} from '#imports';

/** 当前处于编辑态的字段实例 id；null 表示无字段处于编辑态。 */
const activeEditingId = ref<string | null>(null);

let fieldSequence = 0;

/**
 * FormField 编辑态互斥上下文。
 *
 * 所有 FormField 实例共享同一份 activeEditingId：同一时刻至多一个字段
 * 处于编辑态。将某字段的 editing 置为 true 会自动抢占互斥，其余字段的
 * editing 随之变为 false；将其置为 false 仅在该字段当前持有编辑态时生效。
 */
export function useFormFieldEditing(): {
  editing: WritableComputedRef<boolean>;
  fieldId: string;
} {
  const fieldId = `form-field-${fieldSequence + 1}`;
  fieldSequence += 1;

  const editing = computed<boolean>({
    get: () => activeEditingId.value === fieldId,
    set: (value) => {
      if (value) {
        activeEditingId.value = fieldId;
      } else if (activeEditingId.value === fieldId) {
        activeEditingId.value = null;
      }
    },
  });

  return { editing, fieldId };
}

/** 全局编辑互斥状态：供页面读取"当前是否有字段处于编辑态"。 */
export function useFormFieldEditingState(): { anyEditing: ComputedRef<boolean> } {
  const anyEditing = computed(() => activeEditingId.value !== null);
  return { anyEditing };
}
