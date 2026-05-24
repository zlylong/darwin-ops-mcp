package storage

import (
	"errors"
	"strconv"
	"sync"
	"time"

	"github.com/zlylong/darwin-ops-mcp/backend/internal/domain"
)

type ExecutionStore struct {
	mu    sync.RWMutex
	items []domain.Execution
}

func NewExecutionStore() *ExecutionStore {
	return &ExecutionStore{items: make([]domain.Execution, 0, 64)}
}
func (s *ExecutionStore) Add(e domain.Execution) domain.Execution {
	if e.ID == "" {
		e.ID = newID("exe")
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	s.mu.Lock()
	s.items = append([]domain.Execution{e}, s.items...)
	s.mu.Unlock()
	return e
}
func (s *ExecutionStore) List() []domain.Execution {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]domain.Execution, len(s.items))
	copy(out, s.items)
	return out
}
func (s *ExecutionStore) Get(id string) (domain.Execution, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, item := range s.items {
		if item.ID == id {
			return item, true
		}
	}
	return domain.Execution{}, false
}

// Update applies fn to the execution with the given id.
// Returns error if the execution is not found.
func (s *ExecutionStore) Update(id string, fn func(*domain.Execution)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			fn(&s.items[i])
			return nil
		}
	}
	return errors.New("execution not found")
}

type ApprovalStore struct {
	mu    sync.RWMutex
	items []domain.Approval
}

func NewApprovalStore() *ApprovalStore { return &ApprovalStore{items: make([]domain.Approval, 0, 16)} }
func (s *ApprovalStore) Add(a domain.Approval) domain.Approval {
	if a.ID == "" {
		a.ID = newID("app")
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	s.mu.Lock()
	s.items = append([]domain.Approval{a}, s.items...)
	s.mu.Unlock()
	return a
}
func (s *ApprovalStore) List() []domain.Approval {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]domain.Approval, len(s.items))
	copy(out, s.items)
	return out
}
func (s *ApprovalStore) Decide(id string, status domain.ApprovalStatus) (domain.Approval, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			now := time.Now().UTC()
			s.items[i].Status = status
			s.items[i].DecidedAt = &now
			// Return a copy to avoid exposing internal mutable reference
			out := s.items[i]
			return out, nil
		}
	}
	return domain.Approval{}, errors.New("approval not found")
}

// ── User store (in-memory, bcrypt passwords) ──────────────────────────────────

// userRecord pairs a user domain object with a bcrypt hash of their password.
type userRecord struct {
	domain.User
	PasswordHash string
}

// UserStore provides in-memory user persistence.
type UserStore struct {
	mu    sync.RWMutex
	items []userRecord
}

// NewUserStore returns a new empty UserStore.
func NewUserStore() *UserStore {
	return &UserStore{items: make([]userRecord, 0, 16)}
}

// Add inserts a new user with the given plain-text password.
// The password is bcrypt-hashed before storage; the plaintext is never stored.
func (s *UserStore) Add(u domain.User, password string, hash []byte) domain.User {
	if u.ID == "" {
		u.ID = newID("usr")
	}
	if u.CreatedAt.IsZero() {
		u.CreatedAt = time.Now().UTC()
	}
	if u.UpdatedAt.IsZero() {
		u.UpdatedAt = u.CreatedAt
	}
	rec := userRecord{User: u, PasswordHash: string(hash)}
	s.mu.Lock()
	s.items = append(s.items, rec)
	s.mu.Unlock()
	return u
}

// List returns all users sorted by creation time (newest first).
func (s *UserStore) List() []domain.User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]domain.User, len(s.items))
	for i := range s.items {
		out[i] = s.items[i].User
	}
	return out
}

// Get returns the user with the given ID.
func (s *UserStore) Get(id string) (domain.User, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, item := range s.items {
		if item.ID == id {
			return item.User, true
		}
	}
	return domain.User{}, false
}

// GetByUsername returns the user with the given username.
func (s *UserStore) GetByUsername(username string) (domain.User, string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, item := range s.items {
		if item.Username == username {
			return item.User, item.PasswordHash, true
		}
	}
	return domain.User{}, "", false
}

