import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactECharts from 'echarts-for-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Menu,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApiOutlined,
  AuditOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  CodeOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import 'antd/dist/reset.css';
import './styles.css';

type Risk = 'low' | 'medium' | 'high' | 'critical';
type Role = 'viewer' | 'operator' | 'admin';
type Summary = { mode: string; environment: string; tools: number; executions: number; auditRecords: number; approvals: number };
type Tool = { name: string; description: string; category: string; readOnly: boolean; risk: Risk; requiresApproval: boolean; inputSchema: Record<string, string> };
type AuditEvent = { id: string; executionId?: string; at: string; actor: string; role: Role; action: string; target: string; allowed: boolean; reason: string; parameters?: Record<string, unknown> };
type Execution = { id: string; tool: string; actor: string; role: Role; target: string; status: string; reason: string; parameters?: Record<string, unknown>; result?: Record<string, unknown>; auditId: string; createdAt: string };
type Approval = { id: string; executionId: string; tool: string; actor: string; target: string; status: 'pending' | 'approved' | 'rejected'; reason: string; createdAt: string; decidedAt?: string };
type ExecuteResult = { executionId: string; auditId: string; approvalId?: string; status: string; message: string; data?: Record<string, unknown> };
type ExecuteRequest = { actor: string; role: Role; target: string; approved?: boolean; parameters: Record<string, unknown> };
type FilterState = { q?: string; category?: string; risk?: Risk | 'all'; readOnly?: 'all' | 'true' | 'false'; status?: string; user?: string; tool?: string; environment?: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const MOCK_API = import.meta.env.VITE_MOCK_API === 'true';

const mockTools: Tool[] = [
  { name: 'k8s.list_pods', description: 'List Kubernetes pods in a namespace.', category: 'kubernetes', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { namespace: 'string' } },
  { name: 'k8s.get_pod_logs', description: 'Fetch recent logs for a pod.', category: 'kubernetes', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { namespace: 'string', pod: 'string', container: 'string?', lines: 'number?' } },
  { name: 'k8s.list_events', description: 'List recent Kubernetes events.', category: 'kubernetes', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { namespace: 'string' } },
  { name: 'k8s.get_deployment_status', description: 'Read deployment rollout status.', category: 'kubernetes', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { namespace: 'string', deployment: 'string' } },
  { name: 'prometheus.query', description: 'Run a read-only PromQL query.', category: 'prometheus', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { query: 'string' } },
  { name: 'prometheus.service_error_rate', description: 'Get service error rate.', category: 'prometheus', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { service: 'string' } },
  { name: 'prometheus.service_latency_p95', description: 'Get service p95 latency.', category: 'prometheus', readOnly: true, risk: 'low', requiresApproval: false, inputSchema: { service: 'string' } },
];

const mockExecutions: Execution[] = [];
const mockAudit: AuditEvent[] = [];
const mockApprovals: Approval[] = [];

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(typeof body === 'object' && body && 'error' in body ? String((body as { error?: unknown }).error) : `API error ${status}`);
    this.status = status;
    this.body = body;
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
  if (name === 'k8s.list_pods') return { pods: [{ name: 'api-7dc8b5d9b8-xk2wq', namespace: params.namespace ?? 'default', phase: 'Running', restarts: 0, node: 'mock-node-1' }, { name: 'worker-6bd746fcd9-q9m2n', namespace: params.namespace ?? 'default', phase: 'Running', restarts: 1, node: 'mock-node-2' }] };
  if (name === 'k8s.list_events') return { events: [{ type: 'Normal', reason: 'Pulled', message: 'Container image already present', object: 'pod/api', count: 1 }, { type: 'Warning', reason: 'BackOff', message: 'Back-off restarting failed container', object: 'pod/worker', count: 2 }] };
  if (name === 'k8s.get_deployment_status') return { deployment: params.deployment ?? 'api', namespace: params.namespace ?? 'default', replicas: 3, readyReplicas: 3, updatedReplicas: 3, availableReplicas: 3 };
  if (name === 'k8s.get_pod_logs') return { logs: ['2026-05-19T10:00:00Z starting service', '2026-05-19T10:00:02Z health check passed', '2026-05-19T10:00:05Z request completed status=200'].join('\n') };
  if (name.startsWith('prometheus.')) return { resultType: 'vector', result: [{ metric: { service: params.service ?? 'api' }, value: [Date.now() / 1000, String(Math.random().toFixed(3))] }] };
  return { ok: true };
}

