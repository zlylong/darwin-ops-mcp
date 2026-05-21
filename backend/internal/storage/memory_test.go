package storage

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/zlylong/darwin-ops-mcp/backend/internal/domain"
)

func TestExecutionStore_Add(t *testing.T) {
	store := NewExecutionStore()

	// 测试添加新执行
	e := domain.Execution{
		Tool:      "k8s.list_pods",
		AuditID:   "aud-123",
		Actor:     "test-user",
		Role:      domain.RoleViewer,
		Target:    "local-dev",
		Status:    "succeeded",
		Reason:    "test execution",
		CreatedAt: time.Now().UTC(),
	}
	result := store.Add(e)

	assert.NotEmpty(t, result.ID)
	assert.Equal(t, "k8s.list_pods", result.Tool)
	assert.Equal(t, "aud-123", result.AuditID)
	assert.Equal(t, "test-user", result.Actor)
}

func TestExecutionStore_List(t *testing.T) {
	store := NewExecutionStore()

	e1 := domain.Execution{Tool: "tool1", AuditID: "aud-1", Actor: "user1", Role: domain.RoleViewer, Target: "t1", Status: "succeeded", Reason: "test"}
	e2 := domain.Execution{Tool: "tool2", AuditID: "aud-2", Actor: "user2", Role: domain.RoleOperator, Target: "t2", Status: "failed", Reason: "test"}
	store.Add(e1)
	store.Add(e2)

	list := store.List()
	assert.Len(t, list, 2)
	assert.Equal(t, "tool2", list[0].Tool)
	assert.Equal(t, "tool1", list[1].Tool)
}

func TestExecutionStore_Get(t *testing.T) {
	store := NewExecutionStore()

	e := domain.Execution{Tool: "test-tool", AuditID: "aud-test", Actor: "test", Role: domain.RoleViewer, Target: "test", Status: "succeeded", Reason: "test"}
	added := store.Add(e)

	found, ok := store.Get(added.ID)
	assert.True(t, ok)
	assert.Equal(t, added.ID, found.ID)
	assert.Equal(t, "test-tool", found.Tool)

	_, ok = store.Get("nonexistent")
	assert.False(t, ok)
}

func TestApprovalStore_Add(t *testing.T) {
	store := NewApprovalStore()

	a := domain.Approval{
		ExecutionID: "exe-123",
		Tool:        "k8s.list_pods",
		Actor:       "test-user",
		Target:      "local-dev",
		Status:      domain.ApprovalPending,
		Reason:      "test approval",
		CreatedAt:   time.Now().UTC(),
	}
	result := store.Add(a)

	assert.NotEmpty(t, result.ID)
	assert.Equal(t, "exe-123", result.ExecutionID)
	assert.Equal(t, domain.ApprovalPending, result.Status)
}

func TestApprovalStore_Decide(t *testing.T) {
	store := NewApprovalStore()

	a := domain.Approval{
		ExecutionID: "exe-123",
		Tool:        "k8s.list_pods",
		Actor:       "test-user",
		Target:      "local-dev",
		Status:      domain.ApprovalPending,
		Reason:      "test approval",
		CreatedAt:   time.Now().UTC(),
	}
	added := store.Add(a)

	// 测试批准
	approved, err := store.Decide(added.ID, domain.ApprovalApproved)
	assert.NoError(t, err)
	assert.Equal(t, domain.ApprovalApproved, approved.Status)
	assert.NotNil(t, approved.DecidedAt)

	// 测试拒绝
	rejected, err := store.Decide(added.ID, domain.ApprovalRejected)
	assert.NoError(t, err)
	assert.Equal(t, domain.ApprovalRejected, rejected.Status)

	// 测试未找到
	_, err = store.Decide("nonexistent", domain.ApprovalApproved)
	assert.Error(t, err)
}

func TestExecutionStore_Update(t *testing.T) {
	store := NewExecutionStore()
	added := store.Add(domain.Execution{Tool: "test", Actor: "user", Role: domain.RoleViewer, Target: "t", Status: "completed", Reason: "test"})

	// Update to error status
	err := store.Update(added.ID, func(e *domain.Execution) {
		e.Status = "error"
		e.Reason = "handler failed"
	})
	assert.NoError(t, err)

	updated, ok := store.Get(added.ID)
	assert.True(t, ok)
	assert.Equal(t, "error", updated.Status)
	assert.Equal(t, "handler failed", updated.Reason)

	// Verify only one record exists
	list := store.List()
	assert.Len(t, list, 1)
	assert.Equal(t, "error", list[0].Status)

	// Update non-existent ID
	err = store.Update("nonexistent", func(ex *domain.Execution) { ex.Status = "updated" })
	assert.Error(t, err)
}

