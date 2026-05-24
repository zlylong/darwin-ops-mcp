# 第三方 AI Agent Skill 说明

本仓库在 `.hermes/skills/darwin-ops-mcp-third-party-ai-agent/SKILL.md` 提供了面向第三方 AI Agent 的专用技能文档。

该 Skill 不是普通用户文档，而是给外部 AI Agent 读取的操作规范，覆盖：

- 通过 `POST /api/v1/applications` 申请工具访问；
- 通过 REST `POST /api/v1/tools/:name/execute` 调用工具；
- 通过 MCP `/mcp` 的 `tools/list` / `tools/call` 调用工具；
- 处理 `202 pending_approval`、执行审批、审批后自动执行与执行状态查询；
- 理解 `readOnly`、`risk`、`requiresApproval`、`role`、`approved` 的策略规则；
- 记录 `executionId`、`approvalId`、`auditId`、`X-Trace-ID` 等审计字段；
- 错误码、重试策略和常见误区。

建议任何第三方 AI Agent 在接入 darwin-ops-mcp 前先读取：

```text
.hermes/skills/darwin-ops-mcp-third-party-ai-agent/SKILL.md
```


## JumpServer 多实例对接

- 通过 `/api/v1/jumpservers` 管理多个 JumpServer 服务器配置。
- 前端页面：`/jumpservers`（JumpServer 管理）。
- 支持认证方式：`token`、`private_token`、`access_key`、`session`，语义参考 JumpServer v2 REST API。
- 凭据字段仅写入；API 响应只返回 `hasCredential`，不得记录真实 Token、Secret、Session。
- 当前配置为内存存储，生产环境需迁移持久化并加密保存凭据。
