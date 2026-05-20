import React from 'react';
import { Card, Drawer, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { AuditEvent } from '../types';
import { JsonBlock, formatTime, shortId } from '../components/utils';

export function AuditPage() {
  const audit = useQuery({ queryKey: ['audit'], queryFn: api.audit, refetchInterval: 5000 });
  const [q, setQ] = React.useState('');
  const [allowed, setAllowed] = React.useState('all');
  const [detail, setDetail] = React.useState<AuditEvent | null>(null);
  const data = (audit.data ?? []).filter((item) => {
    const keyword = q.trim().toLowerCase();
    return (!keyword || `${item.id} ${item.actor} ${item.action} ${item.target} ${item.reason}`.toLowerCase().includes(keyword)) && (allowed === 'all' || String(item.allowed) === allowed);
  });
  const columns = [
    { title: 'ID', dataIndex: 'id', render: (v: string) => <Typography.Text code>{shortId(v)}</Typography.Text> },
    { title: '结果', dataIndex: 'allowed', render: (v: boolean) => v ? <Tag color="green">允许</Tag> : <Tag color="red">拒绝</Tag> },
    { title: '执行人', dataIndex: 'actor' },
    { title: '角色', dataIndex: 'role' },
    { title: '动作', dataIndex: 'action', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    { title: '目标', dataIndex: 'target' },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '时间', dataIndex: 'at', render: formatTime },
  ];
  return <div className="page"><div className="page-title"><div><Typography.Title level={2}>审计中心</Typography.Title><Typography.Text type="secondary">集中查看工具调用审计记录和策略判定依据。</Typography.Text></div></div><Card className="section"><Space wrap className="toolbar"><Input.Search placeholder="搜索审计记录" allowClear onSearch={setQ} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} /><Select value={allowed} onChange={setAllowed} style={{ width: 140 }} options={[{ value: 'all', label: '全部结果' }, { value: 'true', label: '允许' }, { value: 'false', label: '拒绝' }]} /></Space><Table rowKey="id" className="section" loading={audit.isLoading} columns={columns} dataSource={data} onRow={(record) => ({ onClick: () => setDetail(record) })} locale={{ emptyText: <Empty description="暂无审计记录" /> }} pagination={{ pageSize: 10 }} /></Card><Drawer title="审计详情" width={720} open={!!detail} onClose={() => setDetail(null)}>{detail ? <Space direction="vertical" className="full" size="middle"><Card size="small" title="基础信息"><JsonBlock value={detail} /></Card><Card size="small" title="参数"><JsonBlock value={detail.parameters} /></Card></Space> : null}</Drawer></div>;
}
