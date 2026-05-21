package api

import "github.com/zlylong/darwin-ops-mcp/backend/internal/domain"

// swaggerHealth documents the root health endpoint.
//
// @Summary Health Check
// @Description Returns backend runtime health and object counts.
// @Tags system
// @Produce json
// @Success 200 {object} map[string]any
// @Router /healthz [get]
func swaggerHealth() {}

// swaggerDashboardSummary documents dashboard summary.
//
// @Summary Dashboard Summary
// @Description Returns summary counts for tools, executions, audit records, and approvals.
// @Tags dashboard
// @Produce json
// @Success 200 {object} map[string]any
// @Router /api/v1/dashboard/summary [get]
func swaggerDashboardSummary() {}

// swaggerListTools documents tool listing.
//
// @Summary List Tools
// @Description Returns all registered tools.
// @Tags tools
// @Produce json
// @Success 200 {array} domain.Tool
// @Router /api/v1/tools [get]
func swaggerListTools() {}

// swaggerGetTool documents tool detail lookup.
//
// @Summary Get Tool
// @Description Returns a single registered tool by name.
// @Tags tools
// @Produce json
// @Param name path string true "Tool name"
// @Success 200 {object} domain.Tool
// @Failure 404 {object} map[string]string
// @Router /api/v1/tools/{name} [get]
func swaggerGetTool() {}

// swaggerListExecutions documents execution listing.
//
// @Summary List Executions
// @Description Returns all execution records.
// @Tags executions
// @Produce json
// @Success 200 {array} domain.Execution
// @Router /api/v1/executions [get]
func swaggerListExecutions() {}

// swaggerGetExecution documents execution detail lookup.
//
// @Summary Get Execution
// @Description Returns an execution record by ID.
// @Tags executions
// @Produce json
// @Param id path string true "Execution ID"
// @Success 200 {object} domain.Execution
// @Failure 404 {object} map[string]string
// @Router /api/v1/executions/{id} [get]
func swaggerGetExecution() {}

// swaggerListAuditRecords documents audit listing.
//
// @Summary List Audit Records
// @Description Returns all audit records.
// @Tags audit
// @Produce json
// @Success 200 {array} domain.AuditRecord
// @Router /api/v1/audit [get]
func swaggerListAuditRecords() {}

// swaggerListApprovals documents approval listing.
//
// @Summary List Execution Approvals
// @Description Returns all execution approval records.
// @Tags approvals
// @Produce json
// @Success 200 {array} domain.Approval
// @Router /api/v1/approvals [get]
func swaggerListApprovals() {}

// swaggerApproveApproval documents execution approval approval.
//
// @Summary Approve Execution Approval
// @Description Marks a pending execution approval as approved.
// @Tags approvals
// @Produce json
// @Param id path string true "Approval ID"
// @Success 200 {object} domain.Approval
// @Failure 404 {object} map[string]string
// @Router /api/v1/approvals/{id}/approve [post]
func swaggerApproveApproval() {}

// swaggerRejectApproval documents execution approval rejection.
//
// @Summary Reject Execution Approval
// @Description Marks a pending execution approval as rejected.
// @Tags approvals
// @Produce json
// @Param id path string true "Approval ID"
// @Success 200 {object} domain.Approval
// @Failure 404 {object} map[string]string
// @Router /api/v1/approvals/{id}/reject [post]
func swaggerRejectApproval() {}

// keepDomainReference prevents future tooling from pruning the domain import in
// environments that inspect declarations without parsing swag comments.
var _ = domain.Tool{}
