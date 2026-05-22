import React from 'react';
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { CopyOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_TOKEN_STORAGE_KEY } from '../services/api';
import type { AgentAPIKey, AgentAPIKeyCreateRequest, AgentAPIKeyCreateResponse } from '../types';
import { formatTime, shortId } from '../components/utils';

type CreateFormValues = AgentAPIKeyCreateRequest & { scopesText?: string };

function KeyStatusTag({ status }: { status?: string }) {
  if (status === 'active') return <Tag color="green">有效</Tag>;
  if (status === 'revoked') return <Tag color="red">已吊销</Tag>;
  if (status === 'expired') return <Tag color="orange">已过期</Tag>;
  return <Tag color="blue">{status || '-'}</Tag>;
}

function splitScopes(text?: string): string[] {
  return (text || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function TokenSetupCard({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = React.useState(() => localStorage.getItem(API_TOKEN_STORAGE_KEY) || '');
  const [messageApi, contextHolder] = message.useMessage();
  return (
    <Card className="section" title="Master Token">
      {contextHolder}
      <Space direction="vertical" className="full" size="middle">
        <Alert
          type="info"
          showIcon
          message="仅 Master Token 可以颁发、查看和吊销 Agent API Key。Token 只保存在当前浏览器 localStorage，不会写入后端日志。"
        />
        <Space.Compact className="full">
          <Input.Password
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="DARWIN_OPS_MCP_API_TOKEN；未启用认证时可留空"
            autoComplete="off"
          />
          <Button
            type="primary"
            onClick={() => {
              localStorage.setItem(API_TOKEN_STORAGE_KEY, token.trim());
              messageApi.success('Master Token 已保存到浏览器');
              onSaved();
            }}
          >保存</Button>
          <Button
            onClick={() => {
              localStorage.removeItem(API_TOKEN_STORAGE_KEY);
              setToken('');
              messageApi.success('已清除浏览器内保存的 Token');
              onSaved();
            }}
          >清除</Button>
        </Space.Compact>
      </Space>
    </Card>
  );
}

export function AgentAPIKeysPage() {
  const [form] = Form.useForm<CreateFormValues>();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [created, setCreated] = React.useState<AgentAPIKeyCreateResponse | null>(null);
  const [status, setStatus] = React.useState('all');
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const keys = useQuery({ queryKey: ['agent-api-keys'], queryFn: api.agentAPIKeys, refetchInterval: 5000 });

  const createKey = useMutation({
    mutationFn: (values: CreateFormValues) => {
      const req: AgentAPIKeyCreateRequest = {
        name: values.name.trim(),
        actor: values.actor.trim(),
        role: values.role,
        reason: values.reason.trim(),
        scopes: splitScopes(values.scopesText),
        expiresInHrs: values.expiresInHrs ?? 0,
      };
      return api.createAgentAPIKey(req);
    },
    onSuccess: (res) => {
      setModalOpen(false);
      form.resetFields();
      setCreated(res);
      queryClient.invalidateQueries({ queryKey: ['agent-api-keys'] });
      messageApi.success('Agent API Key 已颁发，请立即复制一次性 Secret');
    },
    onError: (err) => messageApi.error(err instanceof Error ? err.message : '颁发失败'),
  });

  const revokeKey = useMutation({
    mutationFn: api.revokeAgentAPIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-api-keys'] });
      messageApi.success('Agent API Key 已吊销');
    },
    onError: (err) => messageApi.error(err instanceof Error ? err.message : '吊销失败'),
  });

  const data = (keys.data ?? []).filter((item) => status === 'all' || item.status === status);
  const columns = [
    { title: 'ID', dataIndex: 'id', render: (v: string) => <Typography.Text code>{shortId(v)}</Typography.Text> },
    { title: '状态', dataIndex: 'status', render: (v: string) => <KeyStatusTag status={v} /> },
    { title: '名称', dataIndex: 'name' },
    { title: 'Actor', dataIndex: 'actor', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    { title: '角色', dataIndex: 'role' },
    { title: 'Key Prefix', dataIndex: 'keyPrefix', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    { title: 'Scopes', dataIndex: 'scopes', render: (v?: string[]) => v?.length ? <Space wrap>{v.map((scope) => <Tag key={scope}>{scope}</Tag>)}</Space> : <Typography.Text type="secondary">全部默认权限</Typography.Text> },
    { title: '过期时间', dataIndex: 'expiresAt', render: (v?: string) => v ? formatTime(v) : '永不过期' },
    { title: '最后使用', dataIndex: 'lastUsedAt', render: formatTime },
    { title: '创建时间', dataIndex: 'createdAt', render: formatTime },
    {
      title: '操作',
      render: (_: unknown, row: AgentAPIKey) => row.status === 'active' ? (
        <Popconfirm title="确认吊销该 Agent API Key？" description="吊销后，该 Bearer Token 将无法继续访问 API/MCP。" onConfirm={() => revokeKey.mutate(row.id)}>
          <Button danger size="small" icon={<StopOutlined />}>吊销</Button>
        </Popconfirm>
      ) : <Typography.Text type="secondary">-</Typography.Text>,
    },
  ];

  return (
    <div className="page">
      {contextHolder}
      <div className="page-title">
        <div>
          <Typography.Title level={2}>Agent Key 管理</Typography.Title>
          <Typography.Text type="secondary">为外部 AI Agent 颁发专用 Bearer Token，隔离身份、角色和审计归属。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => keys.refetch()} loading={keys.isFetching}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ role: 'viewer', expiresInHrs: 0 }); setModalOpen(true); }}>颁发 Key</Button>
        </Space>
      </div>

      <TokenSetupCard onSaved={() => keys.refetch()} />

      {keys.error ? (
        <Alert
          className="section"
          type="error"
          showIcon
          message="无法读取 Agent API Key 列表"
          description={keys.error instanceof Error ? keys.error.message : '请确认 Master Token 是否正确，或后端是否处于受信任模式。'}
        />
      ) : null}

      <Card className="section">
        <Space wrap className="toolbar">
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '有效' },
              { value: 'revoked', label: '已吊销' },
              { value: 'expired', label: '已过期' },
            ]}
          />
        </Space>
        <Table
          rowKey="id"
          className="section"
          loading={keys.isLoading || revokeKey.isPending}
          columns={columns}
          dataSource={data}
          locale={{ emptyText: <Empty description="暂无 Agent API Key" /> }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="颁发 Agent API Key"
        open={modalOpen}
        onOk={() => form.submit()}
        confirmLoading={createKey.isPending}
        onCancel={() => setModalOpen(false)}
        width={760}
        destroyOnHidden
      >
        <Alert className="section" type="warning" showIcon message="Secret 只会在创建成功后显示一次，请复制后交给对应 Agent，禁止截图或写入文档。" />
        <Form form={form} layout="vertical" className="section" initialValues={{ role: 'viewer', expiresInHrs: 0 }} onFinish={(values) => createKey.mutate(values)}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input placeholder="opsagent-topic-436" /></Form.Item></Col>
            <Col span={12}><Form.Item name="actor" label="Actor" rules={[{ required: true, message: '请输入 Actor' }]}><Input placeholder="opsagent-topic-436" /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="role" label="角色" initialValue="viewer" rules={[{ required: true }]}><Select options={[{ value: 'viewer', label: 'viewer' }, { value: 'operator', label: 'operator' }, { value: 'admin', label: 'admin' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="expiresInHrs" label="有效期(小时，0=永不过期)"><InputNumber min={0} precision={0} className="full" /></Form.Item></Col>
          </Row>
          <Form.Item name="reason" label="用途/原因" rules={[{ required: true, message: '请输入用途/原因' }]}><Input.TextArea rows={3} placeholder="用于第三方 AI Agent 调用已审批工具，审计归属到该 actor" /></Form.Item>
          <Form.Item name="scopesText" label="Scopes（可选，每行或逗号分隔）"><Input.TextArea rows={3} placeholder={'tools:read\\ntools:execute'} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="一次性 Agent API Secret" open={!!created} onCancel={() => setCreated(null)} footer={<Button type="primary" onClick={() => setCreated(null)}>我已复制并安全保存</Button>} width={760}>
        <Space direction="vertical" className="full" size="middle">
          <Alert type="warning" showIcon message="该 Secret 只会显示这一次。关闭后无法找回，只能吊销并重新颁发。" />
          <Card size="small" title="Secret">
            <Typography.Paragraph copyable={{ text: created?.secret || '', icon: <CopyOutlined /> }}>
              <Typography.Text code>{created?.secret}</Typography.Text>
            </Typography.Paragraph>
          </Card>
          <Card size="small" title="元数据">
            <Row gutter={[12, 8]}>
              <Col span={12}>ID：<Typography.Text code>{created?.id}</Typography.Text></Col>
              <Col span={12}>Prefix：<Typography.Text code>{created?.keyPrefix}</Typography.Text></Col>
              <Col span={12}>Actor：<Typography.Text code>{created?.actor}</Typography.Text></Col>
              <Col span={12}>Role：{created?.role}</Col>
            </Row>
          </Card>
        </Space>
      </Modal>
    </div>
  );
}
