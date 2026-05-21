import React from 'react';
import { Button, Card, Empty, message, Select, Space, Table, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Application } from '../types';
import { StatusTag, formatTime, shortId } from '../components/utils';

export function ToolApplicationsPage() {
  const applications = useQuery({ queryKey: ['applications'], queryFn: api.applications, refetchInterval: 5000 });
  const [status, setStatus] = React.useState('pending');
  const queryClient = useQueryClient();
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      action === 'approve' ? api.approveApplication(id) : api.rejectApplication(id),
    onSuccess: () => {
      message.success('审批状态已更新');
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (err) => message.error(err instanceof Error ? err.message : '审批失败'),
  });
  const data = (applications.data ?? []).filter((item) => status === 'all' || item.status === status);
  const columns = [
    { title: 'ID', dataIndex: 'id', render: (v: string) => <Typography.Text code>{shortId(v)}</Typography.Text> },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    { title: '工具', dataIndex: 'tool', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    { title: '申请角色', dataIndex: 'role' },
    { title: '申请人', dataIndex: 'actor' },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '有效期', dataIndex: 'durationHrs', render: (v: number) => v ? v + '小时' : '24小时(缺省)' },
    { title: '创建时间', dataIndex: 'createdAt', render: formatTime },
    {
      title: '操作',
      render: (_: unknown, row: Application) =>
        row.status === 'pending' ? (
          <Space>
            <Button type="primary" size="small" onClick={() => decide.mutate({ id: row.id, action: 'approve' })}>批准</Button>
            <Button danger size="small" onClick={() => decide.mutate({ id: row.id, action: 'reject' })}>拒绝</Button>
          </Space>
        ) : '-',
    },
  ];
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <Typography.Title level={2}>工具审批中心</Typography.Title>
          <Typography.Text type="secondary">管理工具申请请求，批准或拒绝工具使用权限。</Typography.Text>
        </div>
      </div>
      <Card className="section">
        <Space wrap className="toolbar">
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 160 }}
            options={[
              { value: 'pending', label: '待审批' },
              { value: 'all', label: '全部' },
              { value: 'approved', label: '已批准' },
              { value: 'rejected', label: '已拒绝' },
            ]}
          />
        </Space>
        <Table
          rowKey="id"
          className="section"
          loading={applications.isLoading || decide.isPending}
          columns={columns}
          dataSource={data}
          locale={{ emptyText: <Empty description="暂无申请记录" /> }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};
