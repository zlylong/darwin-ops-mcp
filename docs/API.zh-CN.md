# API（中文版）

Base URL：`/api/v1`

> English version: [API.md](API.md)

## Health

`GET /healthz`

返回后端状态、模式和环境。

## Dashboard summary

`GET /api/v1/dashboard/summary`

响应示例：

```json
{
  "mode": "mock",
  "environment": "development",
  "tools": 9,
  "executions": 0,
  "auditRecords": 0,
  "approvals": 0
}
```

## Tool Registry

`GET /api/v1/tools`

列出已注册工具。

`GET /api/v1/tools/:name`

返回单个工具详情，包括分类、是否只读、风险等级、是否需要审批以及输入 schema。

已实现工具：

- `k8s.list_pods`
- `k8s.get_pod_logs`
- `k8s.list_events`
- `k8s.get_deployment_status`
- `prometheus.query`
- `prometheus.service_error_rate`
- `prometheus.service_latency_p95`
- `prometheus.pod_cpu_usage`
- `prometheus.pod_memory_usage`

## Execute tool

`POST /api/v1/tools/:name/execute`

请求：

```json
{
  "actor": "local-user",
  "role": "viewer",
  "target": "default/api",
  "approved": false,
  "parameters": {
    "namespace": "default"
  }
}
```

成功响应：

```json
{
  "executionId": "exe-...",
  "auditId": "aud-...",
  "status": "succeeded",
  "message": "tool executed",
  "data": {}
}
```

错误响应：

- `400` JSON 无效或输入校验失败
- `403` 策略拒绝
- `404` 未知工具
- `409` 需要审批
- `500` adapter 执行失败

## Execution History

`GET /api/v1/executions`

按时间倒序列出执行记录。

`GET /api/v1/executions/:id`

返回单条执行记录。

## Audit

`GET /api/v1/audit`

按时间倒序返回内存中的审计记录。包含 password、token、secret、api key、authorization 和 credential 等敏感标记的参数 key 会被脱敏。

## Approval Flow Skeleton

`GET /api/v1/approvals`

列出审批请求。

`POST /api/v1/approvals/:id/approve`

将审批标记为 approved。

`POST /api/v1/approvals/:id/reject`

将审批标记为 rejected。

MVP 的审批接口目前只更新审批状态，尚不会自动重放被阻止的执行。
