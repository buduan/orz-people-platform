# 当前能力

本文记录 Orz People Platform 当前代码已经实现的能力，以及仍处于内部服务或页面占位状态的部分。内容以仓库当前实现为准，不把 OpenSpec 设计或预留导航当作已完成能力。

## 已实现的后端能力

- 账号注册：邮箱验证、用户名和姓名设置，以及默认 Workspace 成员初始化。
- 登录与会话：密码登录、邮箱验证码登录、Access JWT、Redis Refresh Session、单次 Refresh Token 轮换和重放检测。
- 进阶认证：Passkey、邮箱/SMS/TOTP MFA、密码修改、密码重置、已验证手机号绑定和会话管理。
- 用户与 Workspace：用户资料、用户状态、默认 Workspace（ID 为 `1`）、成员状态、系统 `guest`/`member` 类型和自定义成员类型。
- 授权：Workspace 角色、角色权限、成员直接 `allow`/`deny` 授权、Workspace 管理员和系统管理员；`GET /user/permission` 返回当前用户解析后的 actor（有效权限与管理员标记）。
- 审计：重要的认证、成员、权限和管理操作写入 PostgreSQL 的 append-only `AuditLog`。
- 邮件：Power Automate webhook 通道，系统管理员可配置 URL（存于 Redis key `settings:email:power-automate:webhook-url`），用于发送邮箱验证码等通知；`GET/PUT /mail/config` 受 `system_admin` 保护，邮件发送本身不对外暴露 HTTP 路由。

## 已实现但暂未暴露 HTTP API 的领域能力

`DatasetsModule`、`FormsModule`、`FormSubmissionsModule` 和 `SpecialDatasetsModule` 当前只注册领域服务，没有注册 Controller。它们可以被后端内部模块调用，但还不能直接通过公开 REST API 管理。

- Dataset：`standard`、`members`、`join_requests` 和 `activity_registrations` 类型，字段定义、JSON Schema 值校验、行数据、关系字段、协作者和归档。
- 历史与并发：Dataset 定义快照、Dataset 行版本、软删除/恢复和基于 `revision` 的乐观并发控制。
- 特殊数据：成员资料同步、游客加入申请及批准/拒绝、活动及活动报名绑定。
- Form：Draft 2020-12 JSON Schema、受控 `x-orz` 扩展、多语言文案、`visibleIf`、关联字段筛选、草稿/发布版本和匿名/登录提交策略。
- Form 提交：`create_row`、`update_subject_row`、AJV 校验、设备信息采集、幂等键、规范化 JSON checksum 和事务性写入。

## 当前前端能力

- Nuxt 3 + Nuxt UI + Pinia 基础应用。
- 登录、注册、邮箱验证、密码登录、邮箱验证码登录、Passkey 登录、MFA 和密码重置流程。
- 认证状态、Access/Refresh Token Cookie 持久化、API 响应解包、统一错误处理和安全重定向。
- 响应式 Dashboard 布局预览：桌面侧栏折叠、移动端 Slideover、Workspace 切换器和用户面板。

`/dashboard` 当前是布局调试页。`/people`、`/organization`、`/access` 目前只是导航目标，尚未提供对应页面。`/settings` 已提供 Power Automate 邮件 webhook 配置（仅系统管理员可见）。
