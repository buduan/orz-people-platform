<script setup lang="ts">
import { ref } from '#imports';
import { useFormFieldEditingState } from '~/composables/useFormFieldEditing';

/** 是否存在处于编辑态的字段（共享互斥上下文），驱动顶部状态指示。 */
const { anyEditing } = useFormFieldEditingState();

// 演示用表单值（模拟编辑已有行时的预填内容）。
const fullName = ref('林晚晴');
const email = ref('wanqing.lin@example.com');
const department = ref('engineering');
const notify = ref(true);
const bio = ref(
  '负责表单与数据集模块的前端研发，关注表单渲染引擎的性能与可访问性。',
);

const departmentItems = [
  { label: '产品研发部', value: 'engineering' },
  { label: '设计与体验部', value: 'design' },
  { label: '市场运营部', value: 'marketing' },
  { label: '人力资源部', value: 'hr' },
];
</script>

<template>
  <main class="min-h-dvh bg-default text-highlighted">
    <div class="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header class="mb-10">
        <div class="flex flex-wrap items-center gap-3">
          <UBadge
            label="组件预览"
            color="primary"
            variant="subtle"
            size="sm"
          />
          <code class="text-xs font-semibold text-muted">
            FormField.vue
          </code>
        </div>

        <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1
            class="text-3xl font-bold tracking-[-0.035em] text-highlighted sm:text-4xl"
          >
            FormField 表单字段
          </h1>
          <UButton
            label="回到首页"
            icon="i-solar-arrow-left-up-bold-duotone"
            to="/"
            color="neutral"
            variant="outline"
            size="sm"
            class="active:translate-y-px"
          />
        </div>

        <p class="mt-3 max-w-2xl text-base leading-7 text-muted">
          表单字段的外层容器：自上而下依次为字段标题、描述、Form Item 与编辑操作区。
          切换下方开关，观察展示态与编辑态下边框、阴影和编辑区的变化。
        </p>

        <div
          class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl
            border border-default bg-elevated p-4"
        >
          <div class="flex items-center gap-3">
            <span
              class="size-2.5 rounded-full transition-colors duration-300"
              :class="anyEditing
                ? 'bg-primary'
                : 'bg-neutral-300 dark:bg-neutral-600'"
            />
            <div>
              <p class="text-sm font-semibold text-highlighted">
                {{ anyEditing ? '编辑态' : '展示态' }}
              </p>
              <p class="mt-0.5 text-xs text-muted">
                {{ anyEditing
                  ? '聚焦编辑状态，展示编辑操作按钮'
                  : '对外填写与非聚焦状态，不展示编辑区域' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-muted">
              编辑模式
            </span>
            <USwitch
              v-model="anyEditing"
              aria-label="切换展示态与编辑态"
            />
          </div>
        </div>
      </header>

      <section
        class="space-y-3"
        aria-label="FormField 状态演示"
      >
        <FormField
          title="姓名"
          description="填写成员在本工作区使用的姓名。"
          allow-edit
        >
          <UInput
            v-model="fullName"
            placeholder="输入姓名"
            class="w-full max-w-[16rem]"
          />
        </FormField>

        <FormField
          title="邮箱"
          description="用于接收通知与身份验证的联系方式。"
          allow-edit
        >
          <UInput
            v-model="email"
            type="email"
            placeholder="name@example.com"
            class="w-full max-w-[16rem]"
          />
        </FormField>

        <FormField
          title="所属部门"
          allow-edit
        >
          <USelect
            v-model="department"
            :items="departmentItems"
            placeholder="选择所属部门"
            class="w-full max-w-[16rem]"
          />
        </FormField>

        <FormField
          title="通知偏好"
          description="控制工作区消息的接收方式。"
          allow-edit
        >
          <UCheckbox
            v-model="notify"
            label="接收新表单提交通知"
          />
        </FormField>

        <FormField
          title="个人简介"
          description="一句话介绍，将展示在成员资料页。"
          allow-edit
        >
          <UTextarea
            v-model="bio"
            placeholder="写点什么……"
            class="w-full"
          />
        </FormField>
      </section>

      <section class="mt-12">
        <UCard
          class="rounded-2xl border-default bg-default shadow-sm"
          :ui="{ body: 'space-y-8' }"
        >
          <template #header>
            <div class="flex items-center gap-3">
              <UIcon
                name="i-solar-code-square-bold-duotone"
                class="size-5 text-primary"
              />
              <h2 class="text-sm font-bold text-highlighted">
                组件 API
              </h2>
            </div>
          </template>

          <div>
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Props
            </p>
            <dl class="mt-3 divide-y divide-default text-sm">
              <div
                class="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-4 py-3 first:pt-0
                  last:pb-0"
              >
                <dt class="font-mono font-semibold text-toned">
                  title
                </dt>
                <dd class="text-muted">
                  字段标题（必填），以 <code>text-lg font-bold</code> 渲染
                </dd>
              </div>
              <div class="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-4 py-3">
                <dt class="font-mono font-semibold text-toned">
                  description
                </dt>
                <dd class="text-muted">
                  字段描述（可选），以次要灰色 <code>text-sm</code> 渲染；为空时不展示
                </dd>
              </div>
              <div class="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-4 py-3 last:pb-0">
                <dt class="font-mono font-semibold text-toned">
                  allow-edit
                </dt>
                <dd class="text-muted">
                  允许点击编辑（可选）；传入后点击字段卡片即进入编辑态，未编辑时悬停显示可点击提示。编辑态由共享互斥上下文派生，同一时刻至多一个字段处于编辑态
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Slots
            </p>
            <dl class="mt-3 divide-y divide-default text-sm">
              <div
                class="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-4 py-3 first:pt-0
                  last:pb-0"
              >
                <dt class="font-mono font-semibold text-toned">
                  default
                </dt>
                <dd class="text-muted">
                  字段 Form Item 本体，如输入框、复选框等 widget
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Editor component
            </p>
            <dl class="mt-3 divide-y divide-default text-sm">
              <div
                class="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-4 py-3 first:pt-0
                  last:pb-0"
              >
                <dt class="font-mono font-semibold text-toned">
                  FormFieldEditor
                </dt>
                <dd class="text-muted">
                  编辑态底部灰色操作条，内置上移 / 下移 / 复制 / 设置 / 删除按钮；点击通过
                  <code>up</code> / <code>down</code> / <code>duplicate</code> /
                  <code>settings</code> / <code>delete</code> 事件通知父级
                </dd>
              </div>
            </dl>
          </div>
        </UCard>
      </section>
    </div>
  </main>
</template>
