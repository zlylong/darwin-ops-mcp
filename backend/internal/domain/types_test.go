package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRiskLevel_Values(t *testing.T) {
	assert.Equal(t, "low", string(RiskLow))
	assert.Equal(t, "medium", string(RiskMedium))
	assert.Equal(t, "high", string(RiskHigh))
	assert.Equal(t, "critical", string(RiskCritical))
}

func TestEnvironment_Values(t *testing.T) {
	assert.Equal(t, "development", string(EnvDevelopment))
	assert.Equal(t, "staging", string(EnvStaging))
	assert.Equal(t, "production", string(EnvProduction))
}

func TestRole_Values(t *testing.T) {
	assert.Equal(t, "viewer", string(RoleViewer))
	assert.Equal(t, "operator", string(RoleOperator))
	assert.Equal(t, "admin", string(RoleAdmin))
}

func TestTool_Struct(t *testing.T) {
	tool := Tool{
		Name:             "k8s.list_pods",
		Description:      "List Kubernetes pods",
		Category:         "kubernetes",
		ReadOnly:         true,
		Risk:             RiskLow,
		RequiresApproval: false,
		InputSchema: map[string]ParamSchema{
			"namespace": {Type: "string", Required: false, Description: "Kubernetes namespace"},
		},
	}
	assert.Equal(t, "k8s.list_pods", tool.Name)
	assert.True(t, tool.ReadOnly)
	assert.Equal(t, RiskLow, tool.Risk)
	assert.Equal(t, "string", tool.InputSchema["namespace"].Type)
	assert.False(t, tool.InputSchema["namespace"].Required)
}

func TestParamSchema_Fields(t *testing.T) {
	ps := ParamSchema{
		Type:        "string",
		Required:    true,
		Description: "The hostname to resolve",
		Default:     "example.com",
	}
	assert.Equal(t, "string", ps.Type)
	assert.True(t, ps.Required)
	assert.Equal(t, "The hostname to resolve", ps.Description)
	assert.Equal(t, "example.com", ps.Default)
}

func TestExecuteRequest_Struct(t *testing.T) {
	req := ExecuteRequest{
		Actor:      "test-user",
		Role:       RoleViewer,
		Target:     "local-dev",
		Approved:   true,
		Parameters: map[string]any{"namespace": "default"},
	}
	assert.Equal(t, "test-user", req.Actor)
	assert.Equal(t, RoleViewer, req.Role)
	assert.True(t, req.Approved)
}

func TestPolicyDecision_Struct(t *testing.T) {
	decision := PolicyDecision{
		Allowed:          true,
		RequiresApproval: false,
		Reason:           "allowed by policy",
	}
	assert.True(t, decision.Allowed)
	assert.Equal(t, "allowed by policy", decision.Reason)
}

func TestAuditRecord_Struct(t *testing.T) {
	record := AuditRecord{
		ID:          "aud-123",
		ExecutionID: "exe-123",
		TraceID:     "trace-abc",
		Actor:       "test-user",
		Role:        RoleViewer,
		Action:      "k8s.list_pods",
		Target:      "local-dev",
		Allowed:     true,
		Reason:      "allowed",
		Parameters:  map[string]any{"namespace": "default"},
	}
	assert.Equal(t, "aud-123", record.ID)
	assert.Equal(t, "trace-abc", record.TraceID)
	assert.True(t, record.Allowed)
}

func TestExecution_Struct(t *testing.T) {
	exec := Execution{
		ID:         "exe-123",
		Tool:       "k8s.list_pods",
		Actor:      "test-user",
		Role:       RoleViewer,
		Target:     "local-dev",
		Status:     "succeeded",
		Reason:     "executed",
		Parameters: map[string]any{"namespace": "default"},
		AuditID:    "aud-123",
	}
	assert.Equal(t, "exe-123", exec.ID)
	assert.Equal(t, "succeeded", exec.Status)
}

func TestApproval_Struct(t *testing.T) {
	approval := Approval{
		ID:          "app-123",
		ExecutionID: "exe-123",
		Tool:        "k8s.list_pods",
		Actor:       "test-user",
		Target:      "local-dev",
		Status:      ApprovalPending,
		Reason:      "pending review",
	}
	assert.Equal(t, "app-123", approval.ID)
	assert.Equal(t, ApprovalPending, approval.Status)
}

func TestApproval_Decision(t *testing.T) {
	approval := Approval{
		ID:          "app-123",
		ExecutionID: "exe-123",
		Tool:        "k8s.list_pods",
		Actor:       "test-user",
		Target:      "local-dev",
		Status:      ApprovalPending,
		Reason:      "pending",
	}

	approval.Status = ApprovalApproved
	assert.Equal(t, ApprovalApproved, approval.Status)

	approval.Status = ApprovalRejected
	assert.Equal(t, ApprovalRejected, approval.Status)
}

