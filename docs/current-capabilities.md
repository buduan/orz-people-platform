# 当前能力

本文记录 Orz People Platform 当前代码已经实现的能力，以及仍处于内部服务或页面占位状态的部分。内容以仓库当前实现为准，不把 OpenSpec 设计或预留导航当作已完成能力。

## 已实现的后端能力

- 账号注册：邮箱验证、用户名和姓名设置，以及默认 Workspace 成员初始化。
- 登录与会话：密码登录、邮箱验证码登录、Access JWT、Redis Refresh Session、单次 Refresh Token 轮换和重放检测。
- 进阶认证：Passkey、邮箱/SMS/TOTP MFA、密码修改、密码重置、已验证手机号绑定和会话管理。
- 用户与 Workspace：用户资料、用户状态、默认 Workspace（ID 为 `1`）、成员状态、系统 `guest`/`member` 类型和自定义成员类型。
- 授权：Workspace 角色、角色权限、成员直接 `allow`/`deny` 授权、Workspace 管理员和系统管理员。
- 审计：重要的认证、成员、权限和管理操作写入 PostgreSQL 的 append-only `AuditLog`。

## 已实现的 Dataset HTTP 能力

`DatasetsModule` 已注册受保护的 Workspace REST API，支持可见数据表列表、安全详情投影、能力矩阵、标准/加入申请数据表创建、元数据与归档、字段定义、绝对行窗口、行变更和关联选项查询。

- Dataset：`standard`、`members`、`join_requests` 和 `activity_registrations` 类型，字段定义、JSON Schema 值校验、行数据、关系字段、协作者和归档。
- 历史与并发：Dataset 定义快照、Dataset 行版本、软删除/恢复和基于 `revision` 的乐观并发控制。
- 查询：空查询使用数据库绝对窗口；筛选、排序与分组复用前后端共享语义，复杂查询上限为 5,000 条活跃行。
- 权限：列表可见性和详情/变更均在 Service 层校验；特殊 Dataset 与归档 Dataset 返回服务端计算的只读能力。

## 已实现但暂未暴露 HTTP API 的领域能力

`FormsModule`、`FormSubmissionsModule` 和 `SpecialDatasetsModule` 当前仍只注册领域服务，可以被后端内部模块调用，但还不能直接通过公开 REST API 管理。
- 特殊数据：成员资料同步、游客加入申请及批准/拒绝、活动及活动报名绑定。
- Form：JSON Schema（AJV Draft 2020-12 方言，不要求 `$schema`）、受控 `x-form` 扩展、多语言文案、`availableIf`、关联字段筛选、草稿/发布版本和匿名/登录提交策略。详见 [form-schema.md](./form-schema.md)。
- Form 提交：`create_row`、`update_subject_row`、AJV 校验、设备信息采集、幂等键、规范化 JSON checksum 和事务性写入。

## 当前前端能力

- Nuxt 3 + Nuxt UI + Pinia 基础应用。
- 登录、注册、邮箱验证、密码登录、邮箱验证码登录、Passkey 登录、MFA 和密码重置流程。
- 认证状态、Access/Refresh Token Cookie 持久化、API 响应解包、统一错误处理和安全重定向。
- 响应式 Dashboard 布局预览：桌面侧栏折叠、移动端 Slideover、Workspace 切换器和用户面板。
- `/panel/dataset` 数据表列表：加载、错误重试、空状态、创建、打开和乐观锁归档。
- `/panel/dataset/:id` 数据表编辑器：Header + 高密度数据表、绝对窗口、筛选/排序/分组、字段与行变更、关系选项和能力驱动只读状态。

`/dashboard` 当前是布局调试页。`/people`、`/organization`、`/access` 和 `/settings` 目前只是导航目标，尚未提供对应页面。Form 编辑器仍是布局占位，且 Form 尚未暴露 HTTP Controller。