// Update applies fn to the user with the given id.
func (s *UserStore) Update(id string, fn func(*domain.User)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			fn(&s.items[i].User)
			s.items[i].UpdatedAt = time.Now().UTC()
			return nil
		}
	}
	return errors.New("user not found")
}

// SetPassword updates the bcrypt hash for the user with the given id.
func (s *UserStore) SetPassword(id string, hash []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			s.items[i].PasswordHash = string(hash)
			s.items[i].UpdatedAt = time.Now().UTC()
			return nil
		}
	}
	return errors.New("user not found")
}

// Delete removes the user with the given id.
func (s *UserStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			s.items = append(s.items[:i], s.items[i+1:]...)
			return nil
		}
	}
	return errors.New("user not found")
}

// JumpServer store (in-memory, sanitized reads)

type jumpServerRecord struct {
	domain.JumpServerInstance
	Credential      string
	AccessKeyID     string
	AccessKeySecret string
}

// JumpServerStore provides in-memory persistence for multiple JumpServer instances.
type JumpServerStore struct {
	mu    sync.RWMutex
	items []jumpServerRecord
}

func NewJumpServerStore() *JumpServerStore {
	return &JumpServerStore{items: make([]jumpServerRecord, 0, 8)}
}

func sanitizeJumpServer(rec jumpServerRecord) domain.JumpServerInstance {
	out := rec.JumpServerInstance
	out.HasCredential = rec.Credential != "" || rec.AccessKeyID != "" || rec.AccessKeySecret != ""
	return out
}

func (s *JumpServerStore) Add(instance domain.JumpServerInstance, credential, accessKeyID, accessKeySecret string) domain.JumpServerInstance {
	if instance.ID == "" {
		instance.ID = newID("jms")
	}
	now := time.Now().UTC()
	if instance.CreatedAt.IsZero() {
		instance.CreatedAt = now
	}
	if instance.UpdatedAt.IsZero() {
		instance.UpdatedAt = instance.CreatedAt
	}
	if instance.Status == "" {
		instance.Status = "active"
	}
	rec := jumpServerRecord{JumpServerInstance: instance, Credential: credential, AccessKeyID: accessKeyID, AccessKeySecret: accessKeySecret}
	s.mu.Lock()
	s.items = append([]jumpServerRecord{rec}, s.items...)
	s.mu.Unlock()
	return sanitizeJumpServer(rec)
}

func (s *JumpServerStore) List() []domain.JumpServerInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]domain.JumpServerInstance, len(s.items))
	for i := range s.items {
		out[i] = sanitizeJumpServer(s.items[i])
	}
	return out
}

func (s *JumpServerStore) Get(id string) (domain.JumpServerInstance, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, item := range s.items {
		if item.ID == id {
			return sanitizeJumpServer(item), true
		}
	}
	return domain.JumpServerInstance{}, false
}

func (s *JumpServerStore) Update(id string, fn func(*domain.JumpServerInstance), credential, accessKeyID, accessKeySecret string) (domain.JumpServerInstance, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			fn(&s.items[i].JumpServerInstance)
			s.items[i].UpdatedAt = time.Now().UTC()
			if credential != "" {
				s.items[i].Credential = credential
			}
			if accessKeyID != "" {
				s.items[i].AccessKeyID = accessKeyID
			}
			if accessKeySecret != "" {
				s.items[i].AccessKeySecret = accessKeySecret
			}
			return sanitizeJumpServer(s.items[i]), nil
		}
	}
	return domain.JumpServerInstance{}, errors.New("jumpserver instance not found")
}

func (s *JumpServerStore) MarkChecked(id, status string, checkedAt time.Time) (domain.JumpServerInstance, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			s.items[i].Status = status
			s.items[i].LastCheckedAt = &checkedAt
			s.items[i].UpdatedAt = checkedAt
			return sanitizeJumpServer(s.items[i]), nil
		}
	}
	return domain.JumpServerInstance{}, errors.New("jumpserver instance not found")
}

func (s *JumpServerStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.items {
		if s.items[i].ID == id {
			s.items = append(s.items[:i], s.items[i+1:]...)
			return nil
		}
	}
	return errors.New("jumpserver instance not found")
}

func newID(prefix string) string {
	return prefix + "-" + strconv.FormatInt(time.Now().UTC().UnixNano(), 10)
}