func TestTool_InputSchema_MultipleParams(t *testing.T) {
	tool := Tool{
		Name:        "linux.journal_tail",
		Description: "Tail journal logs",
		Category:    "linux",
		ReadOnly:    true,
		Risk:        RiskMedium,
		InputSchema: map[string]ParamSchema{
			"unit":  {Type: "string", Required: true, Description: "systemd unit name"},
			"lines": {Type: "number", Required: false, Description: "number of lines"},
		},
	}
	assert.Len(t, tool.InputSchema, 2)
	assert.Equal(t, "string", tool.InputSchema["unit"].Type)
	assert.True(t, tool.InputSchema["unit"].Required)
	assert.Equal(t, "number", tool.InputSchema["lines"].Type)
	assert.False(t, tool.InputSchema["lines"].Required)
}

func TestParamSchema_Validate(t *testing.T) {
	tests := []struct {
		name    string
		schema  ParamSchema
		key     string
		params  map[string]any
		wantErr bool
	}{
		{
			name:    "valid string param",
			schema:  ParamSchema{Type: "string", Required: true, Description: "hostname"},
			key:     "hostname",
			params:  map[string]any{"hostname": "example.com"},
			wantErr: false,
		},
		{
			name:    "missing required param",
			schema:  ParamSchema{Type: "string", Required: true},
			key:     "hostname",
			params:  map[string]any{},
			wantErr: true,
		},
		{
			name:    "optional param missing",
			schema:  ParamSchema{Type: "string", Required: false},
			key:     "hostname",
			params:  map[string]any{},
			wantErr: false,
		},
		{
			name:    "wrong type provided",
			schema:  ParamSchema{Type: "number", Required: true},
			key:     "n",
			params:  map[string]any{"n": "not-a-number"},
			wantErr: true,
		},
		{
			name:    "valid number param",
			schema:  ParamSchema{Type: "number", Required: true},
			key:     "n",
			params:  map[string]any{"n": 42.0},
			wantErr: false,
		},
		{
			name:    "valid boolean param",
			schema:  ParamSchema{Type: "boolean", Required: false},
			key:     "flag",
			params:  map[string]any{"flag": true},
			wantErr: false,
		},
		{
			name:    "missing optional param",
			schema:  ParamSchema{Type: "boolean", Required: false},
			key:     "flag",
			params:  map[string]any{},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.schema.Validate(tt.key, tt.params)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestParamSchema_Validate_NotSuppliedKey(t *testing.T) {
	schema := ParamSchema{Type: "string", Required: true}
	err := schema.Validate("hostname", map[string]any{"other": "value"})
	assert.Error(t, err)
}

func TestParamSchema_Validate_TypeMismatch(t *testing.T) {
	s := ParamSchema{Type: "string"}
	assert.NoError(t, s.Validate("k", map[string]any{"k": "hello"}))
	assert.Error(t, s.Validate("k", map[string]any{"k": 123}))

	n := ParamSchema{Type: "number"}
	assert.NoError(t, n.Validate("k", map[string]any{"k": 123.0}))
	assert.Error(t, n.Validate("k", map[string]any{"k": "not-a-number"}))

	b := ParamSchema{Type: "boolean"}
	assert.NoError(t, b.Validate("k", map[string]any{"k": true}))
	assert.Error(t, b.Validate("k", map[string]any{"k": "not-a-bool"}))
}

func TestTool_ValidateParams(t *testing.T) {
	tool := Tool{
		Name:        "linux.disk_usage",
		Description: "Disk usage",
		Category:    "linux",
		ReadOnly:    true,
		Risk:        RiskLow,
		InputSchema: map[string]ParamSchema{
			"path":      {Type: "string", Required: true, Description: "path to check"},
			"inodes":    {Type: "boolean", Required: false, Description: "show inodes"},
			"threshold": {Type: "number", Required: false, Description: "alert threshold %"},
		},
	}

	// Valid: all required + optional
	err := tool.ValidateParams(map[string]any{"path": "/var", "inodes": true, "threshold": 90.0})
	assert.NoError(t, err)

	// Valid: only required
	err = tool.ValidateParams(map[string]any{"path": "/var"})
	assert.NoError(t, err)

	// Invalid: missing required "path"
	err = tool.ValidateParams(map[string]any{"inodes": true})
	assert.Error(t, err)

	// Invalid: wrong type for "inodes"
	err = tool.ValidateParams(map[string]any{"path": "/var", "inodes": "yes"})
	assert.Error(t, err)

	// Invalid: wrong type for "threshold"
	err = tool.ValidateParams(map[string]any{"path": "/var", "threshold": "high"})
	assert.Error(t, err)
}