func TestApprovalStore_Decide_ReturnsCopy(t *testing.T) {
	store := NewApprovalStore()
	added := store.Add(domain.Approval{ExecutionID: "exe-1", Tool: "test", Actor: "user", Target: "t", Status: domain.ApprovalPending, Reason: "test"})

	approved, err := store.Decide(added.ID, domain.ApprovalApproved)
	assert.NoError(t, err)
	assert.Equal(t, domain.ApprovalApproved, approved.Status)
	assert.NotNil(t, approved.DecidedAt)

	// Mutate the returned value - stored data must not be affected
	// because Decide returns a copy, not the internal pointer.
	approved.Status = domain.ApprovalRejected
	approved.DecidedAt = nil

	list := store.List()
	assert.Len(t, list, 1)
	assert.Equal(t, domain.ApprovalApproved, list[0].Status, "stored item must not be affected by mutating returned value")
	assert.NotNil(t, list[0].DecidedAt, "stored DecidedAt must not be cleared by mutating returned value")
}

func TestExecutionStore_Update_Concurrent(t *testing.T) {
	store := NewExecutionStore()
	e := store.Add(domain.Execution{Tool: "test", Actor: "user", Role: domain.RoleViewer, Target: "t", Status: "started", Reason: "test"})

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = store.Update(e.ID, func(ex *domain.Execution) {
				ex.Status = "updated"
			})
		}()
	}
	wg.Wait()

	// Should have exactly one record (no duplication) and final status set
	list := store.List()
	assert.Len(t, list, 1)
	assert.Equal(t, "updated", list[0].Status)
}

func TestExecutionStore_Add_Concurrent(t *testing.T) {
	t.Parallel()
	store := NewExecutionStore()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			e := domain.Execution{
				Tool:      "tool",
				AuditID:   "aud",
				Actor:     "user",
				Role:      domain.RoleViewer,
				Target:    "t",
				Status:    "succeeded",
				Reason:    "test",
				CreatedAt: time.Now().UTC(),
			}
			result := store.Add(e)
			assert.NotEmpty(t, result.ID)
		}(i)
	}
	wg.Wait()
	list := store.List()
	assert.Len(t, list, 50)
}

func TestExecutionStore_Update_ConcurrentStress(t *testing.T) {
	t.Parallel()
	store := NewExecutionStore()
	e := store.Add(domain.Execution{Tool: "test", Actor: "user", Role: domain.RoleViewer, Target: "t", Status: "started", Reason: "test"})

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_ = store.Update(e.ID, func(ex *domain.Execution) {
				ex.Status = "done"
			})
		}(i)
	}
	wg.Wait()

	list := store.List()
	assert.Len(t, list, 1)
	assert.Equal(t, "done", list[0].Status)
}

func TestApprovalStore_Add_Concurrent(t *testing.T) {
	t.Parallel()
	store := NewApprovalStore()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			a := domain.Approval{
				ExecutionID: "exe-1",
				Tool:        "test",
				Actor:       "user",
				Target:      "t",
				Status:      domain.ApprovalPending,
				Reason:      "test",
				CreatedAt:   time.Now().UTC(),
			}
			result := store.Add(a)
			assert.NotEmpty(t, result.ID)
		}(i)
	}
	wg.Wait()
	list := store.List()
	assert.Len(t, list, 50)
}

func TestApprovalStore_Decide_Concurrent(t *testing.T) {
	t.Parallel()
	store := NewApprovalStore()
	added := store.Add(domain.Approval{ExecutionID: "exe-1", Tool: "test", Actor: "user", Target: "t", Status: domain.ApprovalPending, Reason: "test"})

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			approved, err := store.Decide(added.ID, domain.ApprovalApproved)
			assert.NoError(t, err)
			assert.Equal(t, domain.ApprovalApproved, approved.Status)
		}(i)
	}
	wg.Wait()

	list := store.List()
	assert.Len(t, list, 1)
}

func TestExecutionStore_MixedReadWrite_Concurrent(t *testing.T) {
	t.Parallel()
	store := NewExecutionStore()
	added := store.Add(domain.Execution{Tool: "test", Actor: "user", Role: domain.RoleViewer, Target: "t", Status: "started", Reason: "test"})

	var wg sync.WaitGroup
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			if idx%3 == 0 {
				// Write
				_ = store.Update(added.ID, func(ex *domain.Execution) { ex.Status = "updated" })
			} else {
				// Read
				_, ok := store.Get(added.ID)
				assert.True(t, ok)
			}
		}(i)
	}
	wg.Wait()
	list := store.List()
	assert.Len(t, list, 1)
}
