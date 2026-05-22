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
