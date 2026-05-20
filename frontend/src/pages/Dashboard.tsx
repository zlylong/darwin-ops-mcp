import { Row, Col, Card, Statistic, Typography, Table, Space, Button } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined, FileSearchOutlined, ToolOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { StatusTag, formatTime } from '../components/utils';
import type { Execution } from '../types';

export function Dashboard() {
  const navigate = useNavigate();
  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const executions = useQuery({ queryKey: ['executions'], queryFn: api.executions });
  const approvals = useQuery({ queryKey: ['approvals'], queryFn: api.approvals });
  const tools = useQuery({ queryKey: ['tools'], queryFn: api.tools });
  const failed = (executions.data ?? []).filter((item) => !['succeeded', 'completed'].includes(item.status)).length;
  const today = (executions.data ?? []).filter((item) => new Date(item.createdAt).toDateString() === new Date().toDateString()).length;
  const pending = (approvals.data ?? []).filter((item) => item.status === 'pending').length;
  const riskCounts = (tools.data ?? []).reduce<Record<string, number>>((acc, tool) => ({ ...acc, [tool.risk]: (acc[tool.risk] ?? 0) + 1 }), {});
  const chart = { tooltip: { trigger: 'item' }, legend: { bottom: 0 }, series: [{ type: 'pie', radius: ['45%', '70%'], data: Object.entries(riskCounts).map(([name, value]) => ({ name, value })) }] };

  return (
    <div className="page">
      <div className="page-title">
        <div><Typography.Title level={2}>仪表盘</Typography.Title><Typography.Text type="secondary">用于审计 MCP 工具使用的运维指挥中心。</Typography.Text></div>
        <Space><Button onClick={() => navigate('/tools')} type="primary">执行工具</Button><Button onClick={() => window.open('/swagger', '_blank')}>Swagger</Button></Space>
      </div>
      <Row gutter={[16, 16]} className="section">
        <Col xs={12} lg={6}><Card hoverable onClick={() => navigate('/executions')}><Statistic title="活跃告警" value={failed} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: failed ? '#cf1322' : '#3f8600' }} /></Card></Col>
        <Col xs={12} lg={6}><Card hoverable onClick={() => navigate('/approvals')}><Statistic title="待审批" value={pending} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card hoverable onClick={() => navigate('/executions')}><Statistic title="今日执行" value={today} prefix={<FileSearchOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card hoverable onClick={() => navigate('/tools')}><Statistic title="工具数量" value={summary.data?.tools ?? 0} prefix={<ToolOutlined />} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]} className="section">
        <Col xs={24} lg={15}><Card title="最近执行" extra={<Button type="link" onClick={() => navigate('/executions')}>查看全部</Button>}><StatusTable data={(executions.data ?? []).slice(0, 8)} loading={executions.isLoading} /></Card></Col>
        <Col xs={24} lg={9}><Card title="风险分布图"><ReactECharts option={chart} style={{ height: 320 }} /><Typography.Text type="secondary">模式: {summary.data?.mode ?? '-'} · 环境: {summary.data?.environment ?? '-'}</Typography.Text></Card></Col>
      </Row>
    </div>
  );
}

function StatusTable({ data, loading }: { data: Execution[]; loading?: boolean }) {
  const columns = [
    { title: '状态', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
    { title: '工具', dataIndex: 'tool', render: (t: string) => <Typography.Text code>{t}</Typography.Text> },
    { title: '执行人', dataIndex: 'actor', responsive: ['md'] as any },
    { title: '目标', dataIndex: 'target', responsive: ['lg'] as any },
    { title: '创建时间', dataIndex: 'createdAt', render: formatTime, responsive: ['lg'] as any },
  ];
  return <Table rowKey="id" loading={loading} columns={columns} dataSource={data} pagination={false} />;
}
