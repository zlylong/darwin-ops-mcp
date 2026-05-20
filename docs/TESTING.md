# Testing Guide

This document describes the testing strategy and implementation for the darwin-ops-mcp backend.

## Overview

The backend uses Go'"'"'s built-in testing framework with `testify` assertions for clean, readable tests.

## Test Organization

```
backend/internal/
├── domain/      # Domain entity tests (types_test.go)
├── policy/      # Policy engine tests (engine_test.go)
├── storage/     # In-memory store tests (store_test.go)
├── app/         # Application service tests (registry_test.go)
├── api/         # HTTP handler tests (router_test.go)
├── audit/       # Audit logging tests (audit_test.go)
└── adapters/    # Integration mocks (no unit tests)
```

## Running Tests

```bash
# Run all backend tests
go test -v ./internal/...

# Run tests for a specific package
go test -v ./internal/api
go test -v ./internal/policy

# Run with coverage
go test -cover ./internal/...

# Run tests matching a pattern
go test -v -run TestEngine ./internal/policy
```

## Test Categories

### Domain Tests (domain/types_test.go)

Tests domain entities and enums:
- TestRiskLevel_Values - Validates risk level constants
- TestEnvironment_Values - Validates environment constants
- TestRole_Values - Validates role constants
- TestTool_Struct - Tool entity structure
- TestExecuteRequest_Struct - ExecuteRequest structure
- TestPolicyDecision_Struct - PolicyDecision structure
- TestAuditRecord_Struct - AuditRecord structure
- TestExecution_Struct - Execution structure
- TestApproval_Struct - Approval structure
- TestApproval_Decision - Approval decision logic

### Policy Tests (policy/engine_test.go)

Tests the policy engine decision matrix:
- TestEngine_Evaluate_CriticalTool - Critical tools are always denied
- TestEngine_Evaluate_ProductionWriteWithoutApproval - Production writes require approval
- TestEngine_Evaluate_ViewerReadOnlyAllowed - Viewer can run read-only tools
- TestEngine_Evaluate_ViewerWriteDenied - Viewer cannot run write tools
- TestEngine_Evaluate_OperatorMediumRiskDev - Operator can run medium-risk in dev
- TestEngine_Evaluate_OperatorMediumRiskProductionAllowed - Operator can run medium-risk in production when approved
- TestEngine_Evaluate_AdminAllowed - Admin has full access
- TestEngine_Evaluate_UnknownRole - Unknown roles are denied
- TestEngine_Evaluate_RiskHighDevDenied - High-risk dev operations denied

### Storage Tests (storage/store_test.go)

Tests in-memory storage:
- TestExecutionStore_Add - Add and list executions
- TestExecutionStore_Get - Get execution by ID
- TestApprovalStore_Add - Add and list approvals
- TestApprovalStore_Decide - Approve/reject workflow

### Application Tests (app/registry_test.go)

Tests the registry service:
- TestRegistry_Register - Tool registration and duplicates
- TestRegistry_List - List tools sorted by name
- TestRegistry_Get - Get tool by name
- TestRegistry_Execute_Completed - Successful execution
- TestRegistry_Execute_Denied - Tool not found
- TestRegistry_Execute_PendingApproval - Approval workflow triggered
- TestRegistry_Approvals - List approvals
- TestRegistry_Approve - Approve workflow
- TestRegistry_Reject - Reject workflow

### API Tests (api/router_test.go)

Tests HTTP handlers:
- TestNewRouter_CORS - Router initialization with CORS
- TestHealthz - Health check endpoint
- TestDashboardSummary - Dashboard summary endpoint
- TestToolsList - List all tools
- TestToolDetail - Get tool details
- TestToolDetail_NotFound - 404 for missing tool
- TestExecuteTool - Execute tool successfully
- TestExecuteTool_ValidationFailure - Handle validation failures
- TestApprovalsList - List pending approvals
- TestApproveApproval - Approve action
- TestRejectApproval - Reject action
- TestAuditRecords - List audit records

### Audit Tests (audit/audit_test.go)

Tests audit logging:
- TestStore_Record - Record audit event
- TestStore_Record_AutoID - Auto-generate audit ID
- TestStore_Record_AutoTimestamp - Auto-generate timestamp
- TestStore_List - List audit records
- TestMask_SensitiveKeys - Mask sensitive data
- TestMask_CaseInsensitive - Case-insensitive masking
- TestMask_NilInput - Handle nil input
- TestMask_EmptyInput - Handle empty input
- TestIsSensitiveKey - Sensitive key detection

## Testing Policy Logic

The policy engine tests cover the following decision matrix:

| Role | Risk | Env | Approved | Result |
|------|------|-----|----------|--------|
| Viewer | Low | Any | - | Allowed (read-only) |
| Viewer | Medium/Critical | Any | - | Denied |
| Operator | Low | Any | - | Allowed |
| Operator | Medium | Dev/Staging | - | Allowed |
| Operator | Medium | Production | Yes | Allowed |
| Operator | Medium | Production | No | Denied (requires approval) |
| Operator | High | Any | - | Denied |
| Admin | Any | Any | - | Allowed |
| Unknown | Any | Any | - | Denied |

## Mocking Dependencies

Use mockRecorder for testing services that depend on audit logging:

```go
type mockRecorder struct{}

func (m *mockRecorder) Record(record domain.AuditRecord) domain.AuditRecord {
    record.ID = "aud-mock-123"
    return record
}
func (m *mockRecorder) List() []domain.AuditRecord { return nil }
```

## Coverage Requirements

Target coverage: **80%+** for all backend packages.

```bash
go test -cover ./internal/...
```

## Continuous Integration

Tests run automatically on:
- PR creation
- Push to main branch

See .github/workflows/test.yml for CI configuration.
