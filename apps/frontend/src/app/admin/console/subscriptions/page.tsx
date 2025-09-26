"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Layout, Card, Table, Input, Space, Button, Modal, Form, Select, Typography, InputNumber, message } from 'antd';

type UserRow = { id: string; email?: string; name?: string; role?: string; createdAt?: string };

export default function AdminSubscriptionsPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UserRow[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<string | undefined>();
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<UserRow | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [form] = Form.useForm();
  const [amount, setAmount] = useState<number>(100);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String((page - 1) * limit));
      if (q) params.set('q', q);
      if (role) params.set('role', role);
      const res = await fetch(`/api/v1/console/users?${params.toString()}`, { cache: 'no-store' });
      const j = await res.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const openUser = async (u: UserRow) => {
    setCurrent(u); setVisible(true); form.resetFields();
    setSubLoading(true);
    try {
      const res = await fetch(`/api/v1/console/users/${u.id}/subscription`, { cache: 'no-store' });
      if (res.ok) {
        const s = await res.json();
        form.setFieldsValue({ planName: (s.planName||'').toLowerCase(), status: (s.status||'').toLowerCase() });
      } else {
        // no subscription; leave form defaults
      }
    } catch {}
    setSubLoading(false);
  };

  const saveSub = async () => {
    try {
      const v = await form.validateFields();
      if (!current) return;
      const body: any = { planName: v.planName };
      if (v.status) body.status = v.status;
      const resp = await fetch(`/api/v1/console/users/${current.id}/subscription`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(await resp.text());
      message.success('订阅已更新');
      setVisible(false);
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    }
  };

  const recharge = async () => {
    try {
      if (!current) return;
      if (!amount || amount <= 0) { message.warning('请输入有效数量'); return }
      const resp = await fetch(`/api/v1/console/users/${current.id}/tokens`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amount }) });
      if (!resp.ok) throw new Error(await resp.text());
      message.success('充值成功');
    } catch (e: any) {
      message.error(e?.message || '充值失败');
    }
  };

  useEffect(() => { fetchUsers() }, []);
  useEffect(() => { fetchUsers() }, [page, limit]);

  const columns = useMemo(() => ([
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Role', dataIndex: 'role', key: 'role' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v ? new Date(v).toLocaleString() : '' },
    {
      title: '操作', key: 'actions', render: (_: any, r: UserRow) => (
        <Space>
          <Button type="link" onClick={() => openUser(r)}>订阅</Button>
        </Space>
      )
    }
  ]), []);

  return (
    <Layout style={{ padding: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card>
          <Space wrap>
            <Input placeholder="搜索 email/name" value={q} onChange={(e)=>setQ(e.target.value)} style={{ width: 260 }} />
            <Select placeholder="角色" allowClear value={role} onChange={setRole} style={{ width: 160 }}
              options={[{value:'ADMIN',label:'ADMIN'},{value:'USER',label:'USER'}]} />
            <Select value={limit} onChange={(v)=>setLimit(v)} style={{ width: 120 }} options={[{value:10,label:'10'},{value:20,label:'20'},{value:50,label:'50'}]} />
            <Button type="primary" onClick={()=>{ setPage(1); fetchUsers(); }}>搜索</Button>
          </Space>
        </Card>

        <Card title="用户列表">
          <Table rowKey="id" loading={loading} dataSource={items} columns={columns}
            pagination={{ current: page, pageSize: limit, onChange: setPage }} size="small" />
        </Card>
      </Space>

      <Modal open={visible} onCancel={()=>setVisible(false)} onOk={saveSub} confirmLoading={subLoading} title="订阅管理">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form form={form} layout="vertical">
            <Form.Item label="套餐" name="planName" rules={[{ required: true, message: '请选择套餐' }]}>
              <Select options={[{value:'free',label:'Free'},{value:'pro',label:'Pro'},{value:'max',label:'Max'}]} />
            </Form.Item>
            <Form.Item label="状态" name="status">
              <Select allowClear options={[{value:'active',label:'Active'},{value:'paused',label:'Paused'}]} />
            </Form.Item>
          </Form>
          <Card size="small" title="充值 Token">
            <Space>
              <InputNumber value={amount} onChange={(v)=>setAmount(Number(v)||0)} min={1} />
              <Button onClick={recharge}>充值</Button>
            </Space>
          </Card>
          {current && (
            <Typography.Paragraph type="secondary">当前用户：{current.email || current.id}</Typography.Paragraph>
          )}
        </Space>
      </Modal>
    </Layout>
  );
}

