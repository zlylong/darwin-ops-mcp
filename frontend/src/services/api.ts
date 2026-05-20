import type { AuditEvent, Approval, Execution, ExecuteResult, ExecuteRequest, Tool, Summary } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const MOCK_API = import.meta.env.VITE_MOCK_API === 'true';

class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === 'object' && body && 'error' in body ? String((body as { error?: unknown }).error) : `API error ${status}`);
  }
}

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  if (MOCK_API) return mockRequest<T>(path, init);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

async function mockRequest<T>(path: string, init?: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 180));
  const mockExecutions: Execution[] = [];
  const mockAudit: AuditEvent[] = [];
  const mockApprovals: Approval[] = [];
  const mockTools: Tool[] = [
    { name: 'k8s.list_pods', description: 'List Kubernetes pods in a namespace.', category: 'kubernetes', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { namespace: 'string' } },
    { name: 'prometheus.query', description: 'Run a read-only PromQL query.', category: 'prometheus', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { query: 'string' } },
  ];
  
  if (path === '/api/v1/dashboard/summary') return { mode: 'mock', environment: 'development', tools: mockTools.length, executions: mockExecutions.length, auditRecords: mockAudit.length, approvals: mockApprovals.length } as T;
  if (path === '/api/v1/tools') return mockTools as T;
  if (path.startsWith('/api/v1/tools/') && path.endsWith('/execute')) {
    const name = decodeURIComponent(path.replace('/api/v1/tools/', '').replace('/execute', ''));
    const req = JSON.parse(String(init?.body ?? '{}')) as ExecuteRequest;
    const tool = mockTools.find((item) => item.name === name);
    if (!tool) throw new ApiError(404, { error: 'tool not found' });
    const now = new Date().toISOString();
    const execution: Execution = { id: `mock-exe-${Date.now()}`, tool: name, actor: req.actor, role: req.role, target: req.target, status: 'succeeded', reason: 'mock executed', parameters: req.parameters, result: mockToolData(name, req.parameters), auditId: `mock-aud-${Date.now()}`, createdAt: now };
    mockExecutions.unshift(execution);
    mockAudit.unshift({ id: execution.auditId, executionId: execution.id, at: now, actor: req.actor, role: req.role, action: name, target: req.target, allowed: true, reason: 'mock executed', parameters: req.parameters });
    return { executionId: execution.id, auditId: execution.auditId, status: 'succeeded', message: 'mock tool executed', data: execution.result } as T;
  }
  if (path.startsWith('/api/v1/tools/')) {
    const name = decodeURIComponent(path.replace('/api/v1/tools/', ''));
    const tool = mockTools.find((item) => item.name === name);
    if (!tool) throw new ApiError(404, { error: 'tool not found' });
    return tool as T;
  }
  if (path === '/api/v1/executions') return mockExecutions as T;
  if (path.startsWith('/api/v1/executions/')) {
    const id = decodeURIComponent(path.replace('/api/v1/executions/', ''));
    const execution = mockExecutions.find((item) => item.id === id);
    if (!execution) throw new ApiError(404, { error: 'execution not found' });
    return execution as T;
  }
  if (path === '/api/v1/audit') return mockAudit as T;
  if (path === '/api/v1/approvals') return mockApprovals as T;
  if (path.includes('/approve') || path.includes('/reject')) return {} as T;
  if (path === '/healthz') return { status: 'ok', mode: 'mock', environment: 'development' } as T;
  throw new ApiError(404, { error: 'mock route not found' });
}

function mockToolData(name: string, params: Record<string, unknown>): Record<string, unknown> {
  if (name === 'k8s.list_pods') return { pods: [{ name: 'api-7dc8b5d9b8-xk2wq', namespace: params.namespace ?? 'default', phase: 'Running', restarts: 0, node: 'mock-node-1' }] };
  if (name.startsWith('prometheus.')) return { resultType: 'vector', result: [{ metric: { service: params.service ?? 'api' }, value: [Date.now() / 1000, String(Math.random().toFixed(3))] }] };
  return { ok: true };
}

export const api = {
  summary: () => requestJSON<Summary>('/api/v1/dashboard/summary'),
  tools: () => requestJSON<Tool[]>('/api/v1/tools'),
  tool: (name: string) => requestJSON<Tool>(`/api/v1/tools/${encodeURIComponent(name)}`),
  execute: (name: string, req: ExecuteRequest) => requestJSON<ExecuteResult>(`/api/v1/tools/${encodeURIComponent(name)}/execute`, { method: 'POST', body: JSON.stringify(req) }),
  executions: () => requestJSON<Execution[]>('/api/v1/executions'),
  execution: (id: string) => requestJSON<Execution>(`/api/v1/executions/${encodeURIComponent(id)}`),
  audit: () => requestJSON<AuditEvent[]>('/api/v1/audit'),
  approvals: () => requestJSON<Approval[]>('/api/v1/approvals'),
  approve: (id: string) => requestJSON<Approval>(`/api/v1/approvals/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  reject: (id: string) => requestJSON<Approval>(`/api/v1/approvals/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
};
