# Utils 工具方法

`@orz-people-platform/utils` 提供前后端共享的轻量工具，覆盖身份标识规范化、密码策略、JSON 稳定化、表单条件表达式和表单 Schema 扩展校验。

从包入口导入工具：

```ts [packages/utils/src/index.ts]
import {
  canonicalizeJson,
  normalizeEmail,
  validatePassword,
} from '@orz-people-platform/utils';
```

## 导出概览

| 方法或类型 | 源文件 | 作用 |
| --- | --- | --- |
| `parseJsonSchema` | `parse-json-schema.ts` | 将 JSON 字符串解析为 JSON Schema 根文档 |
| `normalizeEmail` | `identity.ts` | 去除首尾空白并将邮箱转为小写 |
| `normalizeUsername` | `identity.ts` | 去除首尾空白并将用户名转为小写 |
| `isE164Phone` | `identity.ts` | 检查字符串是否符合 E.164 电话号码的语法格式 |
| `canonicalizeJson` | `json.ts` | 递归排序对象键，生成确定性的 JSON 字符串 |
| `checksumJson` | `json.ts` | 对确定性的 JSON 字符串计算 SHA-256 校验和 |
| `createFormItemId` | `json.ts` | 生成 `q_` 前缀的 UUID v4 表单项 ID |
| `validatePassword` | `password-policy.ts` | 检查密码是否满足平台密码策略 |
| `parseVisibleIf` | `visible-if.ts` | 解析并严格校验 `visibleIf` 条件表达式 |
| `evaluateVisibleIf` | `visible-if.ts` | 使用表单值计算条件表达式结果 |
| `validateFormSchemaExtensions` | `form-schema.ts` | 校验表单 Schema 中的 `x-orz` 扩展 |
| `PasswordPolicyResult` | `password-policy.ts` | 描述密码策略校验结果 |
| `JsonValue`、`JsonSchema`、`JsonSchemaObject` | `parse-json-schema.ts` | 重新导出的共享 JSON 类型 |

## JSON Schema

### `parseJsonSchema`

`parseJsonSchema(source)` 使用 `JSON.parse` 读取 JSON Schema 字符串，并返回 `JsonSchema`。JSON Schema 规范允许根文档为对象或布尔值，因此 `true` 和 `false` 都是合法结果；数组、`null`、字符串和数字根值会被拒绝。

无效 JSON 或无效根值都会抛出 `SyntaxError`。函数只负责 JSON 语法和根值类型，不负责检查 Schema 关键字是否符合业务规则。

```ts [packages/utils/src/parse-json-schema.ts]
const schema = parseJsonSchema(source);

parseJsonSchema('{"type":"object"}'); // 返回对象 Schema
parseJsonSchema('true');                 // 返回布尔 Schema
parseJsonSchema('[]');                   // 抛出 SyntaxError
```

### `validateFormSchemaExtensions`

`validateFormSchemaExtensions(schema)` 在标准 JSON Schema 校验成功后，检查平台定义的 `x-orz` 扩展。函数通过 TypeScript assertion 将参数收窄为 `JsonSchemaObject`，并在发现非法结构时抛出 `TypeError`。

该函数检查以下内容：

- 根节点存在 `properties` 对象，并且每个表单项 ID 都符合 `q_` 加 UUID v4 的格式。
- 每个表单项都存在 `x-orz`，且必须包含非空的 `datasetFieldId`。
- `i18n` 只接受 `description`、`placeholder`、`title`；其中已声明的本地化字段必须是非空语言映射，映射值必须为字符串。
- `ui` 必须包含非空 `widget`；`options` 只接受 `filter` 和 `labelFieldId`。
- 关系过滤器必须且只能使用 `all` 或 `any` 之一，并包含至少一个条件。条件支持 `equals`、`not_equals`、`in`、`contains`、`is_empty`、`is_not_empty`，且不能同时提供 `value` 和 `valueFrom`。
- `visibleIf` 必须是合法的条件表达式，并且引用的表单项 ID 必须存在于当前 Schema。
- `oneOf` 选项可以声明 `x-orz.i18n`，选项扩展只接受 `i18n`。
- 根节点 `x-orz` 必须包含 `version: 1`、非空 `datasetId`、数组类型的 `layout` 和对象类型的 `capture`。
- `layout` 节点只能使用 `markdown` 或 `section` 类型；其 `children` 只能引用当前 Schema 中存在的表单项。
- `capture` 只能包含 `browser`、`operatingSystem`、`userAgent`，每个配置都必须提供非空的 `datasetFieldId`。