const api = {
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

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function useSummary() { return useQuery({ queryKey: ['summary'], queryFn: api.summary }); }
function useTools() { return useQuery({ queryKey: ['tools'], queryFn: api.tools }); }
function useExecutions() { return useQuery({ queryKey: ['executions'], queryFn: api.executions }); }
function useAudit() { return useQuery({ queryKey: ['audit'], queryFn: api.audit }); }
function useApprovals() { return useQuery({ queryKey: ['approvals'], queryFn: api.approvals }); }

function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff', borderRadius: 10 } }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

function Shell() {
  const location = useLocation();
  const [environment, setEnvironment] = useState('development');
  const [cluster, setCluster] = useState('local-dev');
  const selectedKey = `/${location.pathname.split('/')[1] || 'dashboard'}`;
  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">Dashboard</Link> },
    { key: '/tools', icon: <ToolOutlined />, label: <Link to="/tools">Tool Center</Link> },
    { key: '/executions', icon: <PlayCircleOutlined />, label: <Link to="/executions">Execution Center</Link> },
    { key: '/audit', icon: <AuditOutlined />, label: <Link to="/audit">Audit Center</Link> },
    { key: '/approvals', icon: <CheckCircleOutlined />, label: <Link to="/approvals">Approval Center</Link> },
    { key: '/kubernetes', icon: <ClusterOutlined />, label: <Link to="/kubernetes">Kubernetes Overview</Link> },
    { key: '/prometheus', icon: <BarChartOutlined />, label: <Link to="/prometheus">Prometheus Query</Link> },
    { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">Settings</Link> },
  ];

  return (
    <Layout className="app-shell">
      <Layout.Sider className="sidebar" width={248} breakpoint="lg" collapsedWidth={0}>
        <div className="brand"><ApiOutlined /><span>ops-mcp</span></div>
        <LayoutMenu selectedKey={selectedKey} items={menuItems} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="topbar">
          <Space wrap>
            <Select className="top-select" value={environment} onChange={setEnvironment} options={[{ value: 'development', label: 'development' }, { value: 'staging', label: 'staging' }, { value: 'production', label: 'production' }]} />
            <Select className="top-select" value={cluster} onChange={setCluster} options={[{ value: 'local-dev', label: 'local-dev' }, { value: 'mock-cluster', label: 'mock-cluster' }, { value: 'prod-main', label: 'prod-main' }]} />
          </Space>
          <Space>
            <Badge status="processing" text="mock-friendly" />
            <Tag icon={<UserOutlined />}>local-user</Tag>
          </Space>
        </Layout.Header>
        <Layout.Content className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tools" element={<ToolCenter />} />
            <Route path="/tools/:toolName" element={<ToolDetail />} />
            <Route path="/executions" element={<ExecutionCenter />} />
            <Route path="/executions/:executionId" element={<ExecutionDetailPage />} />
            <Route path="/audit" element={<AuditCenter />} />
            <Route path="/approvals" element={<ApprovalCenter />} />
            <Route path="/kubernetes" element={<KubernetesOverview cluster={cluster} />} />
            <Route path="/prometheus" element={<PrometheusQuery />} />
            <Route path="/settings" element={<Settings environment={environment} cluster={cluster} />} />
            <Route path="*" element={<Result status="404" title="Page not found" extra={<Link to="/dashboard">Back to Dashboard</Link>} />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

function LayoutMenu({ selectedKey, items }: { selectedKey: string; items: { key: string; icon: React.ReactNode; label: React.ReactNode }[] }) {
  return <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={items} />;
}

function Page({ title, subtitle, extra, children }: { title: string; subtitle?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return <Space direction="vertical" size={16} className="page"><div className="page-title"><div><Typography.Title level={2}>{title}</Typography.Title>{subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}</div>{extra}</div>{children}</Space>;
}

function StateBlock({ loading, error, empty, children }: { loading?: boolean; error?: unknown; empty?: boolean; children: React.ReactNode }) {
  if (loading) return <Card><Spin /> <Typography.Text>Loading...</Typography.Text></Card>;
  if (error) return <Alert type="error" showIcon message="Request failed" description={error instanceof Error ? error.message : String(error)} />;
  if (empty) return <Card><Empty /></Card>;
  return <>{children}</>;
}

function riskColor(risk?: string) {
  if (risk === 'critical') return 'red';
  if (risk === 'high') return 'volcano';
  if (risk === 'medium') return 'gold';
  return 'green';
}
function statusColor(status?: string) {
  if (status === 'succeeded' || status === 'approved') return 'green';
  if (status === 'blocked' || status === 'failed' || status === 'rejected' || status === 'validation_failed') return 'red';
  if (status === 'approval_required' || status === 'pending') return 'gold';
  return 'blue';
}
function formatJson(value: unknown) { return JSON.stringify(value ?? {}, null, 2); }
function parseJsonObject(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON input must be an object');
  return parsed as Record<string, unknown>;
}
function defaultInput(tool?: Tool) {
  const out: Record<string, unknown> = {};
  Object.entries(tool?.inputSchema ?? {}).forEach(([key, type]) => {
    const optional = type.endsWith('?');
    if (optional) return;
    out[key] = type.startsWith('number') ? 10 : key === 'query' ? 'up' : key === 'namespace' ? 'default' : key === 'deployment' ? 'api' : key === 'service' ? 'api' : key === 'pod' ? 'api-7dc8b5d9b8-xk2wq' : '';
  });
  return formatJson(out);
}

function Dashboard() {
  const summary = useSummary();
  const executions = useExecutions();
  const approvals = useApprovals();
  const tools = useTools();
  const failed = (executions.data ?? []).filter((item) => item.status !== 'succeeded').length;
  const today = (executions.data ?? []).filter((item) => new Date(item.createdAt).toDateString() === new Date().toDateString()).length;
  const pending = (approvals.data ?? []).filter((item) => item.status === 'pending').length;
  const riskCounts = (tools.data ?? []).reduce<Record<string, number>>((acc, tool) => ({ ...acc, [tool.risk]: (acc[tool.risk] ?? 0) + 1 }), {});
  const chart = { tooltip: { trigger: 'item' }, legend: { bottom: 0 }, series: [{ type: 'pie', radius: ['45%', '70%'], data: Object.entries(riskCounts).map(([name, value]) => ({ name, value })) }] };
  return <Page title="Dashboard" subtitle="Operational command center for audited MCP tool usage.">
    <StateBlock loading={summary.isLoading} error={summary.error}>
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}><Card><Statistic title="Active alerts" value={failed} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: failed ? '#cf1322' : '#3f8600' }} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Pending approvals" value={pending} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Today executions" value={today} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Failed executions" value={failed} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}><Card title="Recent executions"><ExecutionTable data={(executions.data ?? []).slice(0, 8)} loading={executions.isLoading} compact /></Card></Col>
        <Col xs={24} lg={9}><Card title="Risk distribution chart"><ReactECharts option={chart} style={{ height: 320 }} /><Typography.Text type="secondary">Mode: {summary.data?.mode ?? '-'} · Environment: {summary.data?.environment ?? '-'}</Typography.Text></Card></Col>
      </Row>
    </StateBlock>
  </Page>;
}

function ToolCenter() {
  const tools = useTools();
  const [filters, setFilters] = useState<FilterState>({ risk: 'all', readOnly: 'all' });
  const [selected, setSelected] = useState<Tool | null>(null);
  const categories = Array.from(new Set((tools.data ?? []).map((item) => item.category)));
  const data = (tools.data ?? []).filter((tool) => {
    const q = filters.q?.toLowerCase().trim();
    return (!q || `${tool.name} ${tool.description}`.toLowerCase().includes(q)) && (!filters.category || tool.category === filters.category) && (!filters.risk || filters.risk === 'all' || tool.risk === filters.risk) && (!filters.readOnly || filters.readOnly === 'all' || String(tool.readOnly) === filters.readOnly);
  });
  return <Page title="Tool Center" subtitle="Search, filter, inspect schemas, and execute audited tools.">
    <Card>
      <Space wrap>
        <Input.Search placeholder="Search tools" allowClear onSearch={(q) => setFilters((prev) => ({ ...prev, q }))} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} />
        <Select allowClear placeholder="Category" className="filter" value={filters.category} onChange={(category) => setFilters((prev) => ({ ...prev, category }))} options={categories.map((value) => ({ value, label: value }))} />
        <Select className="filter" value={filters.risk} onChange={(risk) => setFilters((prev) => ({ ...prev, risk }))} options={['all', 'low', 'medium', 'high', 'critical'].map((value) => ({ value, label: value }))} />
        <Select className="filter" value={filters.readOnly} onChange={(readOnly) => setFilters((prev) => ({ ...prev, readOnly }))} options={[{ value: 'all', label: 'all tools' }, { value: 'true', label: 'read-only only' }, { value: 'false', label: 'write tools' }]} />
      </Space>
    </Card>
    <StateBlock loading={tools.isLoading} error={tools.error} empty={!data.length}>
      <Row gutter={[16, 16]}>{data.map((tool) => <Col xs={24} xl={12} key={tool.name}><ToolCard tool={tool} onExecute={() => setSelected(tool)} /></Col>)}</Row>
    </StateBlock>
    <ToolExecuteModal tool={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
  </Page>;
}

function ToolCard({ tool, onExecute }: { tool: Tool; onExecute: () => void }) {
  return <Card title={<Space><Link to={`/tools/${encodeURIComponent(tool.name)}`}>{tool.name}</Link><Tag>{tool.category}</Tag></Space>} extra={<Button type="primary" icon={<PlayCircleOutlined />} onClick={onExecute}>Execute</Button>}>
    <Space direction="vertical" className="full">
      <Typography.Text>{tool.description}</Typography.Text>
      <Space wrap><Tag color={tool.readOnly ? 'green' : 'orange'}>{tool.readOnly ? 'read-only' : 'write'}</Tag><Tag color={riskColor(tool.risk)}>{tool.risk}</Tag>{tool.requiresApproval && <Tag color="red">approval required</Tag>}</Space>
      <Descriptions size="small" column={1} bordered items={Object.entries(tool.inputSchema).map(([label, children]) => ({ key: label, label, children }))} />
      <JsonBlock value={tool.inputSchema} height={120} />
    </Space>
  </Card>;
}

function ToolDetail() {
  const { toolName = '' } = useParams();
  const name = decodeURIComponent(toolName);
  const tool = useQuery({ queryKey: ['tool', name], queryFn: () => api.tool(name), enabled: Boolean(name) });
  const [executeOpen, setExecuteOpen] = useState(false);
  return <Page title="Tool Detail" subtitle={name} extra={<Button type="primary" onClick={() => setExecuteOpen(true)}>Execute tool</Button>}>
    <StateBlock loading={tool.isLoading} error={tool.error} empty={!tool.data}>
      {tool.data && <Card><Descriptions bordered column={1} items={[
        { key: 'name', label: 'Name', children: tool.data.name },
        { key: 'category', label: 'Category', children: <Tag>{tool.data.category}</Tag> },
        { key: 'risk', label: 'Risk', children: <Tag color={riskColor(tool.data.risk)}>{tool.data.risk}</Tag> },
        { key: 'readOnly', label: 'Read-only', children: String(tool.data.readOnly) },
        { key: 'approval', label: 'Approval required', children: tool.data.requiresApproval ? <Tag color="red">required</Tag> : <Tag color="green">not required</Tag> },
        { key: 'description', label: 'Description', children: tool.data.description },
        { key: 'schema', label: 'Input schema', children: <JsonBlock value={tool.data.inputSchema} height={220} /> },
      ]} /></Card>}
    </StateBlock>
    <ToolExecuteModal tool={tool.data ?? null} open={executeOpen} onClose={() => setExecuteOpen(false)} />
  </Page>;
}

function ToolExecuteModal({ tool, open, onClose, defaults }: { tool: Tool | null; open: boolean; onClose: () => void; defaults?: Record<string, unknown> }) {
  const client = useQueryClient();
  const [actor, setActor] = useState('local-user');
  const [role, setRole] = useState<Role>('viewer');
  const [target, setTarget] = useState('local-dev');
  const [approved, setApproved] = useState(false);
  const [json, setJson] = useState('{}');
  const [result, setResult] = useState<ExecuteResult | null>(null);
  React.useEffect(() => { if (tool && open) { setJson(formatJson(defaults ?? parseSafe(defaultInput(tool)))); setResult(null); } }, [tool, open]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!tool) throw new Error('No tool selected');
      const parameters = parseJsonObject(json);
      return api.execute(tool.name, { actor, role, target, approved, parameters });
    },
    onSuccess: async (res) => { setResult(res); message.success(res.message); await Promise.all([client.invalidateQueries({ queryKey: ['summary'] }), client.invalidateQueries({ queryKey: ['executions'] }), client.invalidateQueries({ queryKey: ['audit'] }), client.invalidateQueries({ queryKey: ['approvals'] })]); },
    onError: (error) => message.error(error instanceof Error ? error.message : String(error)),
  });
  return <Modal title={<Space>Execute tool {tool?.requiresApproval && <Tag color="red">approval required</Tag>}</Space>} open={open} onCancel={onClose} width={920} footer={[<Button key="close" onClick={onClose}>Close</Button>, <Button key="run" type="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>Execute through policy + audit</Button>]}>
    {!tool ? <Empty /> : <Space direction="vertical" className="full" size={12}>
      <Alert showIcon type={tool.requiresApproval || tool.risk !== 'low' ? 'warning' : 'info'} message={`${tool.name} · ${tool.risk} · ${tool.readOnly ? 'read-only' : 'write'}`} description="Execution is sent to backend API, checked by policy, and recorded in audit/execution history." />
      <Row gutter={12}><Col xs={24} md={6}><Input addonBefore="Actor" value={actor} onChange={(e) => setActor(e.target.value)} /></Col><Col xs={24} md={6}><Select className="full" value={role} onChange={setRole} options={['viewer', 'operator', 'admin'].map((value) => ({ value, label: value }))} /></Col><Col xs={24} md={6}><Input addonBefore="Target" value={target} onChange={(e) => setTarget(e.target.value)} /></Col><Col xs={24} md={6}><Select className="full" value={approved} onChange={setApproved} options={[{ value: false, label: 'not approved' }, { value: true, label: 'approved' }]} /></Col></Row>
      <Typography.Text strong>Input JSON</Typography.Text>
      <Editor height="260px" defaultLanguage="json" language="json" value={json} onChange={(value) => setJson(value ?? '{}')} options={{ minimap: { enabled: false }, formatOnPaste: true, tabSize: 2 }} />
      {result && <Alert type={result.status === 'succeeded' ? 'success' : 'warning'} message={`${result.status}: ${result.message}`} description={<JsonBlock value={result} height={180} />} />}
    </Space>}
  </Modal>;
}

function parseSafe(text: string): Record<string, unknown> { try { return parseJsonObject(text); } catch { return {}; } }

function ExecutionCenter() {
  const executions = useExecutions();
  const [filters, setFilters] = useState<FilterState>({});
  const [selected, setSelected] = useState<Execution | null>(null);
  const data = (executions.data ?? []).filter((item) => (!filters.status || item.status === filters.status) && (!filters.tool || item.tool.includes(filters.tool)) && (!filters.user || item.actor.includes(filters.user)));
  return <Page title="Execution Center" subtitle="Filter executions, inspect inputs/outputs, policy reason, and audit ID.">
    <Card><Space wrap><Input placeholder="Tool contains" onChange={(e) => setFilters((p) => ({ ...p, tool: e.target.value }))} /><Input placeholder="User contains" onChange={(e) => setFilters((p) => ({ ...p, user: e.target.value }))} /><Select allowClear placeholder="Status" className="filter" onChange={(status) => setFilters((p) => ({ ...p, status }))} options={['succeeded', 'failed', 'blocked', 'validation_failed', 'approval_required'].map((value) => ({ value, label: value }))} /></Space></Card>
    <StateBlock loading={executions.isLoading} error={executions.error} empty={!data.length}><ExecutionTable data={data} onSelect={setSelected} /></StateBlock>
    <ExecutionDrawer execution={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
  </Page>;
}

function ExecutionTable({ data, loading, onSelect, compact }: { data: Execution[]; loading?: boolean; onSelect?: (execution: Execution) => void; compact?: boolean }) {
  const navigate = useNavigate();
  const columns: ColumnsType<Execution> = [
    { title: 'Status', dataIndex: 'status', render: (status) => <Tag color={statusColor(String(status))}>{String(status)}</Tag> },
    { title: 'Tool', dataIndex: 'tool', render: (tool) => <Typography.Text code>{String(tool)}</Typography.Text> },
    { title: 'Actor', dataIndex: 'actor', responsive: ['md'] },
    { title: 'Target', dataIndex: 'target', responsive: ['lg'] },
    { title: 'Policy decision', dataIndex: 'reason', ellipsis: true },
    { title: 'Audit ID', dataIndex: 'auditId', responsive: ['xl'], render: (id) => <Typography.Text copyable>{String(id)}</Typography.Text> },
    { title: 'Created', dataIndex: 'createdAt', responsive: ['lg'], render: (value) => value ? new Date(String(value)).toLocaleString() : '-' },
    { title: 'Action', render: (_, record) => <Space><Button size="small" onClick={() => onSelect?.(record)}>Drawer</Button>{!compact && <Button size="small" onClick={() => navigate(`/executions/${encodeURIComponent(record.id)}`)}>Page</Button>}</Space> },
  ];
  return <Table rowKey="id" loading={loading} columns={compact ? columns.slice(0, 5) : columns} dataSource={data} pagination={compact ? false : { pageSize: 10 }} />;
}

function ExecutionDrawer({ execution, open, onClose }: { execution: Execution | null; open: boolean; onClose: () => void }) {
  return <Drawer width={760} title="Execution Detail" open={open} onClose={onClose}>{execution ? <Tabs items={[
    { key: 'summary', label: 'Summary', children: <Descriptions bordered column={1} items={Object.entries({ id: execution.id, tool: execution.tool, status: execution.status, actor: execution.actor, role: execution.role, target: execution.target, policyDecision: execution.reason, auditId: execution.auditId }).map(([key, value]) => ({ key, label: key, children: String(value ?? '-') }))} /> },
    { key: 'input', label: 'Input JSON', children: <JsonBlock value={execution.parameters} height={320} /> },
    { key: 'output', label: 'Output JSON', children: <JsonBlock value={execution.result} height={320} /> },
  ]} /> : <Empty />}</Drawer>;
}

function ExecutionDetailPage() {
  const { executionId = '' } = useParams();
  const id = decodeURIComponent(executionId);
  const execution = useQuery({ queryKey: ['execution', id], queryFn: () => api.execution(id), enabled: Boolean(id) });
  return <Page title="Execution Detail" subtitle={id}><StateBlock loading={execution.isLoading} error={execution.error} empty={!execution.data}>{execution.data && <Tabs items={[
    { key: 'summary', label: 'Summary', children: <Card><Descriptions bordered column={1} items={Object.entries({ id: execution.data.id, tool: execution.data.tool, status: execution.data.status, actor: execution.data.actor, role: execution.data.role, target: execution.data.target, policyDecision: execution.data.reason, auditId: execution.data.auditId }).map(([key, value]) => ({ key, label: key, children: String(value ?? '-') }))} /></Card> },
    { key: 'input', label: 'Input JSON', children: <Card><JsonBlock value={execution.data.parameters} height={380} /></Card> },
    { key: 'output', label: 'Output JSON', children: <Card><JsonBlock value={execution.data.result} height={380} /></Card> },
  ]} />}</StateBlock></Page>;
}

function AuditCenter() {
  const audit = useAudit();
  const [filters, setFilters] = useState<FilterState>({});
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const data = (audit.data ?? []).filter((item) => (!filters.user || item.actor.includes(filters.user)) && (!filters.tool || item.action.includes(filters.tool)) && (!filters.status || String(item.allowed) === filters.status) && (!filters.risk || filters.risk === 'all' || item.reason.includes(filters.risk)) && (!filters.environment || item.target.includes(filters.environment)));
  const columns: ColumnsType<AuditEvent> = [
    { title: 'Status', dataIndex: 'allowed', render: (allowed) => <Tag color={allowed ? 'green' : 'red'}>{allowed ? 'allowed' : 'blocked'}</Tag> },
    { title: 'User', dataIndex: 'actor' },
    { title: 'Tool', dataIndex: 'action', render: (value) => <Typography.Text code>{String(value)}</Typography.Text> },
    { title: 'Environment/Target', dataIndex: 'target' },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
    { title: 'At', dataIndex: 'at', render: (value) => value ? new Date(String(value)).toLocaleString() : '-' },
    { title: 'Action', render: (_, record) => <Button size="small" onClick={() => setSelected(record)}>Detail</Button> },
  ];
  return <Page title="Audit Center" subtitle="Audit table with user/tool/environment/risk/status filters.">
    <Card><Space wrap><Input placeholder="User" onChange={(e) => setFilters((p) => ({ ...p, user: e.target.value }))} /><Input placeholder="Tool" onChange={(e) => setFilters((p) => ({ ...p, tool: e.target.value }))} /><Input placeholder="Environment/target" onChange={(e) => setFilters((p) => ({ ...p, environment: e.target.value }))} /><Select allowClear placeholder="Status" className="filter" onChange={(status) => setFilters((p) => ({ ...p, status }))} options={[{ value: 'true', label: 'allowed' }, { value: 'false', label: 'blocked' }]} /><Select placeholder="Risk" className="filter" value={filters.risk ?? 'all'} onChange={(risk) => setFilters((p) => ({ ...p, risk }))} options={['all', 'low', 'medium', 'high', 'critical'].map((value) => ({ value, label: value }))} /></Space></Card>
    <StateBlock loading={audit.isLoading} error={audit.error} empty={!data.length}><Table rowKey="id" columns={columns} dataSource={data} /></StateBlock>
    <Drawer width={680} title="Audit Detail" open={Boolean(selected)} onClose={() => setSelected(null)}>{selected ? <Tabs items={[{ key: 'summary', label: 'Summary', children: <Descriptions bordered column={1} items={Object.entries(selected).filter(([key]) => key !== 'parameters').map(([key, value]) => ({ key, label: key, children: typeof value === 'object' ? formatJson(value) : String(value ?? '-') }))} /> }, { key: 'parameters', label: 'Parameters', children: <JsonBlock value={selected.parameters} height={320} /> }]} /> : <Empty />}</Drawer>
  </Page>;
}

function ApprovalCenter() {
  const approvals = useApprovals();
  const client = useQueryClient();
  const approve = useMutation({ mutationFn: api.approve, onSuccess: async () => { message.success('Approved'); await client.invalidateQueries({ queryKey: ['approvals'] }); } });
  const reject = useMutation({ mutationFn: api.reject, onSuccess: async () => { message.success('Rejected'); await client.invalidateQueries({ queryKey: ['approvals'] }); } });
  const pending = (approvals.data ?? []).filter((item) => item.status === 'pending');
  return <Page title="Approval Center" subtitle="Review pending approvals and risk summaries.">
    <Row gutter={[16, 16]}><Col xs={24} md={8}><Card><Statistic title="Pending approvals" value={pending.length} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Total approvals" value={(approvals.data ?? []).length} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="High risk queue" value={pending.filter((item) => item.reason.toLowerCase().includes('production')).length} /></Card></Col></Row>
    <StateBlock loading={approvals.isLoading} error={approvals.error} empty={!pending.length}>
      <List dataSource={pending} renderItem={(item) => <List.Item actions={[<Button key="approve" type="primary" loading={approve.isPending} onClick={() => approve.mutate(item.id)}>Approve</Button>, <Button key="reject" danger loading={reject.isPending} onClick={() => reject.mutate(item.id)}>Reject</Button>]}><List.Item.Meta title={<Space><Typography.Text code>{item.tool}</Typography.Text><Tag color="gold">pending</Tag></Space>} description={<Space direction="vertical"><span>{item.reason}</span><span>{item.actor} · {item.target} · {new Date(item.createdAt).toLocaleString()}</span></Space>} /></List.Item>} />
    </StateBlock>
  </Page>;
}

function KubernetesOverview({ cluster }: { cluster: string }) {
  const [namespace, setNamespace] = useState('default');
  const client = useQueryClient();
  const pods = useQuery({ queryKey: ['k8s', 'pods', namespace], queryFn: () => api.execute('k8s.list_pods', { actor: 'local-user', role: 'viewer', target: cluster, parameters: { namespace } }).then((r) => r.data), enabled: false });
  const events = useQuery({ queryKey: ['k8s', 'events', namespace], queryFn: () => api.execute('k8s.list_events', { actor: 'local-user', role: 'viewer', target: cluster, parameters: { namespace } }).then((r) => r.data), enabled: false });
  const deploy = useMutation({ mutationFn: (deployment: string) => api.execute('k8s.get_deployment_status', { actor: 'local-user', role: 'viewer', target: cluster, parameters: { namespace, deployment } }), onSuccess: async () => client.invalidateQueries({ queryKey: ['executions'] }) });
  const logs = useMutation({ mutationFn: (pod: string) => api.execute('k8s.get_pod_logs', { actor: 'local-user', role: 'viewer', target: cluster, parameters: { namespace, pod, lines: 100 } }) });
  React.useEffect(() => { pods.refetch(); events.refetch(); }, [namespace]);
  const podRows = Array.isArray(pods.data?.pods) ? pods.data.pods as Record<string, unknown>[] : [];
  const eventRows = Array.isArray(events.data?.events) ? events.data.events as Record<string, unknown>[] : [];
  return <Page title="Kubernetes Overview" subtitle="Namespace-scoped read-only Kubernetes overview.">
    <Card><Space><Typography.Text>Namespace</Typography.Text><Select value={namespace} onChange={setNamespace} options={['default', 'kube-system', 'ops'].map((value) => ({ value, label: value }))} /><Button onClick={() => { pods.refetch(); events.refetch(); }}>Refresh</Button></Space></Card>
    <Row gutter={[16, 16]}><Col xs={24} xl={14}><Card title="Pods table"><StateBlock loading={pods.isFetching} error={pods.error} empty={!podRows.length}><Table rowKey={(row) => String(row.name)} dataSource={podRows} columns={['name', 'namespace', 'phase', 'restarts', 'node'].map((key) => ({ title: key, dataIndex: key }))} pagination={false} /></StateBlock></Card></Col><Col xs={24} xl={10}><Card title="Deployment status cards"><Space direction="vertical" className="full"><Input.Search placeholder="Deployment name" enterButton="Check" defaultValue="api" onSearch={(value) => deploy.mutate(value || 'api')} />{deploy.data?.data ? <Card type="inner"><Descriptions column={1} items={Object.entries(deploy.data.data).map(([key, value]) => ({ key, label: key, children: String(value) }))} /></Card> : <Empty description="Run a deployment status check" />}</Space></Card></Col></Row>
    <Row gutter={[16, 16]}><Col xs={24} xl={14}><Card title="Events table"><StateBlock loading={events.isFetching} error={events.error} empty={!eventRows.length}><Table rowKey={(row, index) => `${row.reason}-${index}`} dataSource={eventRows} columns={['type', 'reason', 'message', 'object', 'count'].map((key) => ({ title: key, dataIndex: key }))} pagination={false} /></StateBlock></Card></Col><Col xs={24} xl={10}><Card title="Logs viewer"><Space direction="vertical" className="full"><Input.Search placeholder="Pod name" enterButton="Load logs" onSearch={(value) => logs.mutate(value || 'api-7dc8b5d9b8-xk2wq')} />{logs.isPending ? <Spin /> : <pre className="logs">{String(logs.data?.data?.logs ?? 'Select a pod to load logs')}</pre>}</Space></Card></Col></Row>
  </Page>;
}

function PrometheusQuery() {
  const [query, setQuery] = useState('up');
  const prom = useMutation({ mutationFn: () => api.execute('prometheus.query', { actor: 'local-user', role: 'viewer', target: 'prometheus', parameters: { query } }) });
  const points = extractPromPoints(prom.data?.data);
  const option = { tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: points.map((_, i) => String(i + 1)) }, yAxis: { type: 'value' }, series: [{ type: 'line', smooth: true, data: points }] };
  const quick = ['up', 'rate(http_requests_total[5m])', 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))', 'sum by(pod) (rate(container_cpu_usage_seconds_total[5m]))'];
  return <Page title="Prometheus Query" subtitle="Run mock-friendly read-only PromQL and inspect chart/raw JSON.">
    <Row gutter={[16, 16]}><Col xs={24} lg={8}><Card title="Quick query cards"><Space direction="vertical" className="full">{quick.map((item) => <Button key={item} block onClick={() => setQuery(item)}>{item}</Button>)}</Space></Card></Col><Col xs={24} lg={16}><Card title="PromQL editor"><Editor height="160px" language="plaintext" value={query} onChange={(value) => setQuery(value ?? '')} options={{ minimap: { enabled: false }, lineNumbers: 'off' }} /><Button type="primary" className="run-button" loading={prom.isPending} onClick={() => prom.mutate()}>Run query</Button></Card></Col></Row>
    <Row gutter={[16, 16]}><Col xs={24} lg={14}><Card title="Chart result"><ReactECharts option={option} style={{ height: 320 }} /></Card></Col><Col xs={24} lg={10}><Card title="Raw JSON viewer"><JsonBlock value={prom.data ?? prom.error ?? { message: 'Run a query to see results' }} height={320} /></Card></Col></Row>
  </Page>;
}

