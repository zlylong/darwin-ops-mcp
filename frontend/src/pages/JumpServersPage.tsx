
import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { ApiOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../services/api';
import type { JumpServerAuthType, JumpServerInstance, JumpServerInstanceRequest, JumpServerStatus } from '../types';

function statusTag(status: JumpServerStatus) {
  if (status === 'active') return <Tag color="green">可用</Tag>;
  if (status === 'inactive') return <Tag color="default">停用</Tag>;
  if (status === 'unreachable') return <Tag color="red">不可达</Tag>;
  return <Tag color="blue">{status || '-'}</Tag>;
}

function authLabel(authType: JumpServerAuthType) {
  if (authType === 'private_token') return 'Private Token';
  if (authType === 'access_key') return 'Access Key';
  if (authType === 'session') return 'Session';
  return 'Token';
}

export function JumpServersPage() {
  const [form] = Form.useForm<JumpServerInstanceRequest>();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<JumpServerInstance | null>(null);
  const [msg, holder] = message.useMessage();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['jumpservers'], queryFn: api.jumpServers, refetchInterval: 10000 });

  const save = useMutation({
    mutationFn: async (values: JumpServerInstanceRequest) => editing ? api.updateJumpServer(editing.id, values) : api.createJumpServer(values),
    onSuccess: () => {
      msg.success(editing ? 'JumpServer 已更新' : 'JumpServer 已添加');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['jumpservers'] });
    },
    onError: (err) => msg.error(err instanceof Error ? err.message : '保存失败'),
  });
  const remove = useMutation({
    mutationFn: api.deleteJumpServer,
    onSuccess: () => { msg.success('JumpServer 已删除'); queryClient.invalidateQueries({ queryKey: ['jumpservers'] }); },
    onError: (err) => msg.error(err instanceof Error ? err.message : '删除失败'),
  });
  const test = useMutation({
    mutationFn: api.testJumpServer,
    onSuccess: (res) => {
      if (res.reachable) msg.success(res.name + ' 连通性正常');
      else msg.warning(res.name + ' 不可达：' + res.message);
      queryClient.invalidateQueries({ queryKey: ['jumpservers'] });
    },
    onError: (err) => msg.error(err instanceof Error ? err.message : '连通性测试失败'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ authType: 'token', status: 'active', version: 'v2' });
    setOpen(true);
  };
  const openEdit = (item: JumpServerInstance) => {
    setEditing(item);
    form.setFieldsValue({ name: item.name, baseUrl: item.baseUrl, version: item.version, authType: item.authType, status: item.status, description: item.description });
    setOpen(true);
  };

  const columns: ColumnsType<JumpServerInstance> = [
    { title: '名称', dataIndex: 'name', render: (v, row) => <Space direction="vertical" size={0}><Typography.Text strong>{v}</Typography.Text><Typography.Text type="secondary" code>{row.id}</Typography.Text></Space> },
    { title: 'URL', dataIndex: 'baseUrl', render: (v) => <Typography.Link href={v} target="_blank">{v}</Typography.Link> },
    { title: '版本', dataIndex: 'version', render: (v) => v || '-' },
    { title: '认证', dataIndex: 'authType', render: (v: JumpServerAuthType, row) => <Space><Tag>{authLabel(v)}</Tag>{row.hasCredential ? <Tag color="green">已配置凭据</Tag> : <Tag color="orange">未配置凭据</Tag>}</Space> },
    { title: '状态', dataIndex: 'status', render: statusTag },
    { title: '最后检测', dataIndex: 'lastCheckedAt', render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '备注', dataIndex: 'description', ellipsis: true, render: (v) => v || '-' },
    { title: '操作', width: 220, render: (_, row) => <Space>
      <Button size="small" icon={<ThunderboltOutlined />} loading={test.isPending} onClick={() => test.mutate(row.id)}>测试</Button>
      <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
      <Popconfirm title="确认删除该 JumpServer？" onConfirm={() => remove.mutate(row.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
    </Space> },
  ];

  return <div className="page">
    {holder}
    <div className="page-title">
      <div><Typography.Title level={2}>JumpServer 管理</Typography.Title><Typography.Text type="secondary">登记多个 JumpServer 服务器，后续工具可按实例路由到不同堡垒机。参考 JumpServer v2 REST API：/api/docs/。</Typography.Text></div>
      <Space><Button icon={<ReloadOutlined />} onClick={() => query.refetch()} loading={query.isFetching}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加 JumpServer</Button></Space>
    </div>
    <Alert className="section" type="info" showIcon message="安全说明" description="Token、Private Token、Access Key Secret 仅在创建/更新时提交，后端响应和列表只返回 hasCredential，不返回明文凭据。" />
    <Card className="section">
      <Table rowKey="id" columns={columns} dataSource={query.data ?? []} loading={query.isLoading || remove.isPending} pagination={{ pageSize: 10 }} />
    </Card>
    <Modal title={editing ? '编辑 JumpServer' : '添加 JumpServer'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={save.isPending} width={760} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
        <Form.Item name="name" label="名称" rules={[{ required: !editing, message: '请输入名称' }]}><Input placeholder="生产 JumpServer" /></Form.Item>
        <Form.Item name="baseUrl" label="Base URL" rules={[{ required: !editing, message: '请输入 Base URL' }]}><Input placeholder="https://jumpserver.example.com" /></Form.Item>
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="version" label="版本" style={{ width: '33%' }}><Input placeholder="v2" /></Form.Item>
          <Form.Item name="authType" label="认证方式" style={{ width: '33%' }} rules={[{ required: true }]}><Select options={[{ value: 'token', label: 'Token' }, { value: 'private_token', label: 'Private Token' }, { value: 'access_key', label: 'Access Key' }, { value: 'session', label: 'Session' }]} /></Form.Item>
          <Form.Item name="status" label="状态" style={{ width: '34%' }}><Select options={[{ value: 'active', label: '可用' }, { value: 'inactive', label: '停用' }, { value: 'unreachable', label: '不可达' }]} /></Form.Item>
        </Space.Compact>
        <Form.Item name="credential" label="Token / Private Token / Session 凭据"><Input.Password autoComplete="off" placeholder={editing ? '留空表示不修改已保存凭据' : '请输入凭据'} /></Form.Item>
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="accessKeyId" label="Access Key ID" style={{ width: '50%' }}><Input autoComplete="off" placeholder="Access Key ID" /></Form.Item>
          <Form.Item name="accessKeySecret" label="Access Key Secret" style={{ width: '50%' }}><Input.Password autoComplete="off" placeholder={editing ? '留空表示不修改' : 'Access Key Secret'} /></Form.Item>
        </Space.Compact>
        <Form.Item name="description" label="备注"><Input.TextArea rows={3} placeholder="用途、网络位置、负责人等" /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