函数只校验扩展自身的结构和表单项之间的引用关系。数据集是否存在、字段是否属于目标数据集、字段是否允许写入等业务关联校验由后端的表单定义校验服务继续处理。

```ts [packages/utils/src/form-schema.ts]
const schema = parseJsonSchema(source);

// 先执行 AJV 等标准 JSON Schema 校验，再校验平台扩展。
validateFormSchemaExtensions(schema);
```

## 身份标识

### `normalizeEmail`

`normalizeEmail(value)` 对邮箱执行 `trim()` 和 `toLowerCase()`，用于在校验、查询和持久化之前统一全局唯一标识。

```ts [packages/utils/src/identity.ts]
normalizeEmail('  Admin@Example.COM '); // 'admin@example.com'
```

该方法不会验证邮箱格式，也不会处理邮箱服务商的别名规则。格式校验仍由调用方负责。

### `normalizeUsername`

`normalizeUsername(value)` 对用户名执行 `trim()` 和 `toLowerCase()`。它只负责规范化，不负责检查用户名允许的字符、长度或唯一性。

```ts [packages/utils/src/identity.ts]
normalizeUsername('  Admin_User '); // 'admin_user'
```

### `isE164Phone`

`isE164Phone(value)` 只检查电话字符串的 E.164 语法外形：必须以 `+` 开头，国家代码首位不能为 `0`，后续只能包含数字，总数字数为 8 到 15 位。函数不会自动去除空白，也不会验证号码是否真实或已被运营商分配。

```ts [packages/utils/src/identity.ts]
isE164Phone('+8613812345678'); // true
isE164Phone('13812345678');    // false，缺少 '+'
```

## JSON 稳定化与校验和

### `canonicalizeJson`

`canonicalizeJson(value)` 将 `JsonValue` 转为确定性的 JSON 字符串。对象键会在每一层递归排序，数组顺序保持不变，字符串、布尔值和 `null` 使用标准 JSON 表示；数字必须是有限数值。

因此，只有对象键顺序不同的两个 JSON 值会生成相同结果。函数不会排序数组，也不会忽略数组中的重复项。

```ts [packages/utils/src/json.ts]
canonicalizeJson({ b: 2, a: { d: true, c: 1 } });
// '{"a":{"c":1,"d":true},"b":2}'
```

运行时传入非有限数字会抛出 `TypeError`。TypeScript 调用方应先确保输入符合 `JsonValue`，不要传入 `undefined`、函数、`Date` 或其他非 JSON 值。

### `checksumJson`

`checksumJson(value)` 先调用 `canonicalizeJson`，再使用 Web Crypto API 对 UTF-8 编码结果计算 SHA-256。函数返回由小写十六进制字符组成的 64 个字符的字符串，并且是异步函数。

对象键顺序不同但内容相同的 JSON 值会产生相同校验和。后端使用该方法为表单定义和提交内容生成校验和，以支持内容比较和幂等判断。

```ts [packages/utils/src/json.ts]
const checksum = await checksumJson({ values: [1, 'two'] });
// 返回 64 个小写十六进制字符组成的字符串
```

运行环境必须提供 `globalThis.crypto.subtle` 和 `TextEncoder`。Node.js 22、现代浏览器和当前项目运行环境均提供这些 Web 标准 API。

### `createFormItemId`

`createFormItemId()` 调用 `crypto.randomUUID()` 生成 UUID v4，并添加 `q_` 前缀。返回值满足 `q_<UUID v4>` 的格式，可直接作为表单 Schema 的属性名和表单项引用。

每次调用都会生成新的随机 ID；“稳定”指格式稳定，不代表同一输入会得到同一 ID。

```ts [packages/utils/src/json.ts]
const itemId = createFormItemId();
// 'q_550e8400-e29b-41d4-a716-446655440000'
```

## 密码策略

### `validatePassword`

