# AGENTS.md（中文版）

本仓库是 **ops-mcp**：一个 Go 后端 + React + TypeScript + Vite 前端的 Ops MCP 运维平台。

本文档是给 Codex 及其他代码 Agent 在本仓库中工作的长期规则。

> English version: [AGENTS.md](AGENTS.md)

## 用户背景

- 用户不是程序员。
- 不要留下需要用户自己写代码才能完成的 TODO。
- 如果某项能力尚未完整实现，应当二选一：
  - 实现一个安全的 mock，让仓库始终可运行；或
  - 为后续代码 Agent 创建清晰的后续任务描述。
- 每次任务结束时，仓库都必须保持可运行状态。

## 安全优先

- 不要实现任意 Shell 执行。
- 不要实现 `kubectl exec`。
- 不要实现资源删除类工具，包括删除 namespace、PVC、workload 或 cluster。
- 不要硬编码凭据、token、kubeconfig、API key、数据库密码或其他 secret。
- 没有显式审批时，不允许生产环境写操作。
- 高风险操作必须经过策略检查、审计记录，并在 UI 中明确确认。

## 后端规则

- 使用 Go。
- 使用清晰的架构边界：
  - transport/API 层只处理 HTTP；
  - application/service 层负责用例；
  - domain 层负责核心类型与策略；
  - adapters/infrastructure 层集成外部系统。
- 所有工具调用必须经过 Tool Registry。
- 所有工具调用必须经过 Policy Engine。
- 所有工具调用必须写入 Audit Records。
- 所有 adapter 都必须支持 mock mode。
- mock mode 必须在没有真实 Kubernetes、Prometheus、PostgreSQL migration 或 Redis 的情况下运行。
- REST API 默认必须继续放在 `/api/v1` 下；除非已有明确迁移方案，否则不得破坏版本路径。

## 前端规则

- 使用 React + TypeScript + Vite。
- 使用 Ant Design。
- 所有 API 调用必须有类型定义。
- 网络 UI 必须展示 loading、error 和 empty 状态。
- 高风险操作执行前必须展示确认 UI。
- 即使后端也会阻止危险操作，前端也不要暴露不安全操作。

## 测试

- 为后端 policy、audit、tool registry 行为添加单元测试。
- 在可行时添加前端基础测试。
- 完成任务前必须运行测试。
- 至少运行：

```bash
make test
```

- 修改构建或运行时代码时，还要运行：

```bash
make lint
make build
```

## 文档

当行为、安装方式、API、安全假设或运维流程发生变化时，必须保持文档同步：

- `README.md` 和 `README.zh-CN.md`
- `docs/API.md` 和 `docs/API.zh-CN.md`
- `docs/SECURITY.md` 和 `docs/SECURITY.zh-CN.md`
- 相关架构或运维文档及其中文版

## 交付

- 每次变更都必须让项目仍可通过 Docker Compose 运行。
- 保持 `docker-compose.yml`、Dockerfile 和 Makefile 命令可用。
- 以下常用命令应保持有效：

```bash
make dev
make test
make lint
make build
make docker-up
make docker-down
```