function extractPromPoints(data?: Record<string, unknown>) {
  const result = data?.result;
  if (Array.isArray(result)) return result.map((item) => Number((item as { value?: unknown[] }).value?.[1] ?? 0));
  return [];
}

function Settings({ environment, cluster }: { environment: string; cluster: string }) {
  return <Page title="Settings" subtitle="Frontend runtime configuration and API mode.">
    <Row gutter={[16, 16]}><Col xs={24} lg={12}><Card title="Runtime"><Descriptions bordered column={1} items={[{ key: 'api', label: 'API base', children: API_BASE || '(same origin / Vite proxy)' }, { key: 'mock', label: 'Mock API', children: String(MOCK_API) }, { key: 'env', label: 'Selected environment', children: environment }, { key: 'cluster', label: 'Selected cluster', children: cluster }]} /></Card></Col><Col xs={24} lg={12}><Card title="Safety"><Alert type="success" showIcon message="No browser-side shell access" description="The frontend only calls whitelisted backend REST APIs. Tool calls are policy checked and audited by the server." /></Card></Col></Row>
  </Page>;
}

function JsonBlock({ value, height = 220 }: { value: unknown; height?: number }) {
  return <Editor height={`${height}px`} language="json" value={formatJson(value)} options={{ readOnly: true, minimap: { enabled: false }, lineNumbers: 'off', folding: true, scrollBeyondLastLine: false }} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
