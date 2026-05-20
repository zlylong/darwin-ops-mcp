import React from 'react';
import { Button, Card, Col, Drawer, Empty, Input, Row, Select, Space, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Risk, Tool } from '../types';
import { ExecuteToolModal } from '../components/ExecuteToolModal';
import { JsonBlock, ReadOnlyTag, RiskTag } from '../components/utils';

export function ToolsPage() {
  const tools = useQuery({ queryKey: ['tools'], queryFn: api.tools });
  const [q, setQ] = React.useState('');
  const [category, setCategory] = React.useState<string>('all');
  const [risk, setRisk] = React.useState<Risk | 'all'>('all');
  const [readOnly, setReadOnly] = React.useState<'all' | 'true' | 'false'>('all');
  const [detail, setDetail] = React.useState<Tool | null>(null);
  const [executeTool, setExecuteTool] = React.useState<Tool | undefined>();
  const categories = Array.from(new Set((tools.data ?? []).map((tool) => tool.category)));
  const data = (tools.data ?? []).filter((tool) => {
    const keyword = q.trim().toLowerCase();
    return (!keyword || `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(keyword)) && (category === 'all' || tool.category === category) && (risk === 'all' || tool.risk === risk) && (readOnly === 'all' || String(tool.readOnly) === readOnly);
  });

  const columns = [
    { title: '工具', dataIndex: 'name', render: (_: string, row: Tool) => <Button type="link" onClick={() => setDetail(row)}>{row.name}</Button> },
    { title: '分类', dataIndex: 'category' },
    { title: '风险', dataIndex: 'risk', render: (v: string) => <RiskTag risk={v} /> },
    { title: '类型', dataIndex: 'readOnly', render: (v: boolean) => <ReadOnlyTag readOnly={v} /> },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '操作', render: (_: unknown, row: Tool) => <Space><Button onClick={() => setDetail(row)}>详情</Button><Button type="primary" onClick={() => setExecuteTool(row)}>执行</Button></Space> },
  ];

  return (
    <div className="page">
      <div className="page-title"><div><Typography.Title level={2}>工具中心</Typography.Title><Typography.Text type="secondary">查看可用 MCP 工具，按策略执行并自动审计。</Typography.Text></div></div>
      <Card className="section">
        <Space wrap className="toolbar">
          <Input.Search placeholder="搜索工具/说明" allowClear onSearch={setQ} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <Select value={category} onChange={setCategory} style={{ width: 160 }} options={[{ value: 'all', label: '全部分类' }, ...categories.map((value) => ({ value, label: value }))]} />
          <Select value={risk} onChange={setRisk} style={{ width: 140 }} options={[{ value: 'all', label: '全部风险' }, { value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }, { value: 'critical', label: '严重' }]} />
          <Select value={readOnly} onChange={setReadOnly} style={{ width: 140 }} options={[{ value: 'all', label: '全部类型' }, { value: 'true', label: '只读' }, { value: 'false', label: '变更' }]} />
        </Space>
        <Table rowKey="name" className="section" loading={tools.isLoading} columns={columns} dataSource={data} locale={{ emptyText: <Empty description="暂无工具" /> }} pagination={{ pageSize: 8 }} />
      </Card>
      <Drawer title={detail?.name} width={620} open={!!detail} onClose={() => setDetail(null)} extra={detail ? <Button type="primary" onClick={() => setExecuteTool(detail)}>执行</Button> : null}>
        {detail ? <Space direction="vertical" className="full" size="middle"><Space wrap><RiskTag risk={detail.risk} /><ReadOnlyTag readOnly={detail.readOnly} /></Space><Typography.Paragraph>{detail.description}</Typography.Paragraph><Row gutter={12}><Col span={12}><Card size="small" title="分类">{detail.category}</Card></Col><Col span={12}><Card size="small" title="是否需要审批">{detail.requiresApproval ? '是' : '否'}</Card></Col></Row><Card size="small" title="输入 Schema"><JsonBlock value={detail.inputSchema} /></Card></Space> : null}
      </Drawer>
      <ExecuteToolModal tool={executeTool} open={!!executeTool} onClose={() => setExecuteTool(undefined)} />
    </div>
  );
}
