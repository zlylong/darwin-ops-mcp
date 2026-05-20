package linux

import "context"

type MockAdapter struct{}

func NewMockAdapter() *MockAdapter { return &MockAdapter{} }

func (a *MockAdapter) SystemInfo(ctx context.Context, params map[string]any) (map[string]any, error) {
	return map[string]any{
		"hostname":       "darwin-ops-mcp-demo",
		"kernel":         "Linux 6.12.88+deb13-amd64",
		"distribution":   "Debian 13",
		"architecture":   "x86_64",
		"uptimeSeconds":  86400 * 12,
		"bootTime":       "2026-05-08T09:00:00Z",
		"virtualization": "docker",
	}, nil
}

func (a *MockAdapter) LoadAverage(ctx context.Context, params map[string]any) (map[string]any, error) {
	return map[string]any{"load1": 0.42, "load5": 0.36, "load15": 0.31, "cpuCores": 8}, nil
}

func (a *MockAdapter) MemoryUsage(ctx context.Context, params map[string]any) (map[string]any, error) {
	return map[string]any{"totalMiB": 16384, "usedMiB": 7420, "freeMiB": 5120, "availableMiB": 8964, "usedPercent": 45.3, "swapTotalMiB": 2048, "swapUsedMiB": 0}, nil
}

func (a *MockAdapter) DiskUsage(ctx context.Context, params map[string]any) (map[string]any, error) {
	path := stringParam(params, "path", "/")
	return map[string]any{"path": path, "filesystem": "/dev/vda1", "totalGiB": 120, "usedGiB": 42.7, "availableGiB": 77.3, "usedPercent": 35.6}, nil
}

func (a *MockAdapter) ProcessList(ctx context.Context, params map[string]any) (map[string]any, error) {
	limit := intParam(params, "limit", 10)
	processes := []map[string]any{
		{"pid": 1, "user": "root", "cpuPercent": 0.1, "memoryPercent": 0.4, "command": "systemd"},
		{"pid": 842, "user": "root", "cpuPercent": 1.8, "memoryPercent": 3.2, "command": "darwin-ops-mcp"},
		{"pid": 1044, "user": "postgres", "cpuPercent": 0.3, "memoryPercent": 2.1, "command": "postgres"},
		{"pid": 1288, "user": "root", "cpuPercent": 0.2, "memoryPercent": 1.7, "command": "nginx"},
	}
	if limit > 0 && limit < len(processes) {
		processes = processes[:limit]
	}
	return map[string]any{"processes": processes, "limit": limit}, nil
}

func (a *MockAdapter) NetworkInterfaces(ctx context.Context, params map[string]any) (map[string]any, error) {
	return map[string]any{"interfaces": []map[string]any{{"name": "eth0", "state": "UP", "ipv4": "192.168.20.166/24", "rxMiB": 1842.5, "txMiB": 937.2}, {"name": "lo", "state": "UP", "ipv4": "127.0.0.1/8", "rxMiB": 12.4, "txMiB": 12.4}}}, nil
}

func (a *MockAdapter) ServiceStatus(ctx context.Context, params map[string]any) (map[string]any, error) {
	service := stringParam(params, "service", "darwin-ops-mcp-backend")
	return map[string]any{"service": service, "active": true, "state": "running", "subState": "running", "since": "2026-05-20T09:05:21Z", "restartCount": 0}, nil
}

func (a *MockAdapter) JournalTail(ctx context.Context, params map[string]any) (map[string]any, error) {
	unit := stringParam(params, "unit", "darwin-ops-mcp-backend")
	lines := intParam(params, "lines", 50)
	return map[string]any{"unit": unit, "lines": []string{"May 20 09:05:21 darwin-ops-mcp backend starting addr=:8080 mode=mock", "May 20 09:06:01 darwin-ops-mcp request completed status=202 path=/api/v1/tools/*/execute", "May 20 09:06:05 darwin-ops-mcp health check ok"}, "requestedLines": lines}, nil
}

func (a *MockAdapter) Ping(ctx context.Context, params map[string]any) (map[string]any, error) {
	host := stringParam(params, "host", "1.1.1.1")
	count := intParam(params, "count", 4)
	return map[string]any{"host": host, "count": count, "packetLossPercent": 0, "avgRttMs": 12.8, "minRttMs": 10.4, "maxRttMs": 15.7}, nil
}

func (a *MockAdapter) DNSLookup(ctx context.Context, params map[string]any) (map[string]any, error) {
	host := stringParam(params, "host", "example.com")
	return map[string]any{"host": host, "records": []string{"93.184.216.34"}, "server": "system-resolver", "durationMs": 8.4}, nil
}

func stringParam(params map[string]any, key, fallback string) string {
	if v, ok := params[key].(string); ok && v != "" {
		return v
	}
	return fallback
}

func intParam(params map[string]any, key string, fallback int) int {
	switch v := params[key].(type) {
	case int:
		return v
	case float64:
		return int(v)
	default:
		return fallback
	}
}
