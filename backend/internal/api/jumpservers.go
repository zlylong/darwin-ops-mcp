package api

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/zlylong/darwin-ops-mcp/backend/internal/domain"
)

func normalizeJumpServerURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("baseUrl is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("baseUrl must be a valid absolute URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("baseUrl scheme must be http or https")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/"), nil
}

func validateJumpServerRequest(req domain.JumpServerInstanceRequest, create bool) (domain.JumpServerInstanceRequest, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Version = strings.TrimSpace(req.Version)
	req.Status = strings.TrimSpace(req.Status)
	req.Description = strings.TrimSpace(req.Description)
	if create && req.Name == "" {
		return req, errors.New("name is required")
	}
	if create || strings.TrimSpace(req.BaseURL) != "" {
		baseURL, err := normalizeJumpServerURL(req.BaseURL)
		if err != nil {
			return req, err
		}
		req.BaseURL = baseURL
	}
	if req.AuthType == "" {
		req.AuthType = domain.JumpServerAuthToken
	}
	switch req.AuthType {
	case domain.JumpServerAuthSession, domain.JumpServerAuthToken, domain.JumpServerAuthPrivateToken, domain.JumpServerAuthAccessKey:
	default:
		return req, errors.New("authType must be session, token, private_token, or access_key")
	}
	if req.Status == "" {
		req.Status = "active"
	}
	switch req.Status {
	case "active", "inactive", "unreachable":
	default:
		return req, errors.New("status must be active, inactive, or unreachable")
	}
	return req, nil
}

func (s *Server) listJumpServers(c *gin.Context) {
	if !s.requireAdminRole(c) {
		return
	}
	c.JSON(http.StatusOK, s.registry.JumpServers().List())
}

func (s *Server) getJumpServer(c *gin.Context) {
	if !s.requireAdminRole(c) {
		return
	}
	item, ok := s.registry.JumpServers().Get(strings.TrimSpace(c.Param("id")))
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "jumpserver instance not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (s *Server) createJumpServer(c *gin.Context) {
	if !s.requireAdminRole(c) {
		return
	}
	var req domain.JumpServerInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	req, err := validateJumpServerRequest(req, true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item := s.registry.JumpServers().Add(domain.JumpServerInstance{Name: req.Name, BaseURL: req.BaseURL, Version: req.Version, AuthType: req.AuthType, Status: req.Status, Description: req.Description}, strings.TrimSpace(req.Credential), strings.TrimSpace(req.AccessKeyID), strings.TrimSpace(req.AccessKeySecret))
	c.JSON(http.StatusCreated, item)
}

func (s *Server) updateJumpServer(c *gin.Context) {
	if !s.requireAdminRole(c) {
		return
	}
	var req domain.JumpServerInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	req, err := validateJumpServerRequest(req, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := s.registry.JumpServers().Update(strings.TrimSpace(c.Param("id")), func(j *domain.JumpServerInstance) {
		if req.Name != "" {
			j.Name = req.Name
		}
		if req.BaseURL != "" {
			j.BaseURL = req.BaseURL
		}
		if req.Version != "" {
			j.Version = req.Version
		}
		j.AuthType = req.AuthType
		j.Status = req.Status
		j.Description = req.Description
	}, strings.TrimSpace(req.Credential), strings.TrimSpace(req.AccessKeyID), strings.TrimSpace(req.AccessKeySecret))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (s *Server) deleteJumpServer(c *gin.Context) {
	if !s.requireAdminRole(c) {
		return
	}
	if err := s.registry.JumpServers().Delete(strings.TrimSpace(c.Param("id"))); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (s *Server) testJumpServer(c *gin.Context) {
	if !s.requireAdminRole(c) {
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	item, ok := s.registry.JumpServers().Get(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "jumpserver instance not found"})
		return
	}
	checkedAt := time.Now().UTC()
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()
	probeURL := strings.TrimRight(item.BaseURL, "/") + "/api/docs/"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, probeURL, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		_, _ = s.registry.JumpServers().MarkChecked(id, "unreachable", checkedAt)
		c.JSON(http.StatusOK, domain.JumpServerConnectionCheck{ID: item.ID, Name: item.Name, BaseURL: item.BaseURL, Reachable: false, Status: "unreachable", Message: err.Error(), CheckedAt: checkedAt})
		return
	}
	_ = res.Body.Close()
	reachable := res.StatusCode < 500
	status := "active"
	message := "JumpServer API docs endpoint reachable"
	if !reachable {
		status = "unreachable"
		message = res.Status
	}
	_, _ = s.registry.JumpServers().MarkChecked(id, status, checkedAt)
	c.JSON(http.StatusOK, domain.JumpServerConnectionCheck{ID: item.ID, Name: item.Name, BaseURL: item.BaseURL, Reachable: reachable, Status: status, Message: message, CheckedAt: checkedAt})
}
