import { Tag } from 'antd';

export function RiskTag({ risk }: { risk?: string }) {
  if (risk === 'critical') return <Tag color="red">严重</Tag>;
  if (risk === 'high') return <Tag color="volcano">高</Tag>;
  if (risk === 'medium') return <Tag color="gold">中</Tag>;
  return <Tag color="green">低</Tag>;
}

export function StatusTag({ status }: { status?: string }) {
  if (status === 'succeeded' || status === 'approved' || status === 'completed') return <Tag color="green">成功</Tag>;
  if (status === 'blocked' || status === 'failed' || status === 'rejected' || status === 'validation_failed' || status === 'denied' || status === 'error') return <Tag color="red">失败</Tag>;
  if (status === 'approval_required' || status === 'pending' || status === 'pending_approval') return <Tag color="gold">待处理</Tag>;
  return <Tag color="blue">{status || '-'}</Tag>;
}

export function ReadOnlyTag({ readOnly }: { readOnly?: boolean }) {
  return readOnly ? <Tag color="blue">只读</Tag> : <Tag color="purple">变更</Tag>;
}

export function JsonBlock({ value, height = 220 }: { value: unknown; height?: number }) {
  const format = (v: unknown) => JSON.stringify(v ?? {}, null, 2);
  return (
    <div className="json-block" style={{ maxHeight: `${height}px` }}>
      <pre>{format(value)}</pre>
    </div>
  );
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON input must be an object');
  return parsed as Record<string, unknown>;
}

export function defaultInput(tool?: { inputSchema?: Record<string, string> }) {
  const out: Record<string, unknown> = {};
  Object.entries(tool?.inputSchema ?? {}).forEach(([key, type]) => {
    const optional = type.endsWith('?');
    if (optional) return;
    out[key] = type.startsWith('number') ? 10 : key === 'query' ? 'up' : key === 'namespace' ? 'default' : key === 'deployment' ? 'api' : key === 'service' ? 'api' : key === 'pod' ? 'api-7dc8b5d9b8-xk2wq' : '';
  });
  return JSON.stringify(out, null, 2);
}

export function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function shortId(value?: string) {
  if (!value) return '-';
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
