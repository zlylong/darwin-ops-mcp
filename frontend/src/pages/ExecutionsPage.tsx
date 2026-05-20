import React from 'react';
import { Card, Drawer, Empty, Input, Select, Space, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Execution } from '../types';
import { JsonBlock, StatusTag, formatTime, shortId } from '../components/utils';

export function ExecutionsPage() {
  const executions = useQuery({ queryKey: ['executions'], queryFn: api.executions, refetchInterval: 5000 });
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [detail, setDetail] = React.useState<Execution | null>(null);
  const data = (executions.data ?? []).filter((item) => {
    const keyword = q.trim().toLowerCase();
    return (!keyword || `${item.id} ${item.tool} ${item.actor} ${item.target} ${item.reason}`.toLowerCase().includes(keyword)) && (status === 'all' || item.status === status);
  });
  const statuses = Array.from(new Set((executions.data ?? []).map((item) => item.status)));
  const columns = [
    { title: 'ID', dataIndex: 'id', render: (v: string) => <Typography.Text code>{shortId(v)}</Typography.Text> },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    { title: '工具', dataIndex: 'tool', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    { title: '执行人', dataIndex: 'actor' },
    { title: '目标', dataIndex: 'target' },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', render: formatTime },
  ];
  return <div className="page"><div className="page-title"><div><Typography.Title level={2}>执行中心</Typography.Title><Typography.Text type="secondary">查看工具执行记录、输入参数与返回结果。</Typography.Text></div></div><Card className="section"><Space wrap className="toolbar"><Input.Search placeholder="搜索执行记录" allowClear onSearch={setQ} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} /><Select value={status} onChange={setStatus} style={{ width: 160 }} options={[{ value: 'all', label: '全部状态' }, ...statuses.map((value) => ({ value, label: value }))]} /></Space><Table rowKey="id" className="section" loading={executions.isLoading} columns={columns} dataSource={data} onRow={(record) => ({ onClick: () => setDetail(record) })} locale={{ emptyText: <Empty description="暂无执行记录" /> }} pagination={{ pageSize: 10 }} /></Card><Drawer title="执行详情" width={720} open={!!detail} onClose={() => setDetail(null)}>{detail ? <Space direction="vertical" className="full" size="middle"><StatusTag status={detail.status} /><Typography.Text code>{detail.id}</Typography.Text><Card size="small" title="基础信息"><JsonBlock value={{ tool: detail.tool, actor: detail.actor, role: detail.role, target: detail.target, reason: detail.reason, auditId: detail.auditId, createdAt: detail.createdAt }} /></Card><Card size="small" title="输入参数"><JsonBlock value={detail.parameters} /></Card><Card size="small" title="执行结果"><JsonBlock value={detail.result} /></Card></Space> : null}</Drawer></div>;
}