`validatePassword(password)` 返回 `PasswordPolicyResult`，而不是直接抛出异常。密码必须满足以下全部条件：长度为 9 到 128 个字符、全部由可见 ASCII 字符组成，并且至少包含四类字符中的三类：大写字母、小写字母、数字和其他可见 ASCII 字符。

```ts [packages/utils/src/password-policy.ts]
const result = validatePassword('Abcdef1!x');
// { valid: true, categories: 4 }
```

`reason` 仅在校验失败时出现：

| `reason` | 含义 |
| --- | --- |
| `length` | 长度不在 9 到 128 的闭区间内 |
| `characters` | 包含空格、控制字符或非 ASCII 字符 |
| `categories` | 字符类别少于三类 |

长度校验和字符校验失败时，返回的 `categories` 为 `0`。当密码通过前两项检查但字符类别不足时，`categories` 返回实际命中的类别数。

密码策略只检查语法强度，不检查常见密码、泄露密码、重复使用历史或密码哈希。这些规则需要由认证服务另行处理。

## `visibleIf` 条件表达式

### `parseVisibleIf`

`parseVisibleIf(input)` 将不可信的运行时输入解析为类型安全的 `VisibleIfExpression`。解析器拒绝未知属性、未知操作符、空条件数组、空 `fieldId` 和非 JSON 值，并在结构不合法时抛出 `TypeError`。

支持的表达式如下：

| 形式 | 字段 | 语义 |
| --- | --- | --- |
| 比较 | `equals`、`not_equals`、`contains` + `value` | 比较字段值；`contains` 支持字符串子串或数组元素 |
| 成员 | `in`、`not_in` + `values` | 判断字段值是否存在于 JSON 值数组 |
| 空值 | `is_empty`、`is_not_empty` | 判断字段值是否为空 |
| 组合 | `and`、`or` + `conditions` | 对一个或多个子表达式执行逻辑合取或析取 |
| 否定 | `not` + `condition` | 反转子表达式结果 |

```ts [packages/utils/src/visible-if.ts]
const expression = parseVisibleIf({
  operator: 'and',
  conditions: [
    { fieldId: 'q_role', operator: 'in', values: ['student', 'teacher'] },
    { fieldId: 'q_disabled', operator: 'equals', value: false },
  ],
});
```

`parseVisibleIf` 不检查 `fieldId` 是否存在于某个具体表单 Schema。需要校验引用关系时，应将表达式放入 `validateFormSchemaExtensions` 处理。

### `evaluateVisibleIf`

`evaluateVisibleIf(expression, values)` 使用以表单项 ID 为键的值对象计算已解析表达式，并返回布尔值。对象和数组的相等判断使用与 `canonicalizeJson` 相同的递归稳定化规则，因此对象键顺序不会影响比较结果。

空值判断将 `undefined`、`null`、空字符串和空数组视为空。对于除 `is_empty` 和 `is_not_empty` 之外的操作符，缺失字段会返回 `false`，包括 `not_equals` 和 `not_in`；这个保守行为可以避免未填写字段意外满足显示条件。

```ts [packages/utils/src/visible-if.ts]
const visible = evaluateVisibleIf(expression, {
  q_role: 'student',
  q_disabled: false,
});
// true
```

`contains` 在字符串上执行子串匹配，在数组上执行元素级 JSON 相等匹配；其他数据类型不会匹配。`and` 使用全部子条件为真，`or` 使用至少一个子条件为真，`not` 返回子条件结果的相反值。

## 使用建议

- 在认证 DTO 的规范化转换阶段调用 `normalizeEmail` 和 `normalizeUsername`，确保查询和持久化使用相同的值。
- 使用 `isE164Phone` 做格式分流或语法检查，仍需通过验证流程确认号码归属和可用性。
- 在比较或持久化 JSON 内容前调用 `canonicalizeJson` 或 `checksumJson`，不要直接依赖对象插入顺序。
- 对外部传入的 `visibleIf` 和表单 Schema 先执行解析或扩展校验，再交给业务逻辑使用。
- `validateFormSchemaExtensions` 不能替代 AJV 等标准 JSON Schema 校验器；两者应按“标准 Schema 校验，再平台扩展校验”的顺序执行。
