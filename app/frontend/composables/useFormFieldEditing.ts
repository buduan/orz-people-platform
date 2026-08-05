import {
  computed,
  ref,
  type ComputedRef,
  type WritableComputedRef,
} from '#imports';

/** 当前处于编辑态的字段 id；null 表示无字段处于编辑态。 */
const activeEditingId = ref<string | null>(null);

/**
 * FormField 编辑态互斥上下文。
 *
 * 传入稳定 fieldId（schema itemId / layout node id）。同一时刻至多一个
 * 字段处于编辑态；将 editing 置 true 会抢占互斥。
 */
export function useFormFieldEditing(fieldId: string): {
  editing: WritableComputedRef<boolean>;
  fieldId: string;
} {
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

/** 全局编辑互斥状态：是否有字段在编辑、当前选中字段 id。 */
export function useFormFieldEditingState(): {
  anyEditing: ComputedRef<boolean>;
  selectedFieldId: ComputedRef<string | null>;
  clearEditing: () => void;
} {
  const anyEditing = computed(() => activeEditingId.value !== null);
  const selectedFieldId = computed(() => activeEditingId.value);
  function clearEditing(): void {
    activeEditingId.value = null;
  }
  return { anyEditing, selectedFieldId, clearEditing };
}
